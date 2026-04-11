"""Vercel serverless entry point for AI Meeting Agent."""

import os
import sys

# Ensure repository root is importable.
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from main_app import create_app

app = create_app()
