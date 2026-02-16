/**
 * Vector Database Factory
 *
 * Factory pattern for creating VectorDatabase instances based on configuration.
 * Supports multiple providers: milvus, sqlite-vec
 */

import { VectorDatabase, VectorDbProvider } from '../vectordb/types';
import { MilvusVectorDatabase, MilvusConfig } from '../vectordb/milvus-vectordb';
import { SqliteVecVectorDatabase, SqliteVecConfig } from '../vectordb/sqlite-vec-vectordb';

/**
 * Configuration for vector database factory
 */
export interface VectorDbFactoryConfig {
    provider: VectorDbProvider;
    milvus?: MilvusConfig;
    sqliteVec?: SqliteVecConfig;
}

/**
 * Get the vector database provider from environment variable
 * @returns The configured provider, defaults to 'sqlite-vec'
 */
export function getVectorDbProvider(): VectorDbProvider {
    const provider = process.env.VECTOR_DB_PROVIDER;

    if (provider === 'milvus') {
        return 'milvus';
    }

    // Default to sqlite-vec for new implementations
    return 'sqlite-vec';
}

/**
 * Create a VectorDatabase instance based on configuration
 * @param config - Factory configuration
 * @returns VectorDatabase instance
 */
export function createVectorDatabase(config: VectorDbFactoryConfig): VectorDatabase {
    switch (config.provider) {
        case 'milvus':
            return new MilvusVectorDatabase(config.milvus || {});

        case 'sqlite-vec':
            return new SqliteVecVectorDatabase(config.sqliteVec || {});

        default:
            // Exhaustive check - this should never happen with TypeScript
            throw new Error(`Unknown vector database provider: ${config.provider}`);
    }
}

/**
 * Create a VectorDatabase instance from environment configuration
 * Automatically selects provider based on VECTOR_DB_PROVIDER env var
 * @returns VectorDatabase instance
 */
export function createVectorDatabaseFromEnv(): VectorDatabase {
    const provider = getVectorDbProvider();

    const config: VectorDbFactoryConfig = {
        provider,
        milvus: {
            address: process.env.MILVUS_ADDRESS,
            token: process.env.MILVUS_TOKEN,
            username: process.env.MILVUS_USERNAME,
            password: process.env.MILVUS_PASSWORD,
            ssl: process.env.MILVUS_SSL === 'true'
        },
        sqliteVec: {
            dbPath: process.env.VECTOR_DB_PATH // Optional override
        }
    };

    return createVectorDatabase(config);
}

/**
 * Validate vector database configuration
 * @param config - Factory configuration to validate
 * @returns Validation result with errors if any
 */
export function validateVectorDbConfig(config: VectorDbFactoryConfig): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    switch (config.provider) {
        case 'milvus':
            if (!config.milvus?.address && !config.milvus?.token) {
                errors.push('Milvus provider requires address or token');
            }
            break;

        case 'sqlite-vec':
            // sqlite-vec has no required config (uses default paths)
            break;

        default:
            errors.push(`Unknown provider: ${config.provider}`);
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
