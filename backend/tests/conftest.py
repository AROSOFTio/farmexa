"""Shared pytest configuration for the Farmexa backend test suite."""

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
# Append (not prepend) so the installed `alembic` package is not shadowed by backend/alembic/.
if str(BACKEND_ROOT) not in sys.path:
    sys.path.append(str(BACKEND_ROOT))
