-- =====================================================================
-- 0001_schema.sql — Skema dimensional hub integrasi pariwisata
-- Model: star schema (dim_provinsi, dim_waktu + 5 tabel fakta)
--        + tabel metadata ETL (etl_run, etl_step_log)
-- =====================================================================

-- ---------------------------------------------------------------------
-- DIMENSI PROVINSI
-- Menyimpan 38 provinsi (kode BPS) + 1 baris agregat nasional (kode 0).
-- Pemekaran Papua 2022: 4 provinsi baru (92, 95, 96, 97) menunjuk ke
-- provinsi induknya lewat kode_induk, sehingga data bisa di-roll-up ke
-- basis 34 provinsi untuk analisis runtun waktu yang konsisten.
-- ---------------------------------------------------------------------
create table if not exists public.dim_provinsi (
    kode_bps        smallint primary key,
    nama            text        not null unique,
    pulau           text        not null,
    region          text        not null,  -- Indonesia Barat / Tengah / Timur
    kode_induk      smallint    references public.dim_provinsi (kode_bps),
    tahun_dibentuk  smallint,               -- diisi untuk provinsi hasil pemekaran 2022
    is_nasional     boolean     not null default false,
    alias           text[]      not null default '{}'  -- variasi penulisan nama di sumber data
);

comment on column public.dim_provinsi.alias is
  'Variasi nama provinsi di berbagai sumber (dinormalisasi: huruf besar, tanpa titik). Dipakai ETL untuk pencocokan nama.';
comment on column public.dim_provinsi.kode_induk is
  'Untuk provinsi pemekaran 2022 (Papua Barat Daya, Papua Selatan, Papua Tengah, Papua Pegunungan): kode provinsi induk.';

-- ---------------------------------------------------------------------
-- DIMENSI WAKTU
-- waktu_id = tahun*100 + bulan  (bulan = 0 untuk periode tahunan)
-- ---------------------------------------------------------------------
create table if not exists public.dim_waktu (
    waktu_id      integer primary key,
    tahun         smallint not null,
    bulan         smallint not null check (bulan between 0 and 12),
    kuartal       smallint check (kuartal between 1 and 4),
    granularitas  text     not null check (granularitas in ('bulanan', 'tahunan')),
    label         text     not null,
    tanggal_awal  date     not null
);

create index if not exists dim_waktu_tahun_idx on public.dim_waktu (tahun);

insert into public.dim_waktu (waktu_id, tahun, bulan, kuartal, granularitas, label, tanggal_awal)
select y * 100, y, 0, null, 'tahunan', y::text, make_date(y, 1, 1)
from generate_series(2010, 2030) as y
on conflict (waktu_id) do nothing;

insert into public.dim_waktu (waktu_id, tahun, bulan, kuartal, granularitas, label, tanggal_awal)
select y * 100 + m, y, m, ((m - 1) / 3) + 1, 'bulanan',
       (array['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'])[m] || ' ' || y,
       make_date(y, m, 1)
from generate_series(2010, 2030) as y, generate_series(1, 12) as m
on conflict (waktu_id) do nothing;

-- ---------------------------------------------------------------------
-- METADATA ETL
-- ---------------------------------------------------------------------
create table if not exists public.etl_run (
    run_id        bigint generated always as identity primary key,
    mulai         timestamptz not null default now(),
    selesai       timestamptz,
    status        text        not null default 'running'
                  check (status in ('running', 'success', 'failed')),
    trigger       text        not null check (trigger in ('manual', 'scheduled')),
    catatan       text
);

create table if not exists public.etl_step_log (
    log_id              bigint generated always as identity primary key,
    run_id              bigint      not null references public.etl_run (run_id) on delete cascade,
    dataset             text        not null,
    format_sumber       text        not null,
    tahap               char(1)     not null check (tahap in ('E', 'T', 'L')),
    baris_masuk         integer     not null default 0,
    baris_keluar        integer     not null default 0,
    baris_dibuang       integer     not null default 0,
    alasan_dibuang      jsonb       not null default '{}'::jsonb,  -- {"alasan": jumlah}
    catatan_transformasi text,
    durasi_ms           integer     not null default 0,
    dicatat_pada        timestamptz not null default now()
);

