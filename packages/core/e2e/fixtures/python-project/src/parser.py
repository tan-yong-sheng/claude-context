"""
Code parser for analyzing Python files
"""

import ast
import re
from typing import List, Dict, Any


def parse_code(source: str) -> Dict[str, List[str]]:
    """Parse Python source code and extract functions, classes, and imports."""
    result = {
        'functions': [],
        'classes': [],
        'imports': []
    }

    try:
        tree = ast.parse(source)
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                result['functions'].append(node.name)
            elif isinstance(node, ast.ClassDef):
                result['classes'].append(node.name)
            elif isinstance(node, ast.Import):
                for alias in node.names:
                    result['imports'].append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                module = node.module or ''
                result['imports'].append(module)
    except SyntaxError:
        pass

    return result


def extract_docstrings(source: str) -> List[str]:
    """Extract docstrings from Python source code."""
    docstrings = []
    try:
        tree = ast.parse(source)
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.ClassDef)):
                if ast.get_docstring(node):
                    docstrings.append(ast.get_docstring(node))
    except SyntaxError:
        pass
    return docstrings


def extract_comments(source: str) -> List[str]:
    """Extract comments from Python source code."""
    comments = []
    lines = source.split('\n')
    for line in lines:
        if '#' in line:
            comment = line[line.index('#')+1:].strip()
            if comment:
                comments.append(comment)
    return comments
