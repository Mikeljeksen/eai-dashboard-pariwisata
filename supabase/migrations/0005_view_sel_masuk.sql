-- 0005 — Tambah kolom sel_masuk (input tahap Transform) ke ringkasan sumber,
-- agar kartu sumber menampilkan masuk = keluar + dibuang secara konsisten.
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
       (array_agg(l.catatan_transformasi) filter (where l.tahap = 'T'))[1] as catatan_transformasi,
       max(case when l.tahap = 'T' then l.baris_masuk end)   as sel_masuk
from public.sumber_data s
left join public.etl_step_log l
       on l.dataset = s.dataset and l.run_id = (select run_id from last_run)
group by s.dataset, s.judul, s.penerbit, s.format, s.url, s.cakupan, s.tabel_fakta, s.deskripsi;

revoke all on public.v_etl_ringkasan_sumber from anon;
grant select on public.v_etl_ringkasan_sumber to authenticated;
