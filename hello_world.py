#!/usr/bin/env python3
"""
Hello World program in Python.
This module provides a hello_world function and a CLI entry point.
"""


def hello_world():
    """Return the classic hello world string."""
    return "Hello, World!"


def main():
    """Print the hello world string to stdout."""
    print(hello_world())


if __name__ == "__main__":
    main()
