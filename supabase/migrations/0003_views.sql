-- =====================================================================
-- 0003_views.sql — View analitik siap pakai untuk dashboard
-- Semua view memakai security_invoker = true sehingga RLS tabel dasar
-- tetap berlaku untuk user yang memanggil (anon tidak melihat apa pun).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tren bulanan nasional: wisman (jumlah semua pintu masuk), wisnus
-- (baris agregat nasional BPS), TPK hotel bintang nasional.
-- ---------------------------------------------------------------------
create or replace view public.v_tren_bulanan
with (security_invoker = true) as
with wisman as (
    select waktu_id, sum(jumlah_kunjungan) as wisman
    from public.fact_wisman group by waktu_id
),
wisnus as (
    select waktu_id, jumlah_perjalanan as wisnus
    from public.fact_wisnus where provinsi_kode = 0
),
tpk as (
    select waktu_id, tpk_persen as tpk
    from public.fact_tpk_hotel where provinsi_kode = 0
)
select w.waktu_id, w.tahun, w.bulan, w.label, w.tanggal_awal,
       wm.wisman, wn.wisnus, t.tpk
from public.dim_waktu w
left join wisman wm on wm.waktu_id = w.waktu_id
left join wisnus wn on wn.waktu_id = w.waktu_id
left join tpk    t  on t.waktu_id  = w.waktu_id
where w.granularitas = 'bulanan'
  and (wm.wisman is not null or wn.wisnus is not null or t.tpk is not null);

-- ---------------------------------------------------------------------
-- KPI tahunan + perubahan YoY (hanya bulan yang sudah terisi dihitung;
-- kolom bulan_terisi memberi tahu bila tahun berjalan belum lengkap).
-- ---------------------------------------------------------------------
create or replace view public.v_kpi_tahunan
with (security_invoker = true) as
with b as (
    select tahun,
           sum(wisman)  as total_wisman,
           sum(wisnus)  as total_wisnus,
           avg(tpk)     as rata_tpk,
           count(wisman) as bulan_wisman,
           count(wisnus) as bulan_wisnus,
           count(tpk)    as bulan_tpk
    from public.v_tren_bulanan group by tahun
),
ak as (
    select w.tahun,
           max(case when a.kategori = 'semua_akomodasi' then a.jumlah_kamar end) as kamar_akomodasi,
           max(case when a.kategori = 'hotel_bintang'   then a.jumlah_kamar end) as kamar_hotel_bintang,
           max(case when a.kategori = 'semua_akomodasi' then a.jumlah_usaha end) as usaha_akomodasi
    from public.fact_akomodasi a join public.dim_waktu w using (waktu_id)
    where a.provinsi_kode = 0
    group by w.tahun
),
wb as (
    select w.tahun,
           max(case when f.indikator_kode = 'ST.INT.RCPT.CD' then f.nilai end) as penerimaan_usd,
           max(case when f.indikator_kode = 'ST.INT.ARVL'    then f.nilai end) as kedatangan_wb
    from public.fact_wb_pariwisata f join public.dim_waktu w using (waktu_id)
    where f.negara_iso3 = 'IDN'
    group by w.tahun
),
gab as (
    select coalesce(b.tahun, ak.tahun, wb.tahun) as tahun,
           b.total_wisman, b.total_wisnus, round(b.rata_tpk, 2) as rata_tpk,
           b.bulan_wisman, b.bulan_wisnus, b.bulan_tpk,
           ak.kamar_akomodasi, ak.kamar_hotel_bintang, ak.usaha_akomodasi,
           wb.penerimaan_usd, wb.kedatangan_wb
    from b
    full join ak on ak.tahun = b.tahun
    full join wb on wb.tahun = coalesce(b.tahun, ak.tahun)
)
select g.*,
       round(100.0 * (total_wisman - lag(total_wisman) over w) / nullif(lag(total_wisman) over w, 0), 2) as yoy_wisman,
       round(100.0 * (total_wisnus - lag(total_wisnus) over w) / nullif(lag(total_wisnus) over w, 0), 2) as yoy_wisnus,
       round(rata_tpk - lag(rata_tpk) over w, 2) as delta_tpk_poin,
       round(100.0 * (kamar_akomodasi - lag(kamar_akomodasi) over w) / nullif(lag(kamar_akomodasi) over w, 0), 2) as yoy_kamar
