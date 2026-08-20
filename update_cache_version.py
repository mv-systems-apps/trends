#!/usr/bin/env python3
"""
Hoogt de cache-versie in sw-trends.js met 1 op, zodat gebruikers na een update
automatisch de nieuwste bestanden krijgen i.p.v. een verouderde cache.

Gebruik:
    python3 update_cache_version.py

Verwacht dat dit script in dezelfde map staat als sw-trends.js (of pas SW_PATH
hieronder aan).
"""

import re
import sys
from pathlib import Path

SW_PATH = Path(__file__).parent / "sw-trends.js"
VERSION_RE = re.compile(r"const CACHE_VERSION = 'trends-v(\d+)';")


def main():
    if not SW_PATH.exists():
        print(f"Kan {SW_PATH} niet vinden.", file=sys.stderr)
        sys.exit(1)

    text = SW_PATH.read_text(encoding="utf-8")
    match = VERSION_RE.search(text)
    if not match:
        print("Kon CACHE_VERSION niet vinden in sw-trends.js.", file=sys.stderr)
        sys.exit(1)

    old_version = int(match.group(1))
    new_version = old_version + 1
    new_text = VERSION_RE.sub(f"const CACHE_VERSION = 'trends-v{new_version}';", text, count=1)

    SW_PATH.write_text(new_text, encoding="utf-8")
    print(f"Cache-versie bijgewerkt: trends-v{old_version} -> trends-v{new_version}")
    print("Vergeet niet sw-trends.js opnieuw te uploaden naar GitHub Pages.")


if __name__ == "__main__":
    main()
