"""Transformasi D1 (TPK hotel bintang, XLSX) dan D2 (wisnus, CSV).

Kedua tabel BPS ini memiliki bentuk yang sama: baris = provinsi,
kolom = Januari..Desember (+ 'Tahunan' pada wisnus). Perbedaannya ada pada
format angka dan aturan validasi, sehingga keduanya memakai fungsi yang sama
dengan parameter berbeda.
"""
from __future__ import annotations

import pandas as pd

from ..extract import RawTable
from .common import (BULAN, ProvinsiResolver, Rejects, TransformResult, dedupe, is_null_token,
                     parse_bps_monthly_table, parse_number, waktu_id, wide_to_long)


def _transform(tables: list[RawTable], resolver: ProvinsiResolver, *, value_col: str,
               number_style: str, vmin: float, vmax: float, as_int: bool,
               annual_agg: str = "sum", annual_tol: float = 1.0) -> TransformResult:
    rejects = Rejects()
    out, rows_in = [], 0
    notes: list[str] = []
    annual_mismatch = 0
    annual_checked = 0

    for t in tables:
        tahun, body, annual_col = parse_bps_monthly_table(t.frame)
        month_cols = {c: BULAN[c.lower()] for c in body.columns if c.lower() in BULAN}

        # 1) wide -> long
        long = wide_to_long(body, "label", month_cols)
        rows_in += len(long)

        # 2) standardisasi nama provinsi via alias
        kode_map = {lbl: resolver.resolve(lbl) for lbl in body["label"].unique()}
        long["provinsi_kode"] = long["label"].map(kode_map)

        for _, r in long.iterrows():
            ctx = dict(sumber=t.source_file, label=r["label"], tahun=tahun, bulan=r["bulan"], nilai=r["nilai_mentah"])
            if pd.isna(r["provinsi_kode"]):
                rejects.add("nama provinsi tidak dikenali", **ctx)
                continue
            # 3) nilai kosong BPS ("-", "…") -> NULL -> tidak dimuat
            if is_null_token(r["nilai_mentah"]):
                rejects.add("nilai kosong BPS ('-' / '…') → NULL", **ctx)
                continue
            # 4) normalisasi angka
            try:
                v = parse_number(r["nilai_mentah"], number_style)
            except ValueError:
                rejects.add("format angka tidak valid", **ctx)
                continue
            # 5) validasi rentang
            if not (vmin <= v <= vmax):
                rejects.add(f"di luar rentang valid [{vmin:g}, {vmax:g}]", **ctx)
                continue
            out.append({
                "provinsi_kode": int(r["provinsi_kode"]),
                "waktu_id": waktu_id(tahun, r["bulan"]),
                value_col: int(round(v)) if as_int else round(v, 2),
            })

        # Validasi silang kolom 'Tahunan' = jumlah 12 bulan (hanya tahun lengkap).
        # Kolom agregat ini TIDAK dimuat: total tahunan diturunkan ulang di view.
        if annual_col:
            for _, row in body.iterrows():
                vals = [row[c] for c in month_cols]
                if any(is_null_token(x) for x in vals) or is_null_token(row[annual_col]):
                    continue
                annual_checked += 1
                nums = [parse_number(x, number_style) for x in vals]
                agg = sum(nums) if annual_agg == "sum" else sum(nums) / len(nums)
                if abs(agg - parse_number(row[annual_col], number_style)) > annual_tol:
                    annual_mismatch += 1

    df = pd.DataFrame(out)
    df = dedupe(df, ["provinsi_kode", "waktu_id"], rejects, "gabungan")
    if annual_col is not None or annual_checked:
        label = "Σbulan" if annual_agg == "sum" else f"rata-rata bulan (±{annual_tol:g} poin)"
        notes.append(f"kolom 'Tahunan' dibuang (diturunkan ulang di view); cek silang {label} = Tahunan: "
                     f"{annual_checked - annual_mismatch}/{annual_checked} baris cocok")
    return TransformResult(df, rejects, rows_in, notes)


def transform_tpk(tables: list[RawTable], resolver: ProvinsiResolver) -> TransformResult:
    # 'Tahunan' TPK BPS = rata-rata tertimbang malam kamar, jadi dibandingkan dengan
    # rata-rata sederhana 12 bulan dengan toleransi 2 poin persen.
    res = _transform(tables, resolver, value_col="tpk_persen", number_style="en",
                     vmin=0, vmax=100, as_int=False, annual_agg="mean", annual_tol=2.0)
    res.notes[:0] = [
        "wide→long: 12 kolom bulan → baris (provinsi, bulan)",
        "nama provinsi HURUF BESAR → kode BPS via tabel alias; baris INDONESIA → kode 0 (agregat nasional)",
        "angka teks ('49.17', titik desimal) → numeric(5,2)",
        "'-' (bulan belum rilis / provinsi baru belum terbentuk) → NULL, tidak dimuat",
        "validasi rentang TPK 0–100%",
    ]
    return res


def transform_wisnus(tables: list[RawTable], resolver: ProvinsiResolver) -> TransformResult:
    res = _transform(tables, resolver, value_col="jumlah_perjalanan", number_style="id",
                     vmin=0, vmax=1e9, as_int=True)
    res.notes[:0] = [
        "wide→long: 12 kolom bulan → baris (provinsi, bulan)",
        "nama provinsi → kode BPS via tabel alias; baris INDONESIA → kode 0",
        "angka → bigint (satuan: perjalanan)",
        "'-' → NULL, tidak dimuat",
    ]
    return res
