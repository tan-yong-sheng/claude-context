/**
 * Mock Embedding Provider for Tests
 *
 * Provides deterministic embeddings for testing without calling external APIs
 */

import { Embedding, EmbeddingVector } from '../embedding';

export const MOCK_EMBEDDING_DIMENSION = 1536;

/**
 * Generate deterministic mock embedding from text
 * Uses a simple hash-based approach for consistency
 */
export function mockEmbed(text: string): number[] {
    const embedding: number[] = new Array(MOCK_EMBEDDING_DIMENSION).fill(0);

    // Generate deterministic values based on character codes
    for (let i = 0; i < MOCK_EMBEDDING_DIMENSION; i++) {
        const charIndex = i % text.length;
        const charCode = text.charCodeAt(charIndex);
        // Create a value between -0.5 and 0.5
        embedding[i] = ((charCode + i * 31) % 100) / 100 - 0.5;
    }

    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
}

/**
 * Generate deterministic mock embedding from text with specified dimension
 */
export function mockEmbedWithDimension(text: string, dimension: number): number[] {
    const embedding: number[] = new Array(dimension).fill(0);

    // Generate deterministic values based on character codes
    for (let i = 0; i < dimension; i++) {
        const charIndex = i % text.length;
        const charCode = text.charCodeAt(charIndex);
        // Create a value between -0.5 and 0.5
        embedding[i] = ((charCode + i * 31) % 100) / 100 - 0.5;
    }

    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
}

/**
 * Mock Embedding Provider class
 */
export class MockEmbeddingProvider extends Embedding {
    protected maxTokens: number = 8000;
    private dimension: number;

    constructor(dimension: number = MOCK_EMBEDDING_DIMENSION) {
        super();
        this.dimension = dimension;
    }

    async embed(text: string): Promise<EmbeddingVector> {
        const vector = mockEmbedWithDimension(text, this.dimension);
        return {
            vector,
            dimension: vector.length
        };
    }

    async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
        return Promise.all(texts.map(text => this.embed(text)));
    }

    async detectDimension(_testText?: string): Promise<number> {
        return this.dimension;
    }

    getDimension(): number {
        return this.dimension;
    }

    getProvider(): string {
        return 'mock';
    }
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        magnitudeA += a[i] * a[i];
        magnitudeB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

/**
 * Check if two embeddings are similar (for assertions)
 */
export function areEmbeddingsSimilar(
    a: number[],
    b: number[],
    threshold: number = 0.95
): boolean {
    return cosineSimilarity(a, b) >= threshold;
}
