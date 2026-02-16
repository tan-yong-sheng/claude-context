/**
 * String utilities for text processing
 */

export function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

export function reverse(text: string): string {
    return text.split('').reverse().join('');
}

export function countWords(text: string): number {
    return text.trim().split(/\s+/).length;
}

export function isPalindrome(text: string): boolean {
    const cleaned = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleaned === reverse(cleaned);
}
