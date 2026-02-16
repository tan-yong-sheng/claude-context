/**
 * Mock for @google/genai module
 * Used in E2E tests to avoid ES module issues
 */

export class GoogleGenAI {
    constructor(_config: { apiKey: string }) {
        // Mock constructor
    }

    get models() {
        return {
            embedContent: async (_config: any) => {
                return {
                    embedding: {
                        values: new Array(768).fill(0.1),
                    },
                };
            },
        };
    }
}

export default GoogleGenAI;
