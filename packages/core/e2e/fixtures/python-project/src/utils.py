"""
String utilities for text processing
"""


def capitalize(text: str) -> str:
    """Capitalize the first letter of a string."""
    return text[0].upper() + text[1:]


def reverse(text: str) -> str:
    """Reverse a string."""
    return text[::-1]


def count_words(text: str) -> int:
    """Count the number of words in a string."""
    return len(text.strip().split())


def is_palindrome(text: str) -> bool:
    """Check if a string is a palindrome."""
    cleaned = ''.join(c.lower() for c in text if c.isalnum())
    return cleaned == reverse(cleaned)