from gab g
window w as (order by tahun);

-- ---------------------------------------------------------------------
-- Tabel integrasi provinsi × tahun — menggabungkan kelima dataset.
-- Kerangka = semua provinsi (non-nasional) × tahun 2018–2025.
-- ---------------------------------------------------------------------
create or replace view public.v_integrasi_provinsi_tahun
with (security_invoker = true) as
with kerangka as (
    select p.kode_bps as provinsi_kode, p.nama as provinsi, p.pulau, p.region,
           p.kode_induk, y.tahun
    from public.dim_provinsi p
    cross join (select generate_series(2018, 2025)::smallint as tahun) y
    where not p.is_nasional
),
wisnus as (
    select f.provinsi_kode, w.tahun, sum(f.jumlah_perjalanan) as wisnus, count(f.jumlah_perjalanan) as bulan_wisnus
    from public.fact_wisnus f join public.dim_waktu w using (waktu_id)
    group by 1, 2
),
tpk as (
    select f.provinsi_kode, w.tahun, round(avg(f.tpk_persen), 2) as tpk_rata, count(f.tpk_persen) as bulan_tpk
    from public.fact_tpk_hotel f join public.dim_waktu w using (waktu_id)
    group by 1, 2
),
wisman as (
    select f.provinsi_kode, w.tahun, sum(f.jumlah_kunjungan) as wisman_pintu_masuk
    from public.fact_wisman f join public.dim_waktu w using (waktu_id)
    where f.provinsi_kode is not null
    group by 1, 2
),
ak as (
    select a.provinsi_kode, w.tahun,
           max(case when a.kategori = 'semua_akomodasi' then a.jumlah_usaha end) as usaha_akomodasi,
           max(case when a.kategori = 'semua_akomodasi' then a.jumlah_kamar end) as kamar_akomodasi,
           max(case when a.kategori = 'hotel_bintang'   then a.jumlah_usaha end) as usaha_hotel_bintang,
           max(case when a.kategori = 'hotel_bintang'   then a.jumlah_kamar end) as kamar_hotel_bintang
    from public.fact_akomodasi a join public.dim_waktu w using (waktu_id)
    group by 1, 2
)
select k.provinsi_kode, k.provinsi, k.pulau, k.region, k.kode_induk, k.tahun,
       wn.wisnus, wn.bulan_wisnus, t.tpk_rata, t.bulan_tpk,
       coalesce(wm.wisman_pintu_masuk, 0) as wisman_pintu_masuk,
       ak.usaha_akomodasi, ak.kamar_akomodasi, ak.usaha_hotel_bintang, ak.kamar_hotel_bintang,
       round(wn.wisnus::numeric / nullif(ak.kamar_akomodasi, 0), 1) as wisnus_per_kamar
from kerangka k
left join wisnus wn on wn.provinsi_kode = k.provinsi_kode and wn.tahun = k.tahun
left join tpk    t  on t.provinsi_kode  = k.provinsi_kode and t.tahun  = k.tahun
left join wisman wm on wm.provinsi_kode = k.provinsi_kode and wm.tahun = k.tahun
left join ak        on ak.provinsi_kode = k.provinsi_kode and ak.tahun = k.tahun
where wn.wisnus is not null or t.tpk_rata is not null or ak.kamar_akomodasi is not null
   or wm.wisman_pintu_masuk is not null;

-- ---------------------------------------------------------------------
-- Tabel data panjang (long format) — semua fakta dalam satu bentuk,
-- dipakai halaman /data (pencarian, filter dataset, export CSV).
-- ---------------------------------------------------------------------
create or replace view public.v_data_terintegrasi
with (security_invoker = true) as
select 'D1 TPK Hotel Bintang'::text as dataset, 'XLSX'::text as format,
       p.nama as wilayah, f.provinsi_kode, w.tahun, w.bulan, w.label as periode,
       'TPK hotel bintang'::text as metrik, '%'::text as satuan, f.tpk_persen::numeric as nilai
