/**
 * Main entry point for the TypeScript project
 */

import { capitalize, reverse, countWords } from './utils';
import { parseCode, extractComments } from './parser';

export { capitalize, reverse, countWords, parseCode, extractComments };

export function main(): void {
    console.log('TypeScript project loaded');
}
