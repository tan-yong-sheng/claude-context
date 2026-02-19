#!/usr/bin/env node

/**
 * MCP Protocol Test Script
 * Tests the MCP server directly via stdio
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Start the MCP server as a child process
const serverPath = join(__dirname, 'dist', 'index.js');
const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe']
});

let requestId = 1;
let buffer = '';

// Helper to send JSON-RPC request
function sendRequest(method, params = {}) {
    const request = {
        jsonrpc: '2.0',
        id: requestId++,
        method,
        params
    };
    const message = JSON.stringify(request);
    server.stdin.write(message + '\n');
    console.log(`[SENT] ${method}`);
    return request.id;
}

// Helper to send notification (no id, no response expected)
function sendNotification(method, params = {}) {
    const notification = {
        jsonrpc: '2.0',
        method,
        params
    };
    const message = JSON.stringify(notification);
    server.stdin.write(message + '\n');
    console.log(`[SENT NOTIFICATION] ${method}`);
}

// Parse incoming messages
server.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
        if (line.trim()) {
            try {
                const response = JSON.parse(line);
                console.log('[RECEIVED]', JSON.stringify(response, null, 2));
            } catch (e) {
                console.log('[RAW OUTPUT]', line);
            }
        }
    }
});

server.stderr.on('data', (data) => {
    console.log('[SERVER LOG]', data.toString().trim());
});

server.on('close', (code) => {
    console.log(`[SERVER CLOSED] Exit code: ${code}`);
});

// Test sequence
async function runTests() {
    console.log('\n=== MCP Protocol Test ===\n');

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 1: Initialize
    console.log('\n--- Step 1: Initialize ---');
    sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
            name: 'test-client',
            version: '1.0.0'
        }
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 2: Send initialized notification
    console.log('\n--- Step 2: Initialized Notification ---');
    sendNotification('notifications/initialized');

    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 3: List tools
    console.log('\n--- Step 3: List Tools ---');
    sendRequest('tools/list');

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 4: Test get_indexing_status
    console.log('\n--- Step 4: Get Indexing Status ---');
    sendRequest('tools/call', {
        name: 'get_indexing_status',
        arguments: {
            path: '/home/ubuntu/code-context'
        }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 5: Test index_codebase (on a small test directory)
    console.log('\n--- Step 5: Index Codebase ---');
    sendRequest('tools/call', {
        name: 'index_codebase',
        arguments: {
            path: '/home/ubuntu/code-context/packages/mcp/src',
            splitter: 'ast'
        }
    });

    await new Promise(resolve => setTimeout(resolve, 10000));

    // Step 6: Test search_code
    console.log('\n--- Step 6: Search Code ---');
    sendRequest('tools/call', {
        name: 'search_code',
        arguments: {
            path: '/home/ubuntu/code-context/packages/mcp/src',
            query: 'snapshot manager',
            limit: 5
        }
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 7: Test clear_index
    console.log('\n--- Step 7: Clear Index ---');
    sendRequest('tools/call', {
        name: 'clear_index',
        arguments: {
            path: '/home/ubuntu/code-context/packages/mcp/src'
        }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cleanup
    console.log('\n=== Tests Complete ===\n');
    server.kill();
}

runTests().catch(console.error);
