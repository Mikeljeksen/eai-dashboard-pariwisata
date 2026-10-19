"""Tahap EXTRACT — satu modul per format sumber.

Setiap extractor hanya *membaca* file mentah apa adanya (semua sel sebagai
teks) tanpa membersihkan nilai. Pembersihan adalah tugas tahap Transform.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd


@dataclass
class RawTable:
    source_file: str
    frame: pd.DataFrame
    meta: dict = field(default_factory=dict)