create index if not exists etl_step_log_run_idx on public.etl_step_log (run_id);

-- Katalog sumber data (diisi ETL, ditampilkan di halaman Pipeline)
create table if not exists public.sumber_data (
    dataset        text primary key,
    judul          text not null,
    penerbit       text not null,
    format         text not null,
    url            text not null,
    cakupan        text not null,
    tabel_fakta    text not null,
    deskripsi      text
);

-- ---------------------------------------------------------------------
-- TABEL FAKTA (satu per dataset)
-- ---------------------------------------------------------------------

-- D1 — Tingkat Penghunian Kamar (TPK) hotel bintang, provinsi × bulan [XLSX]
create table if not exists public.fact_tpk_hotel (
    provinsi_kode  smallint     not null references public.dim_provinsi (kode_bps),
    waktu_id       integer      not null references public.dim_waktu (waktu_id),
    tpk_persen     numeric(5,2) check (tpk_persen between 0 and 100),
    run_id         bigint       references public.etl_run (run_id),
    primary key (provinsi_kode, waktu_id)
);

-- D2 — Perjalanan wisatawan nusantara menurut provinsi tujuan × bulan [CSV]
create table if not exists public.fact_wisnus (
    provinsi_kode      smallint not null references public.dim_provinsi (kode_bps),
    waktu_id           integer  not null references public.dim_waktu (waktu_id),
    jumlah_perjalanan  bigint   check (jumlah_perjalanan >= 0),
    run_id             bigint   references public.etl_run (run_id),
    primary key (provinsi_kode, waktu_id)
);

-- D3 — Kunjungan wisatawan mancanegara menurut pintu masuk × bulan [CSV]
-- provinsi_kode = lokasi pintu masuk (hasil pemetaan ETL), NULL untuk "Lainnya"
create table if not exists public.fact_wisman (
    pintu_masuk       text     not null,
    jenis_pintu       text     not null check (jenis_pintu in ('udara', 'laut', 'darat', 'lainnya')),
    provinsi_kode     smallint references public.dim_provinsi (kode_bps),
    waktu_id          integer  not null references public.dim_waktu (waktu_id),
    jumlah_kunjungan  bigint   check (jumlah_kunjungan >= 0),
    run_id            bigint   references public.etl_run (run_id),
    primary key (pintu_masuk, waktu_id)
);

create index if not exists fact_wisman_prov_idx on public.fact_wisman (provinsi_kode);

-- D4 — Indikator pariwisata internasional World Bank (Indonesia + ASEAN) × tahun [JSON]
create table if not exists public.fact_wb_pariwisata (
    negara_iso3     char(3)  not null,
    negara_nama     text     not null,
    waktu_id        integer  not null references public.dim_waktu (waktu_id),
    indikator_kode  text     not null,
    indikator_nama  text     not null,
    satuan          text     not null,
    nilai           numeric,
    run_id          bigint   references public.etl_run (run_id),
    primary key (negara_iso3, waktu_id, indikator_kode)
);

-- D5 — Jumlah usaha & kamar akomodasi menurut provinsi × tahun [PDF]
create table if not exists public.fact_akomodasi (
    provinsi_kode  smallint not null references public.dim_provinsi (kode_bps),
    waktu_id       integer  not null references public.dim_waktu (waktu_id),
    kategori       text     not null check (kategori in ('semua_akomodasi', 'hotel_bintang')),
    jumlah_usaha   integer  check (jumlah_usaha >= 0),
    jumlah_kamar   integer  check (jumlah_kamar >= 0),
    run_id         bigint   references public.etl_run (run_id),
    primary key (provinsi_kode, waktu_id, kategori)
);
