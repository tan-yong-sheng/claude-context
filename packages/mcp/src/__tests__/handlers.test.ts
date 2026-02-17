/**
 * Unit tests for MCP handlers
 *
 * Tests all 4 MCP tool handlers:
 * - handleIndexCodebase
 * - handleSearchCode
 * - handleClearIndex
 * - handleGetIndexingStatus
 */

import * as fs from 'fs';
import { ToolHandlers } from '../handlers';
import { SnapshotManager } from '../snapshot';

// Mock dependencies
jest.mock('fs');
jest.mock('../snapshot');

// Mock the core Context class
const mockContext = {
    getVectorDatabase: jest.fn(() => ({
        listCollections: jest.fn().mockResolvedValue([]),
        checkCollectionLimit: jest.fn().mockResolvedValue(undefined),
    })),
    hasIndex: jest.fn().mockResolvedValue(false),
    clearIndex: jest.fn().mockResolvedValue(undefined),
    indexCodebase: jest.fn().mockResolvedValue({ indexedFiles: 10, totalChunks: 50, status: 'completed' }),
    semanticSearch: jest.fn().mockResolvedValue([]),
    getEmbedding: jest.fn(() => ({
        getProvider: jest.fn().mockReturnValue('openai'),
        getDimension: jest.fn().mockReturnValue(1536),
    })),
    addCustomExtensions: jest.fn(),
    addCustomIgnorePatterns: jest.fn(),
    getIgnorePatterns: jest.fn().mockReturnValue([]),
    getLoadedIgnorePatterns: jest.fn().mockResolvedValue(undefined),
    getPreparedCollection: jest.fn().mockResolvedValue(undefined),
    getCollectionName: jest.fn().mockReturnValue('hybrid_code_chunks_test1234'),
    setSynchronizer: jest.fn(),
};

