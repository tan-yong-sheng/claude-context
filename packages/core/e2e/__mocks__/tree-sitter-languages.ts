/**
 * Mock for tree-sitter language parsers
 * Used in E2E tests to avoid native build issues
 */

// Mock language object structure
const createMockLanguage = (name: string) => ({
    name,
    nodeTypeInfo: [],
});

// Export mock languages
export const javascript = createMockLanguage('javascript');
export const typescript = {
    typescript: createMockLanguage('typescript'),
    tsx: createMockLanguage('tsx'),
};
export const python = createMockLanguage('python');
export const java = createMockLanguage('java');
export const go = createMockLanguage('go');
export const cpp = createMockLanguage('cpp');
export const rust = createMockLanguage('rust');
export const csharp = createMockLanguage('c_sharp');
export const scala = createMockLanguage('scala');

// Default exports for CommonJS compatibility
export default createMockLanguage('default');
