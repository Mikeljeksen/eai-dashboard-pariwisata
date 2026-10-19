"""Extractor CSV — tabel ekspor BPS (header bertingkat, UTF-8 dengan BOM)."""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from . import RawTable


def extract(paths: list[Path]) -> list[RawTable]:
    tables = []
    for p in sorted(paths):
        # dtype=str + keep_default_na=False: nilai seperti "-" atau "NA"
        # dibiarkan apa adanya agar bisa ditangani eksplisit saat Transform.
        df = pd.read_csv(p, header=None, dtype=str, keep_default_na=False, encoding="utf-8-sig")
        tables.append(RawTable(source_file=p.name, frame=df))
    return tables
