"""Compatibility entrypoint.

Allows running:
  uvicorn app.main:app

The canonical app instance is defined in the top-level `main.py`.
"""

from main import app  # noqa: F401
