"""Transformasi D5 — usaha & kamar akomodasi dari tabel PDF.

Masalah data yang ditangani:
  * Header 3 baris (judul kolom, tahun, nomor kolom "(1) (2) …") -> tahun
    diambil dari baris header, sisanya dibuang.
  * Angka format Indonesia "1.412" (titik = ribuan).
  * Tanda pisah "—" terbaca sebagai karakter U+FFFD -> NULL
    (provinsi pemekaran Papua sebelum terbentuk).
  * Penanda catatan kaki "*" (superskrip "dapat rilis dengan catatan")
    dilepas dari angka dan dihitung.
  * Empat tabel (usaha/kamar × semua akomodasi/hotel bintang) digabung
    (pivot) menjadi satu baris per provinsi-tahun-kategori.
"""
from __future__ import annotations

import re

import pandas as pd

from ..extract import RawTable
from .common import ProvinsiResolver, Rejects, TransformResult, is_null_token, parse_number, waktu_id


def transform_akomodasi(tables: list[RawTable], resolver: ProvinsiResolver) -> TransformResult:
    rejects = Rejects()
    recs, rows_in, footnotes, watermark = [], 0, 0, 0

    for t in tables:
        f = t.frame
        watermark += t.meta.get("karakter_watermark_dibuang", 0)
        year_row = next(i for i in range(len(f)) if sum(bool(re.fullmatch(r"20\d\d", str(c))) for c in f.iloc[i]) >= 3)
        years = {j: int(c) for j, c in enumerate(f.iloc[year_row]) if re.fullmatch(r"20\d\d", str(c))}
        body = f.iloc[year_row + 1:]
        for _, row in body.iterrows():
            cells = [str(c).strip() for c in row.tolist()]
            if re.fullmatch(r"\(\d+\)", cells[0] or "") or not any(cells):
                continue  # baris nomor kolom "(1) (2) …"
            # baris provinsi: [kode, nama, ...]; baris nasional: ["Indonesia", "", ...]
            label = cells[1] if re.fullmatch(r"\d{2}", cells[0]) else cells[0]
            kode = resolver.resolve(label)
            for j, tahun in years.items():
                rows_in += 1
                raw = cells[j]
                ctx = dict(sumber=f"{t.source_file} hal. {t.meta['halaman_pdf']}", label=label,
                           tahun=tahun, metrik=t.meta["metrik"], nilai=raw)
                if kode is None:
                    rejects.add("nama provinsi tidak dikenali", **ctx)
                    continue
                if "*" in raw:
                    footnotes += 1
                    raw = raw.replace("*", "")
                if is_null_token(raw):
                    rejects.add("tanda '—' (provinsi belum terbentuk) → NULL", **ctx)
                    continue
                try:
                    v = parse_number(raw, "id")
                except ValueError:
                    rejects.add("format angka tidak valid", **ctx)
                    continue
                if v < 0 or v != int(v):
                    rejects.add("bukan bilangan cacah", **ctx)
                    continue
                recs.append({"provinsi_kode": kode, "waktu_id": waktu_id(tahun),
                             "kategori": t.meta["kategori"], "metrik": t.meta["metrik"], "nilai": int(v)})

    long = pd.DataFrame(recs)
    dup = long.duplicated(["provinsi_kode", "waktu_id", "kategori", "metrik"], keep="last")
    for _, r in long[dup].iterrows():
        rejects.add("duplikat kunci (disimpan versi terakhir)", **r.to_dict())
    long = long[~dup]
    wide = (long.pivot_table(index=["provinsi_kode", "waktu_id", "kategori"], columns="metrik",
                             values="nilai", aggfunc="first")
                .reset_index())
    for c in ("jumlah_usaha", "jumlah_kamar"):
        if c not in wide:
            wide[c] = None
    wide = wide[["provinsi_kode", "waktu_id", "kategori", "jumlah_usaha", "jumlah_kamar"]]
    wide = wide.astype(object).where(wide.notna(), None)

    # validasi logis: kamar >= usaha (setiap usaha minimal 1 kamar)
    bad = wide[(wide["jumlah_kamar"].notna()) & (wide["jumlah_usaha"].notna())
               & (wide["jumlah_kamar"].astype(float) < wide["jumlah_usaha"].astype(float))]
    for _, r in bad.iterrows():
        rejects.add("jumlah kamar < jumlah usaha (tidak logis)", **r.to_dict())
    wide = wide.drop(bad.index)

    notes = [
        f"ekstraksi 4 tabel lampiran PDF; {watermark} karakter watermark dibuang (filter ukuran font)",
        f"{footnotes} penanda catatan kaki superskrip dilepas dari angka",
        "angka format Indonesia '1.412' → 1412",
        "'—' (U+FFFD) → NULL",
        "pivot 4 tabel → 1 baris per provinsi-tahun-kategori (usaha, kamar)",
        "validasi logis: jumlah kamar ≥ jumlah usaha",
    ]
    return TransformResult(wide, rejects, rows_in, notes)