describe('ToolHandlers', () => {
    let handlers: ToolHandlers;
    let mockSnapshotManager: jest.Mocked<SnapshotManager>;
    let mockedFs: jest.Mocked<typeof fs>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup fs mock
        mockedFs = jest.mocked(fs);
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);

        // Setup snapshot manager mock
        mockSnapshotManager = {
            getIndexedCodebases: jest.fn().mockReturnValue([]),
            getIndexingCodebases: jest.fn().mockReturnValue([]),
            setCodebaseIndexing: jest.fn(),
            setCodebaseIndexed: jest.fn(),
            setCodebaseIndexFailed: jest.fn(),
            removeIndexedCodebase: jest.fn(),
            removeCodebaseCompletely: jest.fn(),
            getCodebaseStatus: jest.fn().mockReturnValue('not_found'),
            getCodebaseInfo: jest.fn().mockReturnValue(null),
            getIndexingProgress: jest.fn().mockReturnValue(0),
            saveCodebaseSnapshot: jest.fn(),
        } as unknown as jest.Mocked<SnapshotManager>;

        handlers = new ToolHandlers(mockContext as any, mockSnapshotManager);
    });

    describe('handleIndexCodebase', () => {
        it('should return error for non-existent path', async () => {
            mockedFs.existsSync.mockReturnValue(false);

            const result = await handlers.handleIndexCodebase({
                path: '/non/existent/path'
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('does not exist');
        });

        it('should return error for non-directory path', async () => {
            mockedFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

            const result = await handlers.handleIndexCodebase({
                path: '/path/to/file.txt'
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('not a directory');
        });

        it('should return error for already indexing codebase', async () => {
            mockSnapshotManager.getIndexingCodebases.mockReturnValue(['/test/path']);

            const result = await handlers.handleIndexCodebase({
                path: '/test/path'
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('already being indexed');
        });

        it('should return error for already indexed codebase without force', async () => {
            mockSnapshotManager.getIndexedCodebases.mockReturnValue(['/test/path']);
            mockContext.hasIndex.mockResolvedValue(true);

            const result = await handlers.handleIndexCodebase({
                path: '/test/path'
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('already indexed');
        });

        it('should accept force=true to reindex existing codebase', async () => {
            mockSnapshotManager.getIndexedCodebases.mockReturnValue(['/test/path']);
            mockContext.hasIndex.mockResolvedValue(true);

            const result = await handlers.handleIndexCodebase({
                path: '/test/path',
                force: true
            });

            expect(result.isError).toBeFalsy();
            expect(mockContext.clearIndex).toHaveBeenCalledWith('/test/path');
            expect(mockSnapshotManager.removeIndexedCodebase).toHaveBeenCalledWith('/test/path');
        });

        it('should validate splitter parameter', async () => {
            const result = await handlers.handleIndexCodebase({
                path: '/test/path',
                splitter: 'invalid'
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('Invalid splitter');
        });

        it('should accept valid splitter types', async () => {
            for (const splitter of ['ast', 'langchain']) {
                const result = await handlers.handleIndexCodebase({
                    path: '/test/path',
                    splitter
                });
                expect(result.isError).toBeFalsy();
            }
        });

        it('should process custom extensions', async () => {
            await handlers.handleIndexCodebase({
                path: '/test/path',
                customExtensions: ['.vue', '.svelte']
            });

            expect(mockContext.addCustomExtensions).toHaveBeenCalledWith(['.vue', '.svelte']);
        });

        it('should process custom ignore patterns', async () => {
            await handlers.handleIndexCodebase({
                path: '/test/path',
                ignorePatterns: ['*.test.js', 'dist/**']
            });

            expect(mockContext.addCustomIgnorePatterns).toHaveBeenCalledWith(['*.test.js', 'dist/**']);
        });

        it('should start background indexing on success', async () => {
            const result = await handlers.handleIndexCodebase({
                path: '/test/path'
            });

            expect(result.isError).toBeFalsy();
            expect(result.content[0].text).toContain('Started background indexing');
            expect(mockSnapshotManager.setCodebaseIndexing).toHaveBeenCalledWith('/test/path', 0);
            expect(mockSnapshotManager.saveCodebaseSnapshot).toHaveBeenCalled();
        });
    });

    describe('handleSearchCode', () => {
        it('should return error for non-existent path', async () => {
            mockedFs.existsSync.mockReturnValue(false);

            const result = await handlers.handleSearchCode({
                path: '/non/existent/path',
                query: 'test'
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('does not exist');
        });

        it('should return error for non-directory path', async () => {
            mockedFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

            const result = await handlers.handleSearchCode({
                path: '/path/to/file.txt',
                query: 'test'
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('not a directory');
        });

        it('should return error for non-indexed codebase', async () => {
            mockSnapshotManager.getIndexedCodebases.mockReturnValue([]);
            mockSnapshotManager.getIndexingCodebases.mockReturnValue([]);

            const result = await handlers.handleSearchCode({
                path: '/test/path',
                query: 'test'
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('not indexed');
        });

        it('should allow search during indexing with warning', async () => {
            mockSnapshotManager.getIndexingCodebases.mockReturnValue(['/test/path']);
            mockContext.semanticSearch.mockResolvedValue([{
                content: 'test code',
                relativePath: 'test.ts',
                startLine: 1,
                endLine: 5,
                language: 'typescript'
            }]);

            const result = await handlers.handleSearchCode({
                path: '/test/path',
                query: 'test query'
            });

            expect(result.isError).toBeFalsy();
            expect(result.content[0].text).toContain('Indexing in Progress');
        });

        it('should perform semantic search for indexed codebase', async () => {
            mockSnapshotManager.getIndexedCodebases.mockReturnValue(['/test/path']);
            mockContext.semanticSearch.mockResolvedValue([{
                content: 'function test() { return 42; }',
                relativePath: 'src/test.ts',
                startLine: 1,
                endLine: 3,
                language: 'typescript'
            }]);

            const result = await handlers.handleSearchCode({
                path: '/test/path',
                query: 'test function'
            });

            expect(result.isError).toBeFalsy();
            expect(mockContext.semanticSearch).toHaveBeenCalledWith(
                '/test/path',
                'test function',
                10,
                0.3,
                undefined
            );
            expect(result.content[0].text).toContain('Found 1 results');
        });

        it('should respect limit parameter', async () => {
            mockSnapshotManager.getIndexedCodebases.mockReturnValue(['/test/path']);
            mockContext.semanticSearch.mockResolvedValue([]);

            await handlers.handleSearchCode({
                path: '/test/path',
                query: 'test',
                limit: 5
            });

            expect(mockContext.semanticSearch).toHaveBeenCalledWith(
                '/test/path',
                'test',
                5,
                0.3,
                undefined
            );
        });

        it('should apply extension filter when provided', async () => {
            mockSnapshotManager.getIndexedCodebases.mockReturnValue(['/test/path']);
            mockContext.semanticSearch.mockResolvedValue([]);

            const result = await handlers.handleSearchCode({
                path: '/test/path',
                query: 'test',
                extensionFilter: ['.ts', '.tsx']
            });

            expect(result.isError).toBeFalsy();
            expect(mockContext.semanticSearch).toHaveBeenCalledWith(
                '/test/path',
                'test',
                10,
                0.3,
                expect.stringContaining("fileExtension in ['.ts', '.tsx']")
            );
        });

        it('should return error for invalid extension filter', async () => {
            mockSnapshotManager.getIndexedCodebases.mockReturnValue(['/test/path']);

            const result = await handlers.handleSearchCode({
                path: '/test/path',
                query: 'test',
                extensionFilter: ['invalid']
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('Invalid file extensions');
        });

        it('should handle empty search results', async () => {
            mockSnapshotManager.getIndexedCodebases.mockReturnValue(['/test/path']);
            mockContext.semanticSearch.mockResolvedValue([]);

            const result = await handlers.handleSearchCode({
                path: '/test/path',
                query: 'nonexistent'
            });

            expect(result.isError).toBeFalsy();
            expect(result.content[0].text).toContain('No results found');
        });
    });

    describe('handleClearIndex', () => {
        it('should return message when no codebases indexed', async () => {
            mockSnapshotManager.getIndexedCodebases.mockReturnValue([]);
            mockSnapshotManager.getIndexingCodebases.mockReturnValue([]);

            const result = await handlers.handleClearIndex({
                path: '/test/path'
            });

            expect(result.content[0].text).toBe('No codebases are currently indexed or being indexed.');
        });

        it('should return error for non-existent path', async () => {
            mockSnapshotManager.getIndexedCodebases.mockReturnValue(['/existing/path']);
            mockedFs.existsSync.mockImplementation((path) => path !== '/non/existent/path');

            const result = await handlers.handleClearIndex({
                path: '/non/existent/path'
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('does not exist');
        });

        it('should return error for non-directory path', async () => {
            mockSnapshotManager.getIndexedCodebases.mockReturnValue(['/test/path']);
            mockedFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

            const result = await handlers.handleClearIndex({
                path: '/test/path'
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('not a directory');
        });

        it('should return error for non-indexed codebase', async () => {
            mockSnapshotManager.getIndexedCodebases.mockReturnValue(['/other/path']);
            mockSnapshotManager.getIndexingCodebases.mockReturnValue([]);

            const result = await handlers.handleClearIndex({
                path: '/test/path'
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('not indexed or being indexed');
        });

        it('should clear index and remove from snapshot', async () => {
            mockSnapshotManager.getIndexedCodebases.mockReturnValue(['/test/path']);

            const result = await handlers.handleClearIndex({
                path: '/test/path'
            });

            expect(result.isError).toBeFalsy();
            expect(mockContext.clearIndex).toHaveBeenCalledWith('/test/path');
            expect(mockSnapshotManager.removeCodebaseCompletely).toHaveBeenCalledWith('/test/path');
            expect(mockSnapshotManager.saveCodebaseSnapshot).toHaveBeenCalled();
            expect(result.content[0].text).toContain('Successfully cleared');
        });

        it('should report remaining codebases after clear', async () => {
            mockSnapshotManager.getIndexedCodebases.mockReturnValue(['/test/path', '/other/path']);
            mockSnapshotManager.getIndexingCodebases.mockReturnValue([]);

            const result = await handlers.handleClearIndex({
                path: '/test/path'
            });

            expect(result.content[0].text).toContain('other indexed codebase');
        });
    });

    describe('handleGetIndexingStatus', () => {
        it('should return error for non-existent path', async () => {
            mockedFs.existsSync.mockReturnValue(false);

            const result = await handlers.handleGetIndexingStatus({
                path: '/non/existent/path'
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('does not exist');
        });

        it('should return error for non-directory path', async () => {
            mockedFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

            const result = await handlers.handleGetIndexingStatus({
                path: '/path/to/file.txt'
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('not a directory');
        });

        it('should return indexed status with stats', async () => {
            mockSnapshotManager.getCodebaseStatus.mockReturnValue('indexed');
            mockSnapshotManager.getCodebaseInfo.mockReturnValue({
                status: 'indexed',
                indexedFiles: 100,
                totalChunks: 500,
                indexStatus: 'completed',
                lastUpdated: '2024-01-01T00:00:00.000Z'
            });

            const result = await handlers.handleGetIndexingStatus({
                path: '/test/path'
            });

            expect(result.isError).toBeFalsy();
            expect(result.content[0].text).toContain('fully indexed');
            expect(result.content[0].text).toContain('100 files');
            expect(result.content[0].text).toContain('500 chunks');
        });

        it('should return indexing status with progress', async () => {
            mockSnapshotManager.getCodebaseStatus.mockReturnValue('indexing');
            mockSnapshotManager.getCodebaseInfo.mockReturnValue({
                status: 'indexing',
                indexingPercentage: 75.5,
                lastUpdated: '2024-01-01T00:00:00.000Z'
            });

            const result = await handlers.handleGetIndexingStatus({
                path: '/test/path'
            });

            expect(result.isError).toBeFalsy();
            expect(result.content[0].text).toContain('currently being indexed');
            expect(result.content[0].text).toContain('75.5%');
        });

        it('should return failed status with error', async () => {
            mockSnapshotManager.getCodebaseStatus.mockReturnValue('indexfailed');
            mockSnapshotManager.getCodebaseInfo.mockReturnValue({
                status: 'indexfailed',
                errorMessage: 'Out of memory',
                lastAttemptedPercentage: 50,
                lastUpdated: '2024-01-01T00:00:00.000Z'
            });

            const result = await handlers.handleGetIndexingStatus({
                path: '/test/path'
            });

            expect(result.isError).toBeFalsy();
            expect(result.content[0].text).toContain('indexing failed');
            expect(result.content[0].text).toContain('Out of memory');
            expect(result.content[0].text).toContain('50.0%');
        });

        it('should return not_found for unindexed codebase', async () => {
            mockSnapshotManager.getCodebaseStatus.mockReturnValue('not_found');

            const result = await handlers.handleGetIndexingStatus({
                path: '/test/path'
            });

            expect(result.isError).toBeFalsy();
            expect(result.content[0].text).toContain('not indexed');
        });
    });
});
