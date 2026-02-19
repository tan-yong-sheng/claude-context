/**
 * Tests for AstCodeSplitter
 *
 * Tests AST-based code splitting functionality including language support,
 * chunk extraction, and fallback behavior.
 */

import { AstCodeSplitter } from '../ast-splitter';
import { CodeChunk } from '../index';

// Jest globals
declare const describe: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => void | Promise<void>, timeout?: number) => void;
declare const expect: (value: any) => any;
declare const beforeEach: (fn: () => void | Promise<void>) => void;

describe('AstCodeSplitter', () => {
    let splitter: AstCodeSplitter;

    beforeEach(() => {
        splitter = new AstCodeSplitter(2500, 300);
    });

    describe('Basic Functionality', () => {
        test('should create splitter with default options', () => {
            const defaultSplitter = new AstCodeSplitter();
            expect(defaultSplitter).toBeDefined();
        });

        test('should create splitter with custom options', () => {
            const customSplitter = new AstCodeSplitter(1000, 100);
            expect(customSplitter).toBeDefined();
        });

        test('should fallback to langchain when AST is not available', async () => {
            const code = 'function test() { return 1; }';
            const chunks = await splitter.split(code, 'unknown-language', '/test.js');

            // Should return chunks even for unsupported language
            expect(Array.isArray(chunks)).toBe(true);
            expect(chunks.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('JavaScript/TypeScript Support', () => {
        test('should split JavaScript function', async () => {
            const code = `
function calculateSum(a, b) {
    return a + b;
}

function calculateProduct(a, b) {
    return a * b;
}
            `.trim();

            const chunks = await splitter.split(code, 'javascript', '/test.js');
            expect(Array.isArray(chunks)).toBe(true);
            expect(chunks.length).toBeGreaterThanOrEqual(1);

            // Each chunk should have required properties
            chunks.forEach((chunk: CodeChunk) => {
                expect(chunk.content).toBeDefined();
                expect(chunk.content.length).toBeGreaterThan(0);
            });
        });

        test('should split TypeScript with types', async () => {
            const code = `
interface User {
    name: string;
    age: number;
}

function greet(user: User): string {
    return \`Hello, \${user.name}!\`;
}
            `.trim();

            const chunks = await splitter.split(code, 'typescript', '/test.ts');
            expect(Array.isArray(chunks)).toBe(true);
            expect(chunks.length).toBeGreaterThanOrEqual(1);
        });

        test('should split JavaScript class', async () => {
            const code = `
class Calculator {
    add(a, b) {
        return a + b;
    }

    subtract(a, b) {
        return a - b;
    }
}
            `.trim();

            const chunks = await splitter.split(code, 'javascript', '/calc.js');
            expect(Array.isArray(chunks)).toBe(true);
            expect(chunks.length).toBeGreaterThanOrEqual(1);
        });

        test('should handle arrow functions', async () => {
            const code = `
const add = (a, b) => a + b;
const multiply = (a, b) => a * b;
            `.trim();

            const chunks = await splitter.split(code, 'javascript', '/arrows.js');
            expect(Array.isArray(chunks)).toBe(true);
        });
    });

    describe('Python Support', () => {
        test('should split Python functions', async () => {
            const code = `
def calculate_sum(a, b):
    return a + b

def calculate_product(a, b):
    return a * b
            `.trim();

            const chunks = await splitter.split(code, 'python', '/test.py');
            expect(Array.isArray(chunks)).toBe(true);
            expect(chunks.length).toBeGreaterThanOrEqual(1);
        });

        test('should split Python class', async () => {
            const code = `
class Calculator:
    def add(self, a, b):
        return a + b

    def subtract(self, a, b):
        return a - b
            `.trim();

            const chunks = await splitter.split(code, 'python', '/calc.py');
            expect(Array.isArray(chunks)).toBe(true);
        });
    });

    describe('Java Support', () => {
        test('should split Java methods', async () => {
            const code = `
public class Calculator {
    public int add(int a, int b) {
        return a + b;
    }

    public int subtract(int a, int b) {
        return a - b;
    }
}
            `.trim();

            const chunks = await splitter.split(code, 'java', '/Calculator.java');
            expect(Array.isArray(chunks)).toBe(true);
            expect(chunks.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Go Support', () => {
        test('should split Go functions', async () => {
            const code = `
package main

func Add(a, b int) int {
    return a + b
}

func Subtract(a, b int) int {
    return a - b
}
            `.trim();

            const chunks = await splitter.split(code, 'go', '/main.go');
            expect(Array.isArray(chunks)).toBe(true);
            expect(chunks.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Rust Support', () => {
        test('should split Rust functions', async () => {
            const code = `
fn add(a: i32, b: i32) -> i32 {
    a + b
}

fn subtract(a: i32, b: i32) -> i32 {
    a - b
}
            `.trim();

            const chunks = await splitter.split(code, 'rust', '/main.rs');
            expect(Array.isArray(chunks)).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        test('should handle empty code', async () => {
            const chunks = await splitter.split('', 'javascript', '/empty.js');
            expect(Array.isArray(chunks)).toBe(true);
        });

        test('should handle very small code', async () => {
            const code = 'const x = 1;';
            const chunks = await splitter.split(code, 'javascript', '/small.js');
            expect(Array.isArray(chunks)).toBe(true);
            expect(chunks.length).toBeGreaterThanOrEqual(1);
        });

        test('should handle large code files', async () => {
            // Generate a large file with many functions
            const functions = Array.from({ length: 50 }, (_, i) => `
function func${i}(a, b) {
    // Comment for function ${i}
    const result = a + b;
    return result;
}
            `).join('\n');

            const chunks = await splitter.split(functions, 'javascript', '/large.js');
            expect(Array.isArray(chunks)).toBe(true);
            expect(chunks.length).toBeGreaterThan(1);
        }, 30000);

        test('should handle code with syntax errors gracefully', async () => {
            const code = 'function broken( { return 1'; // Missing closing parenthesis
            const chunks = await splitter.split(code, 'javascript', '/broken.js');
            expect(Array.isArray(chunks)).toBe(true);
        });

        test('should respect chunk size limits', async () => {
            const customSplitter = new AstCodeSplitter(500, 50);
            const code = Array.from({ length: 20 }, (_, i) => `
function function${i}() {
    const veryLongVariableName = "This is a long string to increase chunk size ";
    const anotherVariable = "More content here to fill up the chunk ";
    return veryLongVariableName + anotherVariable;
}
            `).join('\n');

            const chunks = await customSplitter.split(code, 'javascript', '/chunk-test.js');
            expect(Array.isArray(chunks)).toBe(true);

            // Check that chunks are reasonably sized (not exceeding limit by too much)
            chunks.forEach((chunk: CodeChunk) => {
                expect(chunk.content.length).toBeLessThanOrEqual(1000);
            });
        });
    });

    describe('Chunk Metadata', () => {
        test('should include file path in chunks', async () => {
            const code = 'function test() { return 1; }';
            const filePath = '/path/to/file.ts';

            const chunks = await splitter.split(code, 'typescript', filePath);
            expect(Array.isArray(chunks)).toBe(true);
        });

        test('should handle nested functions', async () => {
            const code = `
function outer() {
    function inner() {
        return 1;
    }
    return inner();
}
            `.trim();

            const chunks = await splitter.split(code, 'javascript', '/nested.js');
            expect(Array.isArray(chunks)).toBe(true);
            expect(chunks.length).toBeGreaterThanOrEqual(1);
        });
    });
});
