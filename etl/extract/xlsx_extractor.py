"""Extractor XLSX — workbook ekspor tabel statistik BPS (sheet pertama)."""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from . import RawTable


def extract(paths: list[Path]) -> list[RawTable]:
    tables = []
    for p in sorted(paths):
        df = pd.read_excel(p, header=None, dtype=str, keep_default_na=False, engine="openpyxl")
        tables.append(RawTable(source_file=p.name, frame=df))
    return tables
