"""Quality check sederhana setelah load: jumlah baris, % null, validitas FK,
dan rekonsiliasi provinsi vs agregat nasional."""
from __future__ import annotations

import psycopg

CHECKS = {
    "fact_tpk_hotel":     {"value": "tpk_persen",        "fk": [("provinsi_kode", "dim_provinsi", "kode_bps")]},
    "fact_wisnus":        {"value": "jumlah_perjalanan", "fk": [("provinsi_kode", "dim_provinsi", "kode_bps")]},
    "fact_wisman":        {"value": "jumlah_kunjungan",  "fk": [("provinsi_kode", "dim_provinsi", "kode_bps")]},
    "fact_wb_pariwisata": {"value": "nilai",             "fk": []},
    "fact_akomodasi":     {"value": "jumlah_kamar",      "fk": [("provinsi_kode", "dim_provinsi", "kode_bps")]},
}


def run_quality_checks(conn: psycopg.Connection) -> list[dict]:
    results = []
    with conn.cursor() as cur:
        for table, cfg in CHECKS.items():
            cur.execute(f"""select count(*), count(*) filter (where {cfg['value']} is null),
                                   min(waktu_id) / 100, max(waktu_id) / 100
                            from public.{table}""")
            n, nulls, y0, y1 = cur.fetchone()
            orphans = 0
            for col, ref, refcol in cfg["fk"]:
                cur.execute(f"""select count(*) from public.{table} f
                                left join public.{ref} r on r.{refcol} = f.{col}
                                where f.{col} is not null and r.{refcol} is null""")
                orphans += cur.fetchone()[0]
            cur.execute(f"""select count(*) from public.{table} f
                            left join public.dim_waktu w on w.waktu_id = f.waktu_id where w.waktu_id is null""")
            orphans += cur.fetchone()[0]
            results.append({"tabel": table, "baris": n, "null_pct": round(100 * nulls / n, 2) if n else 0,
                            "fk_tidak_valid": orphans, "rentang_tahun": f"{y0}–{y1}" if n else "-"})

        # Rekonsiliasi: Σ provinsi wisnus vs baris nasional (kode 0), tahun 2023+ (38 provinsi lengkap)
        cur.execute("""
            with p as (select waktu_id, sum(jumlah_perjalanan) s from public.fact_wisnus
                       where provinsi_kode <> 0 group by waktu_id),
                 n as (select waktu_id, jumlah_perjalanan t from public.fact_wisnus where provinsi_kode = 0)
            select count(*), count(*) filter (where abs(p.s - n.t) <= greatest(1, n.t * 0.001))
            from p join n using (waktu_id)""")
        total, cocok = cur.fetchone()
        results.append({"tabel": "rekonsiliasi Σprovinsi = nasional (wisnus)", "baris": total,
                        "null_pct": "", "fk_tidak_valid": "", "rentang_tahun": f"{cocok}/{total} bulan cocok"})
    return results


def print_report(rows: list[dict]):
    print("\n=== QUALITY CHECK ===")
    print(f"{'tabel':<44}{'baris':>8}{'null %':>9}{'FK invalid':>12}  rentang/keterangan")
    for r in rows:
        print(f"{r['tabel']:<44}{r['baris']:>8}{str(r['null_pct']):>9}{str(r['fk_tidak_valid']):>12}  {r['rentang_tahun']}")
