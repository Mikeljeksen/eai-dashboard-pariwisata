"""Transformasi D3 — kunjungan wisman per pintu masuk (CSV BPS).

Tantangan data:
  * Tabel bercampur antara baris detail dan baris subtotal ("A. Pintu Udara",
    "Jumlah (A+B+C)", "Total"). Subtotal dibuang agar tidak terhitung ganda,
    tetapi dipakai untuk validasi silang Σdetail = Total.
  * Kunci integrasi dengan dataset lain adalah provinsi, sedangkan sumber
    memakai nama bandara/pelabuhan/PLBN. Pintu masuk dipetakan ke provinsi
    lewat tabel referensi data/reference/pintu_masuk_provinsi.csv.
"""
from __future__ import annotations

import re

import pandas as pd

from ..config import REF_DIR
from ..extract import RawTable
from .common import (BULAN, Rejects, TransformResult, dedupe, is_null_token, parse_bps_monthly_table,
                     parse_number, waktu_id, wide_to_long)

SUBTOTAL = re.compile(r"^([ABC]\.\s|Jumlah\b|Total$)", re.I)


def load_gateway_map() -> pd.DataFrame:
    ref = pd.read_csv(REF_DIR / "pintu_masuk_provinsi.csv", dtype={"provinsi_kode": "Int64"})
    return ref.set_index("pintu_masuk")


def transform_wisman(tables: list[RawTable]) -> TransformResult:
    gw = load_gateway_map()
    rejects = Rejects()
    out, rows_in = [], 0
    total_checked = total_ok = 0

    for t in tables:
        tahun, body, annual_col = parse_bps_monthly_table(t.frame)
        month_cols = {c: BULAN[c.lower()] for c in body.columns if c.lower() in BULAN}

        # validasi silang: Σ baris detail per bulan == baris 'Total'
        total_row = body[body["label"].str.fullmatch("Total", case=False)]
        detail = body[~body["label"].str.match(SUBTOTAL)]
        if not total_row.empty:
            for c in month_cols:
                tv = total_row.iloc[0][c]
                if is_null_token(tv):
                    continue
                total_checked += 1
                s = sum(parse_number(x, "id") or 0 for x in detail[c])
                total_ok += int(abs(s - parse_number(tv, "id")) <= 1)

        long = wide_to_long(body, "label", month_cols)
        rows_in += len(long)
        for _, r in long.iterrows():
            ctx = dict(sumber=t.source_file, label=r["label"], tahun=tahun, bulan=r["bulan"], nilai=r["nilai_mentah"])
            if SUBTOTAL.match(r["label"]):
                rejects.add("baris subtotal/total (dihitung ulang di view)", **ctx)
                continue
            if r["label"] not in gw.index:
                rejects.add("pintu masuk tidak ada di tabel referensi", **ctx)
                continue
            if is_null_token(r["nilai_mentah"]):
                rejects.add("nilai kosong BPS ('-') → NULL", **ctx)
                continue
            try:
                v = parse_number(r["nilai_mentah"], "id")
            except ValueError:
                rejects.add("format angka tidak valid", **ctx)
                continue
            if v < 0:
                rejects.add("nilai negatif", **ctx)
                continue
            ref = gw.loc[r["label"]]
            out.append({
                "pintu_masuk": r["label"],
                "jenis_pintu": ref["jenis_pintu"],
                "provinsi_kode": None if pd.isna(ref["provinsi_kode"]) else int(ref["provinsi_kode"]),
                "waktu_id": waktu_id(tahun, r["bulan"]),
                "jumlah_kunjungan": int(v),
            })

    df = pd.DataFrame(out)
    df = dedupe(df, ["pintu_masuk", "waktu_id"], rejects, "gabungan")
    notes = [
        "wide→long: 12 kolom bulan → baris (pintu masuk, bulan)",
        "baris subtotal (A./B./C., Jumlah, Total) dibuang untuk mencegah double counting",
        "pintu masuk → jenis (udara/laut/darat) & provinsi lokasi via tabel referensi",
        "pintu 'Lainnya' tetap dimuat dengan provinsi NULL (ikut total nasional, tidak ikut peta)",
        f"cek silang Σdetail = Total: {total_ok}/{total_checked} bulan cocok",
    ]
    return TransformResult(df, rejects, rows_in, notes)
