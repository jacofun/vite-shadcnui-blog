#!/usr/bin/env python3
"""Remove repeated BBC 6 Minute English PDF footers from extracted text."""

from __future__ import annotations

import argparse
import re
from pathlib import Path


FOOTER_PATTERNS = (
    re.compile(
        r"^\s*6 Minute English\s+©\s*"
        r"British Broadcasting Corporation\s+20\d{2}\s*$"
    ),
    re.compile(
        r"^\s*bbclearningenglish\.com\s+"
        r"Page\s+\d+\s+of\s+\d+\s*$"
    ),
)


def clean_transcript(text: str) -> tuple[str, int]:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n").replace("\f", "\n")
    retained_lines: list[str] = []
    removed_lines = 0

    for line in normalized.split("\n"):
        matchable_line = line.replace("\u00a0", " ")
        if any(pattern.fullmatch(matchable_line) for pattern in FOOTER_PATTERNS):
            removed_lines += 1
            continue
        retained_lines.append(line.rstrip())

    cleaned = "\n".join(retained_lines)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    return f"{cleaned}\n", removed_lines


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path)
    parser.add_argument(
        "--require-match",
        action="store_true",
        help="Fail when no known footer line is found.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source_text = args.source.read_text(encoding="utf-8")
    cleaned_text, removed_lines = clean_transcript(source_text)

    if args.require_match and removed_lines == 0:
        raise SystemExit("No known BBC transcript footer lines were found.")

    args.target.write_text(cleaned_text, encoding="utf-8", newline="\n")
    print(f"Removed {removed_lines} BBC transcript footer lines.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
