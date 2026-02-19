import OpenAI from 'openai';
import { Embedding, EmbeddingVector } from './base-embedding';

export interface OpenAIEmbeddingConfig {
    model: string;
    apiKey: string;
    baseURL?: string; // OpenAI supports custom baseURL
    dimension?: number; // Optional: manually specify dimension to avoid API detection
}

export class OpenAIEmbedding extends Embedding {
    private client: OpenAI;
    private config: OpenAIEmbeddingConfig;
    private dimension: number = 1536; // Default dimension for text-embedding-3-small
    protected maxTokens: number = 8192; // Maximum tokens for OpenAI embedding models

    constructor(config: OpenAIEmbeddingConfig) {
        super();
        this.config = config;
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseURL,
        });
        // Use configured dimension if provided
        if (config.dimension && config.dimension > 0) {
            this.dimension = config.dimension;
            console.log(`[OpenAIEmbedding] Using configured dimension: ${config.dimension}`);
        }
    }

    async detectDimension(_testText?: string): Promise<number> {
        const model = this.config.model || 'text-embedding-3-small';
        const knownModels = OpenAIEmbedding.getSupportedModels();

        // Use known dimension for standard models - NO API CALL
        if (knownModels[model]) {
            return knownModels[model].dimension;
        }

        // For custom models, dimension must be configured - throw error instead of API call
        throw new Error(
            `Cannot auto-detect dimension for custom OpenAI model '${model}'. ` +
            `Please manually configure the embedding dimension in your settings.\n\n` +
            `Known models: ${Object.keys(knownModels).join(', ')}`
        );
    }

    async embed(text: string): Promise<EmbeddingVector> {
        const processedText = this.preprocessText(text);
        const model = this.config.model || 'text-embedding-3-small';

        const knownModels = OpenAIEmbedding.getSupportedModels();
        if (knownModels[model] && this.dimension !== knownModels[model].dimension) {
            this.dimension = knownModels[model].dimension;
        }
        // For custom models: dimension MUST be configured via config.dimension
        // NO auto-detection via API to avoid unnecessary calls

        try {
            console.log(`[OpenAIEmbedding] 🌐 Calling embedding API for 1 text (${processedText.length} chars)...`);
            const response = await this.client.embeddings.create({
                model: model,
                input: processedText,
                encoding_format: 'float',
            });
            console.log(`[OpenAIEmbedding] ✅ Received embedding (dimension: ${response.data[0].embedding.length})`);

            // Update dimension from actual response (optional - for verification)
            this.dimension = response.data[0].embedding.length;

            return {
                vector: response.data[0].embedding,
                dimension: this.dimension
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to generate OpenAI embedding: ${errorMessage}`);
        }
    }

    async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
        const processedTexts = this.preprocessTexts(texts);
        const model = this.config.model || 'text-embedding-3-small';

        const knownModels = OpenAIEmbedding.getSupportedModels();
        if (knownModels[model] && this.dimension !== knownModels[model].dimension) {
            this.dimension = knownModels[model].dimension;
        }
        // For custom models: dimension MUST be configured via config.dimension
        // NO auto-detection via API to avoid unnecessary calls

        try {
            const totalChars = processedTexts.reduce((sum, text) => sum + text.length, 0);
            console.log(`[OpenAIEmbedding] 🌐 Calling embedding API for ${processedTexts.length} texts (~${Math.round(totalChars / 4)} tokens)...`);
            const response = await this.client.embeddings.create({
                model: model,
                input: processedTexts,
                encoding_format: 'float',
            });
            console.log(`[OpenAIEmbedding] ✅ Received ${response.data.length} embeddings`);

            this.dimension = response.data[0].embedding.length;

            return response.data.map((item) => ({
                vector: item.embedding,
                dimension: this.dimension
            }));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to generate OpenAI batch embeddings: ${errorMessage}`);
        }
    }

    getDimension(): number {
        // For known models, return the known dimension
        const model = this.config.model || 'text-embedding-3-small';
        const knownModels = OpenAIEmbedding.getSupportedModels();

        // If it's a known model, return its known dimension
        if (knownModels[model]) {
            return knownModels[model].dimension;
        }

        // For custom models, return configured dimension if set
        if (this.config.dimension && this.config.dimension > 0) {
            return this.config.dimension;
        }

        // For unknown custom models without configured dimension, return 0
        // This signals to the caller that dimension needs to be manually configured
        return 0;
    }

    getProvider(): string {
        return 'OpenAI';
    }

    /**
     * Set model type
     * @param model Model name
     */
    async setModel(model: string): Promise<void> {
        this.config.model = model;
        const knownModels = OpenAIEmbedding.getSupportedModels();
        if (knownModels[model]) {
            this.dimension = knownModels[model].dimension;
        } else {
            this.dimension = await this.detectDimension();
        }
    }

    /**
     * Get client instance (for advanced usage)
     */
    getClient(): OpenAI {
        return this.client;
    }

    /**
     * Get list of supported models
     */
    static getSupportedModels(): Record<string, { dimension: number; description: string }> {
        return {
            'text-embedding-3-small': {
                dimension: 1536,
                description: 'High performance and cost-effective embedding model (recommended)'
            },
            'text-embedding-3-large': {
                dimension: 3072,
                description: 'Highest performance embedding model with larger dimensions'
            },
            'text-embedding-ada-002': {
                dimension: 1536,
                description: 'Legacy model (use text-embedding-3-small instead)'
            }
        };
    }
} 