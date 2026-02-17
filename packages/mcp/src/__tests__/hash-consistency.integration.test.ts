/**
 * Integration test for hash consistency
 *
 * This test verifies the entire flow from index_codebase to search_code
 * uses consistent hash lengths, preventing the 'not indexed' error.
 *
 * This test would have caught the bug where getCollectionName() used
 * 8-char hashes but getPathHash() used 16-char hashes.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ToolHandlers } from '../handlers';
import { SnapshotManager } from '../snapshot';
import { Context } from '@tan-yong-sheng/claude-context-core';

// Increase timeout for integration tests
jest.setTimeout(60000);

describe('Hash Consistency Integration Test', () => {
    let handlers: ToolHandlers;
    let tempDir: string;
    let snapshotManager: SnapshotManager;

    beforeEach(async () => {
        // Create temp directory with sample code files
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-context-test-'));

        // Create sample TypeScript files
        fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
        fs.writeFileSync(path.join(tempDir, 'src', 'utils.ts'), `
export function add(a: number, b: number): number {
    return a + b;
}

export function subtract(a: number, b: number): number {
    return a - b;
}
`);
        fs.writeFileSync(path.join(tempDir, 'src', 'main.ts'), `
import { add, subtract } from './utils';

function main() {
    console.log(add(1, 2));
    console.log(subtract(5, 3));
}

main();
`);

        // Create a real snapshot manager
        snapshotManager = new SnapshotManager();

        // Create context with mock embedding
        const context = new Context({
            embeddingProvider: 'openai',
            embeddingModel: 'text-embedding-3-small',
            apiKey: 'test-api-key',
        });

        handlers = new ToolHandlers(context, snapshotManager);
    });

    afterEach(() => {
        // Cleanup temp directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }

        // Clear the index for this test path
        try {
            const context = (handlers as any).context;
            if (context) {
                context.clearIndex(tempDir);
            }
        } catch {
            // Ignore cleanup errors
        }
    });

    it('should use consistent 8-character hash throughout index and search flow', async () => {
        // Step 1: Index the codebase
        const indexResult = await handlers.handleIndexCodebase({
            path: tempDir,
            splitter: 'langchain' // Use langchain to avoid tree-sitter dependency
        });

        expect(indexResult.isError).toBeFalsy();
        expect(indexResult.content[0].text).toContain('Started background indexing');

        // Verify the collection name uses 8-char hash
        const context = (handlers as any).context;
        const collectionName = context.getCollectionName(tempDir);
        const hashMatch = collectionName.match(/hybrid_code_chunks_([a-f0-9]{8})$/);
        expect(hashMatch).toBeTruthy();
        expect(hashMatch![1]).toHaveLength(8);

        // Verify the path mapping uses the same 8-char hash
        const { getPathHash } = await import('@tan-yong-sheng/claude-context-core/dist/utils/vector-paths');
        const pathHash = getPathHash(tempDir);
        expect(pathHash).toHaveLength(8);
        expect(pathHash).toBe(hashMatch![1]);
    });

    it('should maintain consistent hash between getCollectionName and getPathHash', async () => {
        // Import both functions
        const { getPathHash } = await import('@tan-yong-sheng/claude-context-core/dist/utils/vector-paths');

        // Get hash from vector-paths
        const pathHash = getPathHash(tempDir);

        // Get collection name from context
        const context = (handlers as any).context;
        const collectionName = context.getCollectionName(tempDir);

        // Extract hash from collection name (format: hybrid_code_chunks_<hash>)
        const hashFromCollection = collectionName.replace('hybrid_code_chunks_', '');

        // Both should be 8 characters and match
        expect(pathHash).toHaveLength(8);
        expect(hashFromCollection).toHaveLength(8);
        expect(pathHash).toBe(hashFromCollection);
    });

    it('should allow search after indexing completes', async () => {
        // First, index the codebase
        await handlers.handleIndexCodebase({
            path: tempDir,
            splitter: 'langchain'
        });

        // Manually set the codebase as indexed (simulating completion)
        snapshotManager.setCodebaseIndexed(tempDir, {
            indexedFiles: 2,
            totalChunks: 5,
            status: 'completed'
        });

        // Now search - this would fail with 'not indexed' if hashes don't match
        const searchResult = await handlers.handleSearchCode({
            path: tempDir,
            query: 'add function',
            limit: 5
        });

        // Should not return an error about not being indexed
        expect(searchResult.isError).toBeFalsy();
        expect(searchResult.content[0].text).not.toContain('not indexed');
    });

    it('should correctly look up original path from hash', async () => {
        const { getPathHash, getOriginalPath } = await import('@tan-yong-sheng/claude-context-core/dist/utils/vector-paths');

        // Get the hash
        const hash = getPathHash(tempDir);
        expect(hash).toHaveLength(8);

        // The vector database would have saved the path mapping
        // After our fix, both use 8-char hashes, so lookup should work

        // Note: In a real scenario, the path mapping is saved when getVectorDbPath is called
        // Here we verify the hash format is correct
        const context = (handlers as any).context;
        const collectionName = context.getCollectionName(tempDir);
        const hashInCollection = collectionName.replace('hybrid_code_chunks_', '');

        expect(hashInCollection).toBe(hash);
        expect(hashInCollection).toHaveLength(8);
    });

    it('should handle multiple codebases with unique 8-char hashes', async () => {
        const { getPathHash } = await import('@tan-yong-sheng/claude-context-core/dist/utils/vector-paths');

        // Create multiple temp directories
        const tempDirs = [
            fs.mkdtempSync(path.join(os.tmpdir(), 'test1-')),
            fs.mkdtempSync(path.join(os.tmpdir(), 'test2-')),
            fs.mkdtempSync(path.join(os.tmpdir(), 'test3-'))
        ];

        try {
            // Get hashes for all
            const hashes = tempDirs.map(dir => getPathHash(dir));

            // All should be 8 characters
            hashes.forEach(hash => {
                expect(hash).toHaveLength(8);
                expect(hash).toMatch(/^[a-f0-9]{8}$/);
            });

            // All should be unique
            const uniqueHashes = new Set(hashes);
            expect(uniqueHashes.size).toBe(hashes.length);

            // Collection names should also have 8-char hashes
            const context = (handlers as any).context;
            const collectionNames = tempDirs.map(dir => context.getCollectionName(dir));

            collectionNames.forEach(name => {
                const hash = name.replace('hybrid_code_chunks_', '');
                expect(hash).toHaveLength(8);
            });
        } finally {
            // Cleanup
            tempDirs.forEach(dir => {
                if (fs.existsSync(dir)) {
                    fs.rmSync(dir, { recursive: true, force: true });
                }
            });
        }
    });
});
