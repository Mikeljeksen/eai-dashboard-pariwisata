-- =====================================================================
-- 0002_seed_dim_provinsi.sql — Master data 38 provinsi + agregat nasional
-- Kode mengikuti Kode Wilayah BPS (Permendagri 2022 untuk 4 provinsi baru).
-- Alias ditulis dalam bentuk ternormalisasi (HURUF BESAR, tanpa titik,
-- spasi tunggal) — sama dengan fungsi normalisasi di etl/transform/common.py.
-- =====================================================================

insert into public.dim_provinsi (kode_bps, nama, pulau, region, kode_induk, tahun_dibentuk, is_nasional, alias) values
 (0,  'Indonesia',                 'Nasional',          'Nasional',          null, null, true,  '{INDONESIA,NASIONAL,TOTAL}'),
 (11, 'Aceh',                      'Sumatera',          'Indonesia Barat',   null, null, false, '{ACEH,NANGGROE ACEH DARUSSALAM,NAD}'),
 (12, 'Sumatera Utara',            'Sumatera',          'Indonesia Barat',   null, null, false, '{SUMATERA UTARA,SUMUT,NORTH SUMATERA}'),
 (13, 'Sumatera Barat',            'Sumatera',          'Indonesia Barat',   null, null, false, '{SUMATERA BARAT,SUMBAR,WEST SUMATERA}'),
 (14, 'Riau',                      'Sumatera',          'Indonesia Barat',   null, null, false, '{RIAU}'),
 (15, 'Jambi',                     'Sumatera',          'Indonesia Barat',   null, null, false, '{JAMBI}'),
 (16, 'Sumatera Selatan',          'Sumatera',          'Indonesia Barat',   null, null, false, '{SUMATERA SELATAN,SUMSEL,SOUTH SUMATERA}'),
 (17, 'Bengkulu',                  'Sumatera',          'Indonesia Barat',   null, null, false, '{BENGKULU}'),
 (18, 'Lampung',                   'Sumatera',          'Indonesia Barat',   null, null, false, '{LAMPUNG}'),
 (19, 'Kepulauan Bangka Belitung', 'Sumatera',          'Indonesia Barat',   null, null, false, '{KEP BANGKA BELITUNG,KEPULAUAN BANGKA BELITUNG,BANGKA BELITUNG,BABEL}'),
 (21, 'Kepulauan Riau',            'Sumatera',          'Indonesia Barat',   null, null, false, '{KEP RIAU,KEPULAUAN RIAU,KEPRI}'),
 (31, 'DKI Jakarta',               'Jawa',              'Indonesia Barat',   null, null, false, '{DKI JAKARTA,JAKARTA,DAERAH KHUSUS IBUKOTA JAKARTA,DAERAH KHUSUS JAKARTA}'),
 (32, 'Jawa Barat',                'Jawa',              'Indonesia Barat',   null, null, false, '{JAWA BARAT,JABAR,WEST JAVA}'),
 (33, 'Jawa Tengah',               'Jawa',              'Indonesia Barat',   null, null, false, '{JAWA TENGAH,JATENG,CENTRAL JAVA}'),
 (34, 'DI Yogyakarta',             'Jawa',              'Indonesia Barat',   null, null, false, '{DI YOGYAKARTA,D I YOGYAKARTA,DAERAH ISTIMEWA YOGYAKARTA,YOGYAKARTA,DIY}'),
 (35, 'Jawa Timur',                'Jawa',              'Indonesia Barat',   null, null, false, '{JAWA TIMUR,JATIM,EAST JAVA}'),
 (36, 'Banten',                    'Jawa',              'Indonesia Barat',   null, null, false, '{BANTEN}'),
 (51, 'Bali',                      'Bali-Nusa Tenggara','Indonesia Tengah',  null, null, false, '{BALI}'),
 (52, 'Nusa Tenggara Barat',       'Bali-Nusa Tenggara','Indonesia Tengah',  null, null, false, '{NUSA TENGGARA BARAT,NTB}'),
 (53, 'Nusa Tenggara Timur',       'Bali-Nusa Tenggara','Indonesia Tengah',  null, null, false, '{NUSA TENGGARA TIMUR,NTT}'),
 (61, 'Kalimantan Barat',          'Kalimantan',        'Indonesia Tengah',  null, null, false, '{KALIMANTAN BARAT,KALBAR}'),
 (62, 'Kalimantan Tengah',         'Kalimantan',        'Indonesia Tengah',  null, null, false, '{KALIMANTAN TENGAH,KALTENG}'),
 (63, 'Kalimantan Selatan',        'Kalimantan',        'Indonesia Tengah',  null, null, false, '{KALIMANTAN SELATAN,KALSEL}'),
 (64, 'Kalimantan Timur',          'Kalimantan',        'Indonesia Tengah',  null, null, false, '{KALIMANTAN TIMUR,KALTIM}'),
 (65, 'Kalimantan Utara',          'Kalimantan',        'Indonesia Tengah',  null, null, false, '{KALIMANTAN UTARA,KALTARA}'),
 (71, 'Sulawesi Utara',            'Sulawesi',          'Indonesia Tengah',  null, null, false, '{SULAWESI UTARA,SULUT}'),
 (72, 'Sulawesi Tengah',           'Sulawesi',          'Indonesia Tengah',  null, null, false, '{SULAWESI TENGAH,SULTENG}'),
 (73, 'Sulawesi Selatan',          'Sulawesi',          'Indonesia Tengah',  null, null, false, '{SULAWESI SELATAN,SULSEL}'),
 (74, 'Sulawesi Tenggara',         'Sulawesi',          'Indonesia Tengah',  null, null, false, '{SULAWESI TENGGARA,SULTRA}'),
 (75, 'Gorontalo',                 'Sulawesi',          'Indonesia Tengah',  null, null, false, '{GORONTALO}'),
 (76, 'Sulawesi Barat',            'Sulawesi',          'Indonesia Tengah',  null, null, false, '{SULAWESI BARAT,SULBAR}'),
 (81, 'Maluku',                    'Maluku',            'Indonesia Timur',   null, null, false, '{MALUKU}'),
 (82, 'Maluku Utara',              'Maluku',            'Indonesia Timur',   null, null, false, '{MALUKU UTARA,MALUT}'),
 (91, 'Papua Barat',               'Papua',             'Indonesia Timur',   null, null, false, '{PAPUA BARAT,IRIAN JAYA BARAT}'),
 (94, 'Papua',                     'Papua',             'Indonesia Timur',   null, null, false, '{PAPUA}')
on conflict (kode_bps) do update set
  nama = excluded.nama, pulau = excluded.pulau, region = excluded.region,
  is_nasional = excluded.is_nasional, alias = excluded.alias;

-- Provinsi hasil pemekaran 2022 (UU 14, 15, 16 & 29 Tahun 2022)
insert into public.dim_provinsi (kode_bps, nama, pulau, region, kode_induk, tahun_dibentuk, is_nasional, alias) values
 (92, 'Papua Barat Daya',  'Papua', 'Indonesia Timur', 91, 2022, false, '{PAPUA BARAT DAYA}'),
 (95, 'Papua Selatan',     'Papua', 'Indonesia Timur', 94, 2022, false, '{PAPUA SELATAN}'),
 (96, 'Papua Tengah',      'Papua', 'Indonesia Timur', 94, 2022, false, '{PAPUA TENGAH}'),
 (97, 'Papua Pegunungan',  'Papua', 'Indonesia Timur', 94, 2022, false, '{PAPUA PEGUNUNGAN}')
on conflict (kode_bps) do update set
  nama = excluded.nama, kode_induk = excluded.kode_induk,
  tahun_dibentuk = excluded.tahun_dibentuk, alias = excluded.alias;
