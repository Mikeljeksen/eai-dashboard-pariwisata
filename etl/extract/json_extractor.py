"""Extractor JSON — respons World Bank API v2 ([metadata, records])."""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from . import RawTable


def extract(paths: list[Path]) -> list[RawTable]:
    tables = []
    for p in sorted(paths):
        payload = json.loads(p.read_text(encoding="utf-8"))
        meta, records = payload[0], payload[1]
        # flatten objek bersarang: indicator.id, country.value, dst.
        df = pd.json_normalize(records)
        tables.append(RawTable(source_file=p.name, frame=df, meta=meta))
    return tables
