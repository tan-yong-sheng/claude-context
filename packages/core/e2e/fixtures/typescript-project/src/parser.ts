/**
 * Code parser for analyzing TypeScript files
 */

export interface ParseResult {
    functions: string[];
    classes: string[];
    imports: string[];
}

export function parseCode(source: string): ParseResult {
    const functions: string[] = [];
    const classes: string[] = [];
    const imports: string[] = [];

    // Simple regex-based parsing for demo
    const functionMatches = source.match(/function\s+(\w+)/g);
    if (functionMatches) {
        functionMatches.forEach(match => {
            const name = match.replace('function ', '');
            functions.push(name);
        });
    }

    const classMatches = source.match(/class\s+(\w+)/g);
    if (classMatches) {
        classMatches.forEach(match => {
            const name = match.replace('class ', '');
            classes.push(name);
        });
    }

    const importMatches = source.match(/import\s+.*?\s+from\s+['"](.+?)['"]/g);
    if (importMatches) {
        importMatches.forEach(match => {
            const path = match.match(/from\s+['"](.+?)['"]/)?.[1];
            if (path) imports.push(path);
        });
    }

    return { functions, classes, imports };
}

export function extractComments(source: string): string[] {
    const comments: string[] = [];
    const lines = source.split('\n');

    for (const line of lines) {
        const commentIndex = line.indexOf('//');
        if (commentIndex !== -1) {
            comments.push(line.slice(commentIndex + 2).trim());
        }
    }

    return comments;
}
