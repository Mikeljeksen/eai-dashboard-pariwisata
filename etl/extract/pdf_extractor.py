"""Extractor PDF — tabel lampiran publikasi BPS (pdfplumber).

Publikasi "Statistik Hotel dan Akomodasi Lainnya di Indonesia 2025" memiliki
dua gangguan pada lapisan teks yang harus ditangani saat ekstraksi:

1. Watermark diagonal "https://www.bps.go.id" (font Arial Bold, ukuran
   >15pt). Hurufnya ikut terbaca di dalam sel tabel, mis. "d\\n398".
   -> karakter watermark dibuang berdasarkan ukuran font.
2. Superskrip catatan kaki "1" (ukuran ~4pt) yang menempel pada angka,
   mis. "695" + "1" terbaca "6951".
   -> superskrip diganti penanda "*" agar tidak tercampur dengan angka;
      penanda ini dibersihkan & dihitung di tahap Transform.

Halaman tabel dicari berdasarkan judul lampiran, bukan nomor halaman,
sehingga tetap bekerja bila tata letak edisi berikutnya bergeser.
"""
from __future__ import annotations

import re
from pathlib import Path

import pandas as pd
import pdfplumber

from . import RawTable

WATERMARK_MIN_SIZE = 15.0
SUPERSCRIPT_MAX_SIZE = 5.0

# judul lampiran -> (kategori, metrik)
TARGET_TABLES = {
    r"Lampiran 1 Banyaknya Usaha pada Usaha Akomodasi Menurut Provinsi": ("semua_akomodasi", "jumlah_usaha"),
    r"Lampiran 2 Banyaknya Kamar pada Usaha Akomodasi Menurut Provinsi": ("semua_akomodasi", "jumlah_kamar"),
    r"Lampiran 5 Banyaknya Usaha Hotel Bintang Menurut Provinsi": ("hotel_bintang", "jumlah_usaha"),
    r"Lampiran 6 Banyaknya Kamar pada Hotel Bintang Menurut Provinsi": ("hotel_bintang", "jumlah_kamar"),
}


def _clean_page(page):
    for ch in page.chars:
        if ch["size"] < SUPERSCRIPT_MAX_SIZE:
            ch["text"] = "*"
    return page.filter(lambda o: not (o.get("object_type") == "char" and o["size"] > WATERMARK_MIN_SIZE))


def extract(paths: list[Path]) -> list[RawTable]:
    tables: list[RawTable] = []
    for p in sorted(paths):
        with pdfplumber.open(p) as pdf:
            found = set()
            for idx, page in enumerate(pdf.pages):
                head = (page.extract_text() or "")[:200].replace("\n", " ")
                for pattern, (kategori, metrik) in TARGET_TABLES.items():
                    if pattern in found or not re.match(pattern, head):
                        continue
                    clean = _clean_page(page)
                    raw_rows = clean.extract_tables()[0]
                    watermark_chars = sum(1 for c in page.chars if c["size"] > WATERMARK_MIN_SIZE)
                    tables.append(RawTable(
                        source_file=p.name,
                        frame=pd.DataFrame(raw_rows).fillna(""),
                        meta={
                            "halaman_pdf": idx + 1,
                            "judul": pattern,
                            "kategori": kategori,
                            "metrik": metrik,
                            "karakter_watermark_dibuang": watermark_chars,
                        },
                    ))
                    found.add(pattern)
            missing = set(TARGET_TABLES) - found
            if missing:
                raise RuntimeError(f"Tabel tidak ditemukan di {p.name}: {missing}")
    return tables