from public.fact_tpk_hotel f
join public.dim_provinsi p on p.kode_bps = f.provinsi_kode
join public.dim_waktu w using (waktu_id)
union all
select 'D2 Wisatawan Nusantara', 'CSV', p.nama, f.provinsi_kode, w.tahun, w.bulan, w.label,
       'Perjalanan wisnus (provinsi tujuan)', 'perjalanan', f.jumlah_perjalanan
from public.fact_wisnus f
join public.dim_provinsi p on p.kode_bps = f.provinsi_kode
join public.dim_waktu w using (waktu_id)
union all
select 'D3 Wisatawan Mancanegara', 'CSV', f.pintu_masuk || coalesce(' (' || p.nama || ')', ''),
       f.provinsi_kode, w.tahun, w.bulan, w.label,
       'Kunjungan wisman via pintu ' || f.jenis_pintu, 'kunjungan', f.jumlah_kunjungan
from public.fact_wisman f
left join public.dim_provinsi p on p.kode_bps = f.provinsi_kode
join public.dim_waktu w using (waktu_id)
union all
select 'D4 World Bank', 'JSON', f.negara_nama, null, w.tahun, w.bulan, w.label,
       f.indikator_nama, f.satuan, f.nilai
from public.fact_wb_pariwisata f
join public.dim_waktu w using (waktu_id)
union all
select 'D5 Akomodasi (PDF)', 'PDF', p.nama, f.provinsi_kode, w.tahun, w.bulan, w.label,
       case f.kategori when 'hotel_bintang' then 'Kamar hotel bintang' else 'Kamar semua akomodasi' end,
       'kamar', f.jumlah_kamar
from public.fact_akomodasi f
join public.dim_provinsi p on p.kode_bps = f.provinsi_kode
join public.dim_waktu w using (waktu_id)
union all
select 'D5 Akomodasi (PDF)', 'PDF', p.nama, f.provinsi_kode, w.tahun, w.bulan, w.label,
       case f.kategori when 'hotel_bintang' then 'Usaha hotel bintang' else 'Usaha semua akomodasi' end,
       'usaha', f.jumlah_usaha
from public.fact_akomodasi f
join public.dim_provinsi p on p.kode_bps = f.provinsi_kode
join public.dim_waktu w using (waktu_id);

-- ---------------------------------------------------------------------
-- Ringkasan per sumber dari run ETL terakhir yang sukses (halaman Pipeline)
-- ---------------------------------------------------------------------
create or replace view public.v_etl_ringkasan_sumber
with (security_invoker = true) as
with last_run as (
    select run_id from public.etl_run where status = 'success' order by run_id desc limit 1
)
select s.dataset, s.judul, s.penerbit, s.format, s.url, s.cakupan, s.tabel_fakta, s.deskripsi,
       max(case when l.tahap = 'E' then l.baris_keluar end)  as baris_diekstrak,
       max(case when l.tahap = 'T' then l.baris_keluar end)  as baris_ditransformasi,
       max(case when l.tahap = 'T' then l.baris_dibuang end) as baris_dibuang,
       max(case when l.tahap = 'L' then l.baris_keluar end)  as baris_dimuat,
       sum(l.durasi_ms) as durasi_ms,
       (array_agg(l.alasan_dibuang) filter (where l.tahap = 'T'))[1] as alasan_dibuang,
       (array_agg(l.catatan_transformasi) filter (where l.tahap = 'T'))[1] as catatan_transformasi
from public.sumber_data s
left join public.etl_step_log l
       on l.dataset = s.dataset and l.run_id = (select run_id from last_run)
group by s.dataset, s.judul, s.penerbit, s.format, s.url, s.cakupan, s.tabel_fakta, s.deskripsi;
