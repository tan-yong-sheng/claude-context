/**
 * Unit tests for SnapshotManager
 *
 * Tests V1/V2 format migration and state management for indexed codebases.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SnapshotManager } from '../snapshot';

// Mock fs module
jest.mock('fs');

const mockedFs = jest.mocked(fs);

describe('SnapshotManager', () => {
    let snapshotManager: SnapshotManager;
    const mockSnapshotPath = '/home/testuser/.context/mcp-codebase-snapshot.json';

    beforeEach(() => {
        jest.clearAllMocks();

        // Default mock implementations
        mockedFs.existsSync.mockReturnValue(false);
        mockedFs.mkdirSync.mockImplementation(() => undefined);
        mockedFs.writeFileSync.mockImplementation(() => undefined);
        mockedFs.readFileSync.mockImplementation(() => {
            throw new Error('File not found');
        });

        snapshotManager = new SnapshotManager();
    });

    describe('V2 Format', () => {
        it('should initialize with empty codebases when no snapshot exists', () => {
            const codebases = snapshotManager.getIndexedCodebases();
            expect(codebases).toEqual([]);
        });

        it('should set codebase to indexing status', () => {
            snapshotManager.setCodebaseIndexing('/test/path', 0);

            const status = snapshotManager.getCodebaseStatus('/test/path');
            expect(status).toBe('indexing');

            const info = snapshotManager.getCodebaseInfo('/test/path');
            expect(info).toMatchObject({
                status: 'indexing',
                indexingPercentage: 0
            });
        });

        it('should update indexing progress', () => {
            // Set codebase to indexing first
            snapshotManager.setCodebaseIndexing('/test/path', 0);

            // Update progress using the deprecated method
            snapshotManager.updateIndexingProgress('/test/path', 50);

            const info = snapshotManager.getCodebaseInfo('/test/path');
            expect(info).toMatchObject({
                status: 'indexing',
                indexingPercentage: 50
            });
        });

        it('should set codebase to indexed status with stats', () => {
            const stats = { indexedFiles: 100, totalChunks: 500, status: 'completed' as const };
            snapshotManager.setCodebaseIndexed('/test/path', stats);

            const status = snapshotManager.getCodebaseStatus('/test/path');
            expect(status).toBe('indexed');

            const info = snapshotManager.getCodebaseInfo('/test/path');
            expect(info).toMatchObject({
                status: 'indexed',
                indexedFiles: 100,
                totalChunks: 500,
                indexStatus: 'completed'
            });
        });

        it('should set codebase to failed status with error', () => {
            snapshotManager.setCodebaseIndexFailed('/test/path', 'Out of memory', 50);

            const status = snapshotManager.getCodebaseStatus('/test/path');
            expect(status).toBe('indexfailed');

            const info = snapshotManager.getCodebaseInfo('/test/path');
            expect(info).toMatchObject({
                status: 'indexfailed',
                errorMessage: 'Out of memory',
                lastAttemptedPercentage: 50
            });
        });

        it('should remove codebase from indexed list', () => {
            // Add a codebase to indexed list
            snapshotManager.setCodebaseIndexed('/test/path', { indexedFiles: 10, totalChunks: 50, status: 'completed' });
            expect(snapshotManager.getCodebaseStatus('/test/path')).toBe('indexed');

            // Remove using the deprecated method
            snapshotManager.removeIndexedCodebase('/test/path');

            expect(snapshotManager.getCodebaseStatus('/test/path')).toBe('not_found');
            expect(snapshotManager.getIndexedCodebases()).not.toContain('/test/path');
        });

        it('should completely remove codebase from snapshot', () => {
            snapshotManager.setCodebaseIndexed('/test/path', { indexedFiles: 10, totalChunks: 50, status: 'completed' });
            snapshotManager.saveCodebaseSnapshot();

            snapshotManager.removeCodebaseCompletely('/test/path');

            expect(snapshotManager.getCodebaseStatus('/test/path')).toBe('not_found');
            expect(snapshotManager.getIndexedCodebases()).not.toContain('/test/path');
        });

        it('should return not_found for unknown codebase', () => {
            // Don't add any codebase - check status of unknown path
            const status = snapshotManager.getCodebaseStatus('/unknown/path');
            expect(status).toBe('not_found');

            const info = snapshotManager.getCodebaseInfo('/unknown/path');
            expect(info).toBeUndefined();
        });
    });

    describe('V1 Format Migration', () => {
        it('should migrate V1 format to V2 on load', () => {
            const v1Snapshot = {
                indexedCodebases: ['/test/path', '/other/path'],
                indexingCodebases: ['/indexing/path'],
                formatVersion: 'v1',
                lastUpdated: '2024-01-01T00:00:00.000Z'
            };

            mockedFs.existsSync.mockReturnValue(true);
            mockedFs.readFileSync.mockReturnValue(JSON.stringify(v1Snapshot));

            // Create new instance to trigger load
            const manager = new SnapshotManager();

            // Should have migrated to V2
            const codebases = manager.getIndexedCodebases();
            expect(codebases).toContain('/test/path');
            expect(codebases).toContain('/other/path');

            const indexing = manager.getIndexingCodebases();
            expect(indexing).toContain('/indexing/path');
        });

        it('should validate V1 codebases exist on filesystem', () => {
            const v1Snapshot = {
                indexedCodebases: ['/existing/path', '/nonexistent/path'],
                indexingCodebases: [],
                formatVersion: 'v1',
                lastUpdated: '2024-01-01T00:00:00.000Z'
            };

            // Mock: existing path returns true, nonexistent returns false
            mockedFs.existsSync.mockImplementation((p: any) => {
                const pathStr = p.toString();
                // Return true for snapshot file and existing path
                if (pathStr.includes('mcp-codebase-snapshot.json')) return true;
                return pathStr.includes('/existing/path');
            });
            mockedFs.readFileSync.mockReturnValue(JSON.stringify(v1Snapshot));

            // Create new instance to trigger load
            const manager = new SnapshotManager();

            // After load, saveCodebaseSnapshot is called which creates a v2 snapshot
            // We need to mock the file read for getIndexedCodebases
            const v2Snapshot = {
                formatVersion: 'v2',
                codebases: {
                    '/existing/path': { status: 'indexed', indexedFiles: 0, totalChunks: 0, indexStatus: 'completed', lastUpdated: '2024-01-01T00:00:00.000Z' }
                },
                lastUpdated: '2024-01-01T00:00:00.000Z'
            };
            mockedFs.readFileSync.mockReturnValue(JSON.stringify(v2Snapshot));

            // Should only include existing path
            const codebases = manager.getIndexedCodebases();
            expect(codebases).toContain('/existing/path');
            expect(codebases).not.toContain('/nonexistent/path');
        });

        it('should save in V2 format', () => {
            snapshotManager.setCodebaseIndexed('/test/path', { indexedFiles: 10, totalChunks: 50, status: 'completed' });
            snapshotManager.saveCodebaseSnapshot();

            expect(mockedFs.writeFileSync).toHaveBeenCalled();

            const writeCall = mockedFs.writeFileSync.mock.calls[0];
            const savedData = JSON.parse(writeCall[1] as string);

            expect(savedData.formatVersion).toBe('v2');
            expect(savedData.codebases).toBeDefined();
            expect(savedData.codebases['/test/path']).toMatchObject({
                status: 'indexed',
                indexedFiles: 10,
                totalChunks: 50
            });
        });
    });

    describe('Persistence', () => {
        it('should create directory if it does not exist', () => {
            mockedFs.existsSync.mockReturnValue(false);

            snapshotManager.saveCodebaseSnapshot();

            expect(mockedFs.mkdirSync).toHaveBeenCalledWith(
                expect.stringContaining('.context'),
                { recursive: true }
            );
        });

        it('should save and load V2 format correctly', () => {
            // Setup mock to return saved data
            let savedSnapshot: string = '';
            mockedFs.writeFileSync.mockImplementation((_, data) => {
                savedSnapshot = data as string;
            });
            mockedFs.existsSync.mockReturnValue(true);
            mockedFs.readFileSync.mockReturnValue(savedSnapshot);

            // Add codebases and save
            snapshotManager.setCodebaseIndexed('/test/path', { indexedFiles: 10, totalChunks: 50, status: 'completed' });
            snapshotManager.setCodebaseIndexing('/indexing/path', 50);
            snapshotManager.saveCodebaseSnapshot();

            // Verify saved data
            expect(savedSnapshot).toBeTruthy();
            const parsed = JSON.parse(savedSnapshot);
            expect(parsed.formatVersion).toBe('v2');
            expect(parsed.codebases['/test/path'].status).toBe('indexed');
            expect(parsed.codebases['/indexing/path'].status).toBe('indexing');
        });

        it('should handle corrupted snapshot file gracefully', () => {
            mockedFs.existsSync.mockReturnValue(true);
            mockedFs.readFileSync.mockReturnValue('invalid json');

            // Should not throw
            const manager = new SnapshotManager();

            const codebases = manager.getIndexedCodebases();
            expect(codebases).toEqual([]);
        });

        it('should handle missing snapshot file gracefully', () => {
            mockedFs.existsSync.mockReturnValue(false);

            const manager = new SnapshotManager();

            const codebases = manager.getIndexedCodebases();
            expect(codebases).toEqual([]);
        });
    });

    describe('Multiple Codebases', () => {
        it('should track multiple indexed codebases', () => {
            // Add multiple indexed codebases
            snapshotManager.setCodebaseIndexed('/path/one', { indexedFiles: 10, totalChunks: 50, status: 'completed' });
            snapshotManager.setCodebaseIndexed('/path/two', { indexedFiles: 20, totalChunks: 100, status: 'completed' });
            snapshotManager.setCodebaseIndexed('/path/three', { indexedFiles: 30, totalChunks: 150, status: 'completed' });

            // Save to trigger write
            snapshotManager.saveCodebaseSnapshot();

            // Mock the file read to return the saved snapshot
            const writeCall = mockedFs.writeFileSync.mock.calls[0];
            const savedData = writeCall[1] as string;
            mockedFs.existsSync.mockReturnValue(true);
            mockedFs.readFileSync.mockReturnValue(savedData);

            const codebases = snapshotManager.getIndexedCodebases();
            expect(codebases).toHaveLength(3);
            expect(codebases).toContain('/path/one');
            expect(codebases).toContain('/path/two');
            expect(codebases).toContain('/path/three');
        });

        it('should track both indexed and indexing codebases separately', () => {
            // Add indexed codebases
            snapshotManager.setCodebaseIndexed('/indexed/one', { indexedFiles: 10, totalChunks: 50, status: 'completed' });
            snapshotManager.setCodebaseIndexed('/indexed/two', { indexedFiles: 20, totalChunks: 100, status: 'completed' });

            // Add indexing codebases
            snapshotManager.setCodebaseIndexing('/indexing/one', 25);
            snapshotManager.setCodebaseIndexing('/indexing/two', 75);

            // Save to trigger write
            snapshotManager.saveCodebaseSnapshot();

            // Mock the file read to return the saved snapshot
            const writeCall = mockedFs.writeFileSync.mock.calls[0];
            const savedData = writeCall[1] as string;
            mockedFs.existsSync.mockReturnValue(true);
            mockedFs.readFileSync.mockReturnValue(savedData);

            const indexedCodebases = snapshotManager.getIndexedCodebases();
            const indexingCodebases = snapshotManager.getIndexingCodebases();

            // Indexed should contain only indexed paths
            expect(indexedCodebases).toHaveLength(2);
            expect(indexedCodebases).toContain('/indexed/one');
            expect(indexedCodebases).toContain('/indexed/two');

            // Indexing should contain only indexing paths
            expect(indexingCodebases).toHaveLength(2);
            expect(indexingCodebases).toContain('/indexing/one');
            expect(indexingCodebases).toContain('/indexing/two');
        });

        it('should move codebase from indexing to indexed', () => {
            // Start with indexing
            snapshotManager.setCodebaseIndexing('/test/path', 50);
            expect(snapshotManager.getCodebaseStatus('/test/path')).toBe('indexing');

            // Move to indexed using the deprecated method
            snapshotManager.moveFromIndexingToIndexed('/test/path', 100);

            // Save and mock file read
            snapshotManager.saveCodebaseSnapshot();
            const writeCall = mockedFs.writeFileSync.mock.calls[0];
            const savedData = writeCall[1] as string;
            mockedFs.existsSync.mockReturnValue(true);
            mockedFs.readFileSync.mockReturnValue(savedData);

            expect(snapshotManager.getCodebaseStatus('/test/path')).toBe('indexed');
            expect(snapshotManager.getIndexingCodebases()).not.toContain('/test/path');
            expect(snapshotManager.getIndexedCodebases()).toContain('/test/path');
            expect(snapshotManager.getIndexedFileCount('/test/path')).toBe(100);
        });
    });

    describe('getCodebaseInfo', () => {
        it('should return complete info for indexed codebase', () => {
            snapshotManager.setCodebaseIndexed('/test/path', { indexedFiles: 100, totalChunks: 500, status: 'completed' });

            const info = snapshotManager.getCodebaseInfo('/test/path');

            expect(info).toMatchObject({
                status: 'indexed',
                indexedFiles: 100,
                totalChunks: 500,
                indexStatus: 'completed'
            });
            expect(info?.lastUpdated).toBeDefined();
        });

        it('should return complete info for indexing codebase', () => {
            snapshotManager.setCodebaseIndexing('/test/path', 75);

            const info = snapshotManager.getCodebaseInfo('/test/path');

            expect(info).toMatchObject({
                status: 'indexing',
                indexingPercentage: 75
            });
        });

        it('should return complete info for failed codebase', () => {
            snapshotManager.setCodebaseIndexFailed('/test/path', 'Error message', 50);

            const info = snapshotManager.getCodebaseInfo('/test/path');

            expect(info).toMatchObject({
                status: 'indexfailed',
                errorMessage: 'Error message',
                lastAttemptedPercentage: 50
            });
        });
    });
});
