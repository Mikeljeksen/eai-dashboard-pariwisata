"""Entry point pipeline ETL — Data-level EAI Pariwisata Indonesia.

    python -m etl.run_etl                      # manual run
    python -m etl.run_etl --trigger scheduled  # dipakai GitHub Actions
    python -m etl.run_etl --dry-run            # Extract+Transform saja, tanpa DB

Alur per dataset:  EXTRACT (baca file mentah apa adanya)
                -> TRANSFORM (bersihkan, standarkan, validasi)
                -> LOAD (upsert idempoten ke hub Supabase Postgres)
Setiap tahap dicatat ke etl_step_log; baris yang dibuang disimpan ke
data/rejected/<dataset>_rejected.csv.
"""
from __future__ import annotations

import argparse
import re
import sys
import time
from pathlib import Path

import psycopg

from .config import MIGRATIONS_DIR, RAW_DIR, REJECTED_DIR, SUMBER, database_url
from .extract import csv_extractor, json_extractor, pdf_extractor, xlsx_extractor
from .load.loader import RunLogger, upsert
from .migrate import migrate
from .quality import print_report, run_quality_checks
from .transform.akomodasi import transform_akomodasi
from .transform.bps_bulanan import transform_tpk, transform_wisnus
from .transform.common import ProvinsiResolver
from .transform.wisman import transform_wisman
from .transform.worldbank import transform_worldbank

EXTRACTORS = {"CSV": csv_extractor, "XLSX": xlsx_extractor, "JSON": json_extractor, "PDF": pdf_extractor}


def load_resolver(conn) -> ProvinsiResolver:
    if conn is not None:
        with conn.cursor() as cur:
            cur.execute("select kode_bps, nama, alias from public.dim_provinsi")
            return ProvinsiResolver(cur.fetchall())
    # dry-run: baca master provinsi langsung dari file seed migrasi
    sql = (MIGRATIONS_DIR / "0002_seed_dim_provinsi.sql").read_text(encoding="utf-8")
    rows = [(int(k), n, a.split(",")) for k, n, a in
            re.findall(r"\(\s*(\d+),\s*'([^']+)'.*?'\{([^}]*)\}'\)", sql)]
    return ProvinsiResolver(rows)


def upsert_sumber(conn):
    with conn.cursor() as cur:
        for s in SUMBER.values():
            cur.execute("""insert into public.sumber_data (dataset, judul, penerbit, format, url, cakupan, tabel_fakta, deskripsi)
                           values (%s,%s,%s,%s,%s,%s,%s,%s)
                           on conflict (dataset) do update set judul = excluded.judul, penerbit = excluded.penerbit,
                             format = excluded.format, url = excluded.url, cakupan = excluded.cakupan,
                             tabel_fakta = excluded.tabel_fakta, deskripsi = excluded.deskripsi""",
                        (s.dataset, s.judul, s.penerbit, s.format, s.url, s.cakupan, s.tabel_fakta, s.deskripsi))


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--trigger", choices=["manual", "scheduled"], default="manual")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only", nargs="*", choices=list(SUMBER), help="jalankan sebagian dataset")
    args = ap.parse_args(argv)

    conn = None if args.dry_run else psycopg.connect(database_url(), autocommit=True)
    if conn:
        applied = migrate(conn)
        if applied:
            print("Migrasi baru dijalankan:", applied)
        upsert_sumber(conn)

    resolver = load_resolver(conn)
    log = RunLogger(conn, args.trigger)
    print(f"\n=== ETL run #{log.run_id or '(dry-run)'} — trigger={args.trigger} ===")
    REJECTED_DIR.mkdir(parents=True, exist_ok=True)

    transforms = {
        "d1_tpk_hotel": lambda t: transform_tpk(t, resolver),
        "d2_wisnus":    lambda t: transform_wisnus(t, resolver),
        "d3_wisman":    transform_wisman,
        "d4_worldbank": transform_worldbank,
        "d5_akomodasi": lambda t: transform_akomodasi(t, resolver),
    }

    try:
        for key, src in SUMBER.items():
            if args.only and key not in args.only:
                continue
            print(f"\n▶ {key} [{src.format}] → {src.tabel_fakta}")

            # ---------------- EXTRACT ----------------
            t0 = time.perf_counter()
            paths = sorted(RAW_DIR.glob(src.raw_glob))
            if not paths:
                raise FileNotFoundError(f"File mentah tidak ditemukan: data/raw/{src.raw_glob}")
            tables = EXTRACTORS[src.format].extract(paths)
            n_raw = sum(len(t.frame) for t in tables)
            log.step(key, src.format, "E", masuk=len(paths), keluar=n_raw, mulai=t0,
                     catatan=f"{len(paths)} file dibaca: " + ", ".join(p.name for p in paths[:3])
                             + (" …" if len(paths) > 3 else ""))

            # ---------------- TRANSFORM ----------------
            t0 = time.perf_counter()
            res = transforms[key](tables)
            rej_path = REJECTED_DIR / f"{key}_rejected.csv"
            res.rejects.to_frame().to_csv(rej_path, index=False, encoding="utf-8")
            log.step(key, src.format, "T", masuk=res.rows_in, keluar=len(res.frame), dibuang=len(res.rejects),
                     alasan=res.rejects.counts(), catatan="; ".join(res.notes), mulai=t0)
            for r, n in res.rejects.counts().items():
                print(f"       dibuang {n:>5} × {r}")
            if resolver.unmatched:
                print("       ⚠ nama tak dikenali:", dict(resolver.unmatched))

            # ---------------- LOAD ----------------
            t0 = time.perf_counter()
            if conn:
                with conn.transaction():
                    stat = upsert(conn, src.tabel_fakta, res.frame, log.run_id)
                log.step(key, src.format, "L", masuk=len(res.frame), keluar=stat["inserted"] + stat["updated"],
                         mulai=t0, catatan=f"upsert {src.tabel_fakta}: {stat['inserted']} baru, "
                                           f"{stat['updated']} diperbarui (idempoten)")
            else:
                print(f"  [L] dilewati (dry-run) — {len(res.frame)} baris siap dimuat")

        if conn:
            print_report(run_quality_checks(conn))
        log.finish("success")
        print("\n✔ ETL selesai.")
        return 0
    except Exception as exc:  # noqa: BLE001 — status run harus selalu tercatat
        log.finish("failed", f"{type(exc).__name__}: {exc}")
        raise
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    sys.exit(main())
