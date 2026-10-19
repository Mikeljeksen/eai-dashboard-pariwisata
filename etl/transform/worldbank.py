"""Transformasi D4 — World Bank WDI (JSON).

Record JSON sudah berbentuk long (negara, indikator, tahun, nilai), sehingga
transformasinya berupa: pemilihan & penamaan ulang kolom hasil flatten,
penyeragaman periode tahunan (waktu_id = YYYY00), penetapan satuan, dan
pembuangan nilai null (World Bank belum merilis data pariwisata 2021+).
"""
from __future__ import annotations

import pandas as pd

from ..extract import RawTable
from .common import Rejects, TransformResult, dedupe, waktu_id

INDIKATOR = {
    "ST.INT.ARVL":    ("Kedatangan wisatawan internasional", "orang"),
    "ST.INT.DPRT":    ("Keberangkatan wisatawan ke luar negeri", "orang"),
    "ST.INT.RCPT.CD": ("Penerimaan pariwisata internasional", "US$"),
    "ST.INT.XPND.CD": ("Pengeluaran pariwisata internasional", "US$"),
}

NAMA_NEGARA = {"IDN": "Indonesia", "THA": "Thailand", "MYS": "Malaysia",
               "VNM": "Vietnam", "SGP": "Singapura", "PHL": "Filipina"}


def transform_worldbank(tables: list[RawTable]) -> TransformResult:
    rejects = Rejects()
    out, rows_in = [], 0
    for t in tables:
        df = t.frame
        rows_in += len(df)
        for _, r in df.iterrows():
            ctx = dict(sumber=t.source_file, negara=r["countryiso3code"], indikator=r["indicator.id"], tahun=r["date"])
            if r["indicator.id"] not in INDIKATOR:
                rejects.add("indikator di luar cakupan", **ctx)
                continue
            if r["value"] is None or pd.isna(r["value"]):
                rejects.add("nilai null di sumber (belum dirilis)", **ctx)
                continue
            if float(r["value"]) < 0:
                rejects.add("nilai negatif", **ctx)
                continue
            nama, satuan = INDIKATOR[r["indicator.id"]]
            iso = r["countryiso3code"]
            out.append({
                "negara_iso3": iso,
                "negara_nama": NAMA_NEGARA.get(iso, r["country.value"]),
                "waktu_id": waktu_id(int(r["date"])),
                "indikator_kode": r["indicator.id"],
                "indikator_nama": nama,
                "satuan": satuan,
                "nilai": float(r["value"]),
            })
    res = pd.DataFrame(out)
    res = dedupe(res, ["negara_iso3", "waktu_id", "indikator_kode"], rejects, "gabungan")
    notes = [
        "flatten JSON bersarang (indicator.id, country.value) → kolom relasional",
        "tahun 'YYYY' → waktu_id YYYY00 (granularitas tahunan)",
        "kode indikator WDI → nama & satuan Bahasa Indonesia",
        "nilai null (data 2021+ belum dirilis UN Tourism/WB) dibuang",
    ]
    return TransformResult(res, rejects, rows_in, notes)
