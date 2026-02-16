/**
 * Mock for tree-sitter module
 * Used in E2E tests to avoid native build issues
 */

export default class Parser {
    private language: any = null;

    setLanguage(lang: any): void {
        this.language = lang;
    }

    parse(source: string): any {
        // Mock parse that returns a simple tree structure
        return {
            rootNode: {
                type: 'program',
                text: source,
                children: [],
                startPosition: { row: 0, column: 0 },
                endPosition: {
                    row: source.split('\n').length - 1,
                    column: source.split('\n').pop()?.length || 0,
                },
            },
            delete: () => {},
        };
    }

    getLanguage(): any {
        return this.language;
    }
}

// Mock Language class
export class Language {
    constructor(_name: string, _grammar: any) {}
}
