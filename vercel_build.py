"""Vercel build script.

Builds the frontend app into ``frontend/dist`` so Flask can serve it,
and ensures runtime directories exist for serverless execution.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT_DIR / "frontend"


def run(command: list[str], cwd: Path | None = None) -> None:
    subprocess.run(command, cwd=str(cwd or ROOT_DIR), check=True)


def build() -> None:
    os.makedirs(ROOT_DIR / "instance", exist_ok=True)

    if not FRONTEND_DIR.exists():
        raise FileNotFoundError("frontend directory not found.")

    package_lock = FRONTEND_DIR / "package-lock.json"
    if package_lock.exists():
        run(["npm", "ci"], cwd=FRONTEND_DIR)
    else:
        run(["npm", "install"], cwd=FRONTEND_DIR)

    run(["npm", "run", "build:vercel"], cwd=FRONTEND_DIR)


if __name__ == "__main__":
    try:
        build()
    except Exception as error:  # pragma: no cover - deployment script
        print(f"Vercel build failed: {error}", file=sys.stderr)
        raise
