"""Utilitas transformasi bersama.

Berisi aturan transformasi yang dipakai lintas dataset:
  * normalisasi nama provinsi + pencocokan via tabel alias (dim_provinsi.alias)
  * normalisasi angka format Indonesia / internasional
  * konversi nilai kosong khas BPS ("-", "…", "NA", dst.) menjadi NULL
  * wide -> long (kolom bulan menjadi baris)
  * penyeragaman periode (waktu_id = tahun*100 + bulan)
  * deduplikasi & validasi rentang nilai
Setiap baris yang dibuang dicatat beserta alasannya (Rejects).
"""
from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field

import pandas as pd

# ---------------------------------------------------------------------------
# Nilai kosong khas BPS
#   "-"  : tidak ada / nol tidak dilaporkan      "…" / "..." : data belum tersedia
#   "NA" : not available                          "�"    : tanda pisah (—) yang
#                                                                gagal dipetakan font PDF
# ---------------------------------------------------------------------------
NULL_TOKENS = {"", "-", "–", "—", "…", "...", "NA", "N/A", "na", "n/a", "x", "�", "null", "None"}

BULAN = {
    "januari": 1, "februari": 2, "maret": 3, "april": 4, "mei": 5, "juni": 6,
    "juli": 7, "agustus": 8, "september": 9, "oktober": 10, "november": 11, "desember": 12,
}


def waktu_id(tahun: int, bulan: int = 0) -> int:
    """Format periode seragam: YYYYMM, dengan MM=00 untuk data tahunan."""
    return int(tahun) * 100 + int(bulan)


def normalize_name(s: str) -> str:
    """'Kep. Bangka  Belitung' -> 'KEP BANGKA BELITUNG' (sama dengan format alias di DB)."""
    s = str(s).upper().replace(".", " ").replace(",", " ")
    return re.sub(r"\s+", " ", s).strip()


def is_null_token(v) -> bool:
    return v is None or (isinstance(v, float) and pd.isna(v)) or str(v).strip() in NULL_TOKENS


def parse_number(v, style: str):
    """Ubah teks angka menjadi float.

    style="id"  : format Indonesia  -> titik = pemisah ribuan, koma = desimal ("1.412" -> 1412; "51,9" -> 51.9)
    style="en"  : format internasional -> titik = desimal ("49.17" -> 49.17)
    Mengembalikan None untuk token kosong; ValueError bila tidak bisa di-parse.
    """
    if is_null_token(v):
        return None
    s = str(v).strip().replace(" ", "").replace(" ", "")
    if style == "id":
        s = s.replace(".", "").replace(",", ".")
    elif style == "en":
        s = s.replace(",", "")
    else:
        raise ValueError(style)
    return float(s)


class ProvinsiResolver:
    """Memetakan nama provinsi dari sumber ke kode BPS memakai daftar alias."""

    def __init__(self, rows: list[tuple[int, str, list[str]]]):
        self.lookup: dict[str, int] = {}
        for kode, nama, aliases in rows:
            for a in [nama, *aliases]:
                self.lookup[normalize_name(a)] = kode
        self.unmatched: Counter = Counter()

    def resolve(self, name: str) -> int | None:
        kode = self.lookup.get(normalize_name(name))
        if kode is None:
            self.unmatched[str(name)] += 1
        return kode


@dataclass
class Rejects:
    """Kumpulan baris yang dibuang + alasannya (disimpan ke data/rejected)."""
    rows: list[dict] = field(default_factory=list)

    def add(self, alasan: str, **ctx):
        self.rows.append({"alasan": alasan, **{k: str(v) for k, v in ctx.items()}})

    def counts(self) -> dict[str, int]:
        return dict(Counter(r["alasan"] for r in self.rows))

    def __len__(self):
        return len(self.rows)

    def to_frame(self) -> pd.DataFrame:
        return pd.DataFrame(self.rows)


@dataclass
class TransformResult:
    frame: pd.DataFrame
    rejects: Rejects
    rows_in: int
    notes: list[str]


def wide_to_long(df: pd.DataFrame, id_col: str, value_cols: dict[str, int]) -> pd.DataFrame:
    """Kolom bulan (Januari..Desember) -> baris (bulan, nilai_mentah)."""
    long = df.melt(id_vars=[id_col], value_vars=list(value_cols), var_name="nama_bulan", value_name="nilai_mentah")
    long["bulan"] = long["nama_bulan"].map(value_cols)
    return long


def parse_bps_monthly_table(frame: pd.DataFrame) -> tuple[int, pd.DataFrame, str | None]:
    """Header tabel ekspor BPS: baris 2 = tahun, baris 3 = nama bulan (+ 'Tahunan').

    Mengembalikan (tahun, body dengan kolom label + nama bulan, nama kolom tahunan bila ada).
    """
    tahun_cells = [c for c in frame.iloc[2].tolist() if re.fullmatch(r"\d{4}", str(c).strip())]
    if not tahun_cells:
        raise ValueError("Baris tahun tidak ditemukan di header tabel BPS")
    tahun = int(tahun_cells[0])
    header = [str(c).strip() for c in frame.iloc[3].tolist()]
    header[0] = "label"
    body = frame.iloc[4:].copy()
    body.columns = header
    body["label"] = body["label"].astype(str).str.strip()
    body = body[body["label"] != ""]
    annual = next((h for h in header if h.lower() == "tahunan"), None)
    return tahun, body, annual


def dedupe(df: pd.DataFrame, keys: list[str], rejects: Rejects, sumber: str) -> pd.DataFrame:
    dup = df.duplicated(subset=keys, keep="last")
    for _, r in df[dup].iterrows():
        rejects.add("duplikat kunci (disimpan versi terakhir)", sumber=sumber, **{k: r[k] for k in keys})
    return df[~dup]
