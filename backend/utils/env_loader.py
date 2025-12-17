"""Small helper to load backend/.env without requiring python-dotenv."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

_ENV_CACHE_FLAG = "__BACKEND_ENV_LOADED__"


def _parse_env_line(line: str) -> Optional[tuple[str, str]]:
    line = line.strip()
    if not line or line.startswith("#"):
        return None
    if "=" not in line:
        return None
    key, value = line.split("=", 1)
    return key.strip(), value.strip()


def load_backend_env(explicit_path: Optional[str] = None) -> None:
    """Populate os.environ with values from backend/.env once per process."""
    if os.environ.get(_ENV_CACHE_FLAG):
        return

    candidate = None
    if explicit_path:
        candidate = Path(explicit_path)
    else:
        # utils/env_loader.py -> backend/utils -> backend
        candidate = Path(__file__).resolve().parents[1] / ".env"

    if not candidate.exists():
        return

    try:
        with candidate.open("r", encoding="utf-8") as handle:
            for raw_line in handle:
                parsed = _parse_env_line(raw_line)
                if not parsed:
                    continue
                key, value = parsed
                # Do not override explicit environment variables
                os.environ.setdefault(key, value)
    finally:
        # Mark as attempted so we do not re-read repeatedly even if file missing
        os.environ[_ENV_CACHE_FLAG] = "1"
