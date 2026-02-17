/**
 * Unit Tests for EnvManager
 *
 * Tests environment variable management with file fallback
 */

import * as fs from 'fs';
import * as path from 'path';

// Mock fs module before importing EnvManager
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
}));

// Mock os module
jest.mock('os', () => ({
    homedir: jest.fn().mockReturnValue('/home/testuser'),
}));

// Import after mocks are set up
import { EnvManager } from '../env-manager';
import * as os from 'os';

describe('EnvManager', () => {
    let envManager: EnvManager;
    const mockHomeDir = '/home/testuser';
    const mockEnvFilePath = path.join(mockHomeDir, '.context', '.env');

    beforeEach(() => {
        jest.clearAllMocks();
        (os.homedir as jest.Mock).mockReturnValue(mockHomeDir);
        envManager = new EnvManager();
        // Clear process.env before each test
        delete process.env.TEST_VAR;
        delete process.env.EMBEDDING_DIMENSION;
        delete process.env.EMBEDDING_BATCH_SIZE;
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    describe('get()', () => {
        test('returns value from process.env when available', () => {
            process.env.TEST_VAR = 'process-value';
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue('TEST_VAR=file-value');

            const result = envManager.get('TEST_VAR');

            expect(result).toBe('process-value');
            expect(fs.existsSync).not.toHaveBeenCalled();
        });

        test('returns value from file when not in process.env', () => {
            delete process.env.TEST_VAR;
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue('TEST_VAR=file-value\nOTHER=value');

            const result = envManager.get('TEST_VAR');

            expect(result).toBe('file-value');
            expect(fs.existsSync).toHaveBeenCalledWith(mockEnvFilePath);
        });

        test('returns undefined when not found anywhere', () => {
            delete process.env.TEST_VAR;
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            const result = envManager.get('TEST_VAR');

            expect(result).toBeUndefined();
        });

        test('returns undefined when file exists but variable not in file', () => {
            delete process.env.TEST_VAR;
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue('OTHER=value\nANOTHER=test');

            const result = envManager.get('TEST_VAR');

            expect(result).toBeUndefined();
        });

        test('handles empty file gracefully', () => {
            delete process.env.TEST_VAR;
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue('');

            const result = envManager.get('TEST_VAR');

            expect(result).toBeUndefined();
        });

        test('handles file read errors gracefully', () => {
            delete process.env.TEST_VAR;
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockImplementation(() => {
                throw new Error('Permission denied');
            });

            const result = envManager.get('TEST_VAR');

            expect(result).toBeUndefined();
        });

        test('handles values with equals signs correctly', () => {
            delete process.env.TEST_VAR;
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue('TEST_VAR=key=value=123');

            const result = envManager.get('TEST_VAR');

            expect(result).toBe('key=value=123');
        });

        test('handles empty values', () => {
            delete process.env.TEST_VAR;
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue('TEST_VAR=');

            const result = envManager.get('TEST_VAR');

            expect(result).toBe('');
        });

        test('handles whitespace in values (trimmed)', () => {
            delete process.env.TEST_VAR;
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue('TEST_VAR=  value with spaces  ');

            const result = envManager.get('TEST_VAR');

            // The env manager trims the entire line, so trailing spaces are removed
            expect(result).toBe('  value with spaces');
        });

        test('prioritizes exact match over partial match', () => {
            delete process.env.TEST_VAR;
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue('TEST_VAR=correct\nTEST_VAR_EXTENDED=wrong');

            const result = envManager.get('TEST_VAR');

            expect(result).toBe('correct');
        });
    });

    describe('set()', () => {
        test('creates new file with variable when file does not exist', () => {
            (fs.existsSync as jest.Mock)
                .mockReturnValueOnce(false)  // env dir check
                .mockReturnValueOnce(false); // file check

            envManager.set('NEW_VAR', 'new-value');

            expect(fs.mkdirSync).toHaveBeenCalledWith(path.dirname(mockEnvFilePath), { recursive: true });
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                mockEnvFilePath,
                'NEW_VAR=new-value\n',
                'utf-8'
            );
        });

        test('appends variable to existing file', () => {
            (fs.existsSync as jest.Mock)
                .mockReturnValueOnce(true)   // env dir check
                .mockReturnValueOnce(true);  // file check
            (fs.readFileSync as jest.Mock).mockReturnValue('EXISTING=value\n');

            envManager.set('NEW_VAR', 'new-value');

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                mockEnvFilePath,
                'EXISTING=value\nNEW_VAR=new-value\n',
                'utf-8'
            );
        });

        test('updates existing variable in file', () => {
            (fs.existsSync as jest.Mock)
                .mockReturnValueOnce(true)   // env dir check
                .mockReturnValueOnce(true);  // file check
            (fs.readFileSync as jest.Mock).mockReturnValue('VAR=old-value\nOTHER=other-value\n');

            envManager.set('VAR', 'new-value');

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                mockEnvFilePath,
                'VAR=new-value\nOTHER=other-value\n',
                'utf-8'
            );
        });

        test('throws error when write fails', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);
            (fs.writeFileSync as jest.Mock).mockImplementation(() => {
                throw new Error('Disk full');
            });

            expect(() => envManager.set('VAR', 'value')).toThrow('Disk full');
        });
    });

    describe('getEnvFilePath()', () => {
        test('returns correct env file path', () => {
            const result = envManager.getEnvFilePath();
            expect(result).toBe(mockEnvFilePath);
        });
    });

    describe('Embedding-related environment variables', () => {
        test('retrieves EMBEDDING_DIMENSION', () => {
            process.env.EMBEDDING_DIMENSION = '1536';

            const result = envManager.get('EMBEDDING_DIMENSION');

            expect(result).toBe('1536');
        });

        test('retrieves EMBEDDING_BATCH_SIZE', () => {
            process.env.EMBEDDING_BATCH_SIZE = '100';

            const result = envManager.get('EMBEDDING_BATCH_SIZE');

            expect(result).toBe('100');
        });

        test('returns undefined for unset embedding variables', () => {
            delete process.env.EMBEDDING_DIMENSION;
            delete process.env.EMBEDDING_BATCH_SIZE;
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            const dimension = envManager.get('EMBEDDING_DIMENSION');
            const batchSize = envManager.get('EMBEDDING_BATCH_SIZE');

            expect(dimension).toBeUndefined();
            expect(batchSize).toBeUndefined();
        });
    });
});
