#!/usr/bin/env python3
"""
Hoogt de cache-versie in sw-trends.js met 1 op en het versiestempel in trends.html,
zodat gebruikers na een update de nieuwste bestanden krijgen én de app de nieuwe versie
kan melden. Die twee moesten eerder los van elkaar worden bijgewerkt; het stempel ging
daardoor mis.

Gebruik:
    python3 update_cache_version.py

Verwacht dat dit script in dezelfde map staat als sw-trends.js (of pas SW_PATH
hieronder aan).
"""

import datetime
import re
import sys
from pathlib import Path

SW_PATH = Path(__file__).parent / "sw-trends.js"
VERSION_RE = re.compile(r"const CACHE_VERSION = 'trends-v(\d+)';")


STAMP_PATH = Path(__file__).parent / "trends.html"
STAMP_RE = re.compile(r'(<div id="app-version-stamp">Versie )([0-9A-F]+)-([0-9]+)(</div>)')


def bump_stamp():
    """Hoogt het versiestempel in trends.html op.

    Het stempel is de datum als hex plus een volgnummer (20260820 -> 13527D4-003). Het
    voedt de nieuwe-versie-melding in de app, los van CACHE_VERSION. Het moest met de hand
    worden opgehoogd, en liep daardoor aantoonbaar achter: vergeet je het, dan ziet de
    updatecontrole geen nieuwe versie en blijft de melding uit.
    """
    if not STAMP_PATH.exists():
        print(f"Kan {STAMP_PATH} niet vinden; stempel niet bijgewerkt.", file=sys.stderr)
        return

    text = STAMP_PATH.read_text(encoding="utf-8")
    match = STAMP_RE.search(text)
    if not match:
        print("Kon het versiestempel niet vinden in trends.html.", file=sys.stderr)
        return

    vandaag = format(int(datetime.date.today().strftime("%Y%m%d")), "X")
    oude_datum, oud_nr = match.group(2), match.group(3)
    # Nieuwe dag: opnieuw bij 001 beginnen. Zelfde dag: volgnummer omhoog.
    nieuw_nr = 1 if vandaag != oude_datum else int(oud_nr) + 1
    nieuw = f"{vandaag}-{nieuw_nr:03d}"

    STAMP_PATH.write_text(STAMP_RE.sub(rf"\g<1>{nieuw}\g<4>", text, count=1), encoding="utf-8")
    print(f"Versiestempel bijgewerkt: {oude_datum}-{oud_nr} -> {nieuw}")


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
    bump_stamp()
    print("Vergeet niet trends.html en sw-trends.js samen opnieuw te uploaden.")


if __name__ == "__main__":
    main()
