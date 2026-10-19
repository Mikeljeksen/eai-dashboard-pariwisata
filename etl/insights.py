"""Query analitik untuk bab "Analisis Insight" di docs/LAPORAN.md.

    python -m etl.insights            # cetak hasil semua query ke terminal

Semua angka di laporan diambil dari hub (Supabase Postgres) lewat query ini,
bukan dari file mentah.
"""
from __future__ import annotations

import psycopg

from .config import database_url

QUERIES: dict[str, str] = {
    "1. Tren tahunan & pemulihan (2019 = 100)": """
        select tahun, total_wisman, total_wisnus, rata_tpk, bulan_wisman, bulan_wisnus,
               round(100.0 * total_wisman / first_value(total_wisman) over (order by (tahun <> 2019), tahun), 1) as idx_wisman,
               yoy_wisman, yoy_wisnus, delta_tpk_poin
        from v_kpi_tahunan where tahun between 2018 and 2025 order by tahun""",

    "2. Titik terendah COVID (bulanan)": """
        (select 'wisman' as metrik, label, wisman::numeric as nilai from v_tren_bulanan where wisman is not null order by wisman asc limit 1)
        union all
        (select 'tpk', label, tpk from v_tren_bulanan where tpk is not null order by tpk asc limit 1)
        union all
        (select 'wisnus', label, wisnus from v_tren_bulanan where wisnus is not null order by wisnus asc limit 1)""",

    "3. Musiman: indeks rata-rata per bulan (tahun normal 2018, 2019, 2023, 2024, 2025)": """
        with t as (
          select tahun, bulan, wisman, wisnus, tpk,
                 wisman / avg(wisman) over (partition by tahun) * 100 as iw,
                 wisnus / avg(wisnus) over (partition by tahun) * 100 as iwn,
                 tpk / avg(tpk) over (partition by tahun) * 100 as it
          from v_tren_bulanan where tahun in (2018, 2019, 2023, 2024, 2025))
        select bulan, round(avg(iw), 1) as idx_wisman, round(avg(iwn), 1) as idx_wisnus, round(avg(it), 1) as idx_tpk
        from t group by bulan order by bulan""",

    "4. Konsentrasi wisman per pintu masuk (2019 vs 2025)": """
        with a as (select f.pintu_masuk, w.tahun, sum(jumlah_kunjungan) n
                   from fact_wisman f join dim_waktu w using (waktu_id) where w.tahun in (2019, 2025) group by 1, 2)
        select tahun, pintu_masuk, n, round(100.0 * n / sum(n) over (partition by tahun), 1) as pangsa
        from a where pintu_masuk in ('Ngurah Rai', 'Soekarno-Hatta', 'Batam', 'Pintu Darat Lainnya', 'Juanda', 'Kualanamu')
        order by tahun, n desc""",

    "5. Ketimpangan wisnus antarprovinsi 2025 (top 5 & pangsa)": """
        with p as (select provinsi, wisnus from v_integrasi_provinsi_tahun where tahun = 2025 and wisnus is not null)
        select provinsi, wisnus, round(100.0 * wisnus / sum(wisnus) over (), 1) as pangsa,
               round(100.0 * sum(wisnus) over (order by wisnus desc) / sum(wisnus) over (), 1) as kumulatif
        from p order by wisnus desc limit 6""",

    "6. Pulau Jawa vs luar Jawa (wisnus, kamar akomodasi) 2025": """
        select case when pulau = 'Jawa' then 'Jawa' else 'Luar Jawa' end as wilayah,
               sum(wisnus) as wisnus, sum(kamar_akomodasi) as kamar,
               round(100.0 * sum(wisnus) / sum(sum(wisnus)) over (), 1) as pangsa_wisnus,
               round(100.0 * sum(kamar_akomodasi) / sum(sum(kamar_akomodasi)) over (), 1) as pangsa_kamar
        from v_integrasi_provinsi_tahun where tahun = 2025 group by 1""",

    "7. Korelasi lintas dataset per provinsi 2025": """
        select round(corr(ln(wisnus), tpk_rata)::numeric, 3) as r_logwisnus_tpk,
               round(corr(ln(kamar_akomodasi), ln(wisnus))::numeric, 3) as r_logkamar_logwisnus,
               round(corr(ln(kamar_hotel_bintang), tpk_rata)::numeric, 3) as r_logkamarbintang_tpk,
               round(corr(wisman_pintu_masuk, tpk_rata)::numeric, 3) as r_wisman_tpk,
               count(*) as n
        from v_integrasi_provinsi_tahun
        where tahun = 2025 and wisnus > 0 and kamar_akomodasi > 0 and tpk_rata is not null and kamar_hotel_bintang > 0""",

    "8. Tekanan permintaan: wisnus per kamar 2025 (tertinggi & terendah)": """
        (select provinsi, wisnus, kamar_akomodasi, wisnus_per_kamar, tpk_rata from v_integrasi_provinsi_tahun
         where tahun = 2025 and wisnus_per_kamar is not null order by wisnus_per_kamar desc limit 4)
        union all
        (select provinsi, wisnus, kamar_akomodasi, wisnus_per_kamar, tpk_rata from v_integrasi_provinsi_tahun
         where tahun = 2025 and wisnus_per_kamar is not null order by wisnus_per_kamar asc limit 3)""",

    "9. TPK provinsi 2025 tertinggi/terendah": """
        (select provinsi, tpk_rata from v_integrasi_provinsi_tahun where tahun = 2025 and tpk_rata is not null order by tpk_rata desc limit 5)
        union all
        (select provinsi, tpk_rata from v_integrasi_provinsi_tahun where tahun = 2025 and tpk_rata is not null order by tpk_rata asc limit 3)""",

    "10. Pertumbuhan kapasitas kamar 2021→2025 per provinsi (top)": """
        with a as (select provinsi, tahun, kamar_akomodasi from v_integrasi_provinsi_tahun where tahun in (2021, 2025))
        select x.provinsi, x.kamar_akomodasi as kamar_2021, y.kamar_akomodasi as kamar_2025,
               round(100.0 * (y.kamar_akomodasi - x.kamar_akomodasi) / nullif(x.kamar_akomodasi, 0), 1) as tumbuh_pct
        from a x join a y on x.provinsi = y.provinsi and x.tahun = 2021 and y.tahun = 2025
        where x.kamar_akomodasi > 0 order by tumbuh_pct desc nulls last limit 6""",

    "11. Nasional: kamar & usaha akomodasi 2021–2025": """
        select tahun, usaha_akomodasi, kamar_akomodasi, kamar_hotel_bintang, yoy_kamar
        from v_kpi_tahunan where kamar_akomodasi is not null order by tahun""",

    "12. World Bank: Indonesia vs ASEAN 2019–2020": """
        select negara_nama,
               max(nilai) filter (where indikator_kode = 'ST.INT.ARVL' and waktu_id = 201900) as arrivals_2019,
               max(nilai) filter (where indikator_kode = 'ST.INT.ARVL' and waktu_id = 202000) as arrivals_2020,
               max(nilai) filter (where indikator_kode = 'ST.INT.RCPT.CD' and waktu_id = 201900) as receipts_2019,
               round((max(nilai) filter (where indikator_kode = 'ST.INT.RCPT.CD' and waktu_id = 201900)
                    / nullif(max(nilai) filter (where indikator_kode = 'ST.INT.ARVL' and waktu_id = 201900), 0))::numeric, 0) as usd_per_arrival_2019
        from fact_wb_pariwisata group by negara_nama order by arrivals_2019 desc nulls last""",

    "13. Validasi lintas sumber: wisman BPS vs kedatangan World Bank": """
        select k.tahun, k.total_wisman as bps, k.kedatangan_wb as world_bank,
               round(100.0 * (k.total_wisman - k.kedatangan_wb) / k.kedatangan_wb, 2) as selisih_pct
        from v_kpi_tahunan k where k.kedatangan_wb is not null and k.total_wisman is not null order by tahun""",
}


def main():
    with psycopg.connect(database_url()) as conn, conn.cursor() as cur:
        for title, sql in QUERIES.items():
            cur.execute(sql)
            cols = [d.name for d in cur.description]
            print(f"\n### {title}")
            print(" | ".join(cols))
            for row in cur.fetchall():
                print(" | ".join("" if v is None else str(v) for v in row))


if __name__ == "__main__":
    main()
