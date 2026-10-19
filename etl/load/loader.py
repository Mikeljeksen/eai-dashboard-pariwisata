"""Tahap LOAD — upsert idempoten ke Supabase Postgres + pencatatan run ETL.

Strategi: COPY ke tabel sementara -> INSERT … ON CONFLICT (primary key)
DO UPDATE. Menjalankan ulang ETL dengan data yang sama tidak menambah baris;
RETURNING (xmax = 0) membedakan baris baru vs baris yang diperbarui.
"""
from __future__ import annotations

import json
import time

import pandas as pd
import psycopg

FACT_KEYS = {
    "fact_tpk_hotel":     ["provinsi_kode", "waktu_id"],
    "fact_wisnus":        ["provinsi_kode", "waktu_id"],
    "fact_wisman":        ["pintu_masuk", "waktu_id"],
    "fact_wb_pariwisata": ["negara_iso3", "waktu_id", "indikator_kode"],
    "fact_akomodasi":     ["provinsi_kode", "waktu_id", "kategori"],
}


def _cell(v):
    """NaN -> NULL; float bulat (efek kolom int + NULL di pandas, mis. 51.0) -> int."""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v


def upsert(conn: psycopg.Connection, table: str, df: pd.DataFrame, run_id: int) -> dict:
    keys = FACT_KEYS[table]
    df = df.copy()
    df["run_id"] = run_id
    cols = list(df.columns)
    non_key = [c for c in cols if c not in keys]
    tmp = f"tmp_{table}"
    with conn.cursor() as cur:
        cur.execute(f"create temp table {tmp} (like public.{table} including defaults) on commit drop")
        with cur.copy(f"copy {tmp} ({', '.join(cols)}) from stdin") as cp:
            for row in df.itertuples(index=False, name=None):
                cp.write_row([_cell(v) for v in row])
        cur.execute(f"""
            insert into public.{table} ({', '.join(cols)})
            select {', '.join(cols)} from {tmp}
            on conflict ({', '.join(keys)}) do update set
              {', '.join(f'{c} = excluded.{c}' for c in non_key)}
            returning (xmax = 0) as inserted
        """)
        flags = [r[0] for r in cur.fetchall()]
    return {"inserted": sum(flags), "updated": len(flags) - sum(flags)}


class RunLogger:
    """Menulis etl_run & etl_step_log (koneksi autocommit terpisah agar log
    tetap tersimpan walaupun transaksi load gagal)."""

    def __init__(self, conn: psycopg.Connection | None, trigger: str):
        self.conn = conn
        self.run_id = 0
        self.steps: list[dict] = []
        if conn:
            with conn.cursor() as cur:
                cur.execute("insert into public.etl_run (trigger) values (%s) returning run_id", (trigger,))
                self.run_id = cur.fetchone()[0]

    def step(self, dataset: str, fmt: str, tahap: str, *, masuk: int, keluar: int, dibuang: int = 0,
             alasan: dict | None = None, catatan: str = "", mulai: float):
        rec = dict(dataset=dataset, format_sumber=fmt, tahap=tahap, baris_masuk=masuk, baris_keluar=keluar,
                   baris_dibuang=dibuang, alasan_dibuang=alasan or {}, catatan_transformasi=catatan,
                   durasi_ms=int((time.perf_counter() - mulai) * 1000))
        self.steps.append(rec)
        print(f"  [{tahap}] {dataset:<14} masuk={masuk:>6} keluar={keluar:>6} dibuang={dibuang:>5} "
              f"({rec['durasi_ms']} ms)")
        if self.conn:
            with self.conn.cursor() as cur:
                cur.execute(
                    """insert into public.etl_step_log (run_id, dataset, format_sumber, tahap, baris_masuk,
                       baris_keluar, baris_dibuang, alasan_dibuang, catatan_transformasi, durasi_ms)
                       values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (self.run_id, dataset, fmt, tahap, masuk, keluar, dibuang, json.dumps(rec["alasan_dibuang"]),
                     catatan, rec["durasi_ms"]))

    def finish(self, status: str, catatan: str = ""):
        if self.conn:
            with self.conn.cursor() as cur:
                cur.execute("update public.etl_run set selesai = now(), status = %s, catatan = %s where run_id = %s",
                            (status, catatan, self.run_id))
