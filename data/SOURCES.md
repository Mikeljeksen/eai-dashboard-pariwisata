# Sumber Data

Kelima dataset bertema **Pariwisata Indonesia**, semuanya publik (tanpa login/API key), dan disimpan dalam **format aslinya** di `data/raw/`. Tidak ada konversi manual: semua pembersihan terjadi di pipeline ETL (`etl/`).

Tanggal akses semua sumber: **19 Oktober 2026**.

| # | Dataset | Penerbit | Format | Cakupan | Kunci integrasi |
|---|---------|----------|--------|---------|-----------------|
| D1 | TPK Hotel Bintang | BPS | **XLSX** | 38 prov + nasional, bulanan 2018–2025 | provinsi, tahun-bulan |
| D2 | Perjalanan Wisatawan Nusantara menurut Provinsi Tujuan | BPS | **CSV** | 38 prov + nasional, bulanan 2019–2025 | provinsi, tahun-bulan |
| D3 | Kunjungan Wisman per Bulan menurut Pintu Masuk | BPS | **CSV** | 26 pintu masuk + lainnya, bulanan 2018–2025 | pintu masuk → provinsi, tahun-bulan |
| D4 | International Tourism (WDI) Indonesia & ASEAN | World Bank | **JSON** | 6 negara, tahunan 2010–2020 | tahun (nasional) |
| D5 | Statistik Hotel dan Akomodasi Lainnya di Indonesia 2025 (Lampiran 1, 2, 5, 6) | BPS | **PDF** | 38 prov + nasional, tahunan 2021–2025 | provinsi, tahun |

Empat format berbeda: XLSX, CSV, JSON, PDF.

---

## D1 — Tingkat Penghunian Kamar (TPK) Hotel Bintang
- **Penerbit:** Badan Pusat Statistik (BPS), tabel statistik subjek Pariwisata
- **URL:** https://www.bps.go.id/id/statistics-table/2/MTIyIzI=/tingkat-penghunian-kamar-hotel.html
- **Format:** XLSX (8 file, satu per tahun: `data/raw/d1_tpk_hotel_bintang/`)
- **Cakupan:** 38 provinsi + baris INDONESIA, Januari 2018 – Desember 2025, satuan persen
- **Lisensi/akses:** data publik BPS; boleh dipakai dengan menyebut sumber (Kebijakan Diseminasi BPS)
- **Alasan dipilih:** indikator utama kinerja akomodasi; bulanan sehingga memperlihatkan musiman dan dampak COVID-19.

## D2 — Jumlah Perjalanan Wisatawan Nusantara menurut Provinsi Tujuan
- **Penerbit:** BPS (berbasis *mobile positioning data*)
- **URL:** https://www.bps.go.id/id/statistics-table/2/MjIwMSMy/jumlah-perjalanan-wisatawan-nusantara-menurut-provinsi-tujuan--perjalanan-.html
- **Format:** CSV (7 file, 2019–2025: `data/raw/d2_wisnus_provinsi/`)
- **Cakupan:** 38 provinsi + nasional, bulanan, satuan perjalanan. Tabel BPS hanya tersedia mulai 2019.
- **Lisensi/akses:** data publik BPS
- **Alasan dipilih:** sisi permintaan domestik per provinsi, bisa dipasangkan dengan TPK dan kapasitas kamar.

## D3 — Jumlah Kunjungan Wisatawan Mancanegara per Bulan menurut Pintu Masuk
- **Penerbit:** BPS
- **URL:** https://www.bps.go.id/id/statistics-table/2/MTE1MCMy/jumlah-kunjungan-wisatawan-mancanegara-per-bulan-ke-indonesia-menurut-pintu-masuk--2008---sekarang--kunjungan-.html
- **Format:** CSV (8 file, 2018–2025: `data/raw/d3_wisman_pintu_masuk/`)
- **Cakupan:** 15 bandara, 6 pelabuhan, 5 pos lintas batas darat utama, serta kelompok "lainnya"; bulanan; satuan kunjungan
- **Lisensi/akses:** data publik BPS
- **Alasan dipilih:** sumber resmi kunjungan wisman. Pintu masuk dipetakan ke provinsi (`data/reference/pintu_masuk_provinsi.csv`) agar bisa diintegrasikan.

## D4 — World Bank WDI: International Tourism
- **Penerbit:** World Bank (World Development Indicators; data asal UN Tourism)
- **URL (API, tanpa key):** https://api.worldbank.org/v2/country/IDN;THA;MYS;VNM;SGP;PHL/indicator/ST.INT.ARVL;ST.INT.RCPT.CD;ST.INT.XPND.CD;ST.INT.DPRT?source=2&format=json&date=2010:2024&per_page=1000
- **Format:** JSON (`data/raw/d4_worldbank_tourism/worldbank_tourism_asean_2010_2024.json`)
- **Cakupan:** Indonesia, Thailand, Malaysia, Vietnam, Singapura, Filipina; tahunan. Data diminta untuk 2010–2024, tetapi World Bank baru merilis nilai hingga **2020**. Nilai null untuk 2021+ dibuang dan dicatat di ETL.
- **Lisensi:** CC BY 4.0 (World Bank Open Data)
- **Alasan dipilih:** sumber JSON publik tanpa API key. Menambah dimensi ekonomi (penerimaan devisa dalam US$) dan pembanding regional ASEAN. Beririsan dengan data BPS pada 2018–2020 (sebelum dan saat COVID).

## D5 — Statistik Hotel dan Akomodasi Lainnya di Indonesia 2025
- **Penerbit:** BPS (Nomor Publikasi 06300.25009, rilis 31 Desember 2025)
- **URL:** https://www.bps.go.id/id/publication/2025/12/31/cc7df681d36107bb009a1e82/statistik-hotel-dan-akomodasi-lainnya-di-indonesia-2025.html
- **Format:** PDF, 176 halaman, 22 MB (`data/raw/d5_akomodasi_pdf/`)
- **Tabel yang diekstrak:** Lampiran 1 (usaha akomodasi), Lampiran 2 (kamar akomodasi), Lampiran 5 (usaha hotel bintang), Lampiran 6 (kamar hotel bintang), masing-masing per provinsi untuk 2021–2025
- **Lisensi/akses:** publikasi publik BPS
- **Alasan dipilih:** sisi penawaran (kapasitas) per provinsi, yang hanya tersedia dalam publikasi PDF. Tabelnya diekstrak dengan pdfplumber.

---

## Catatan pengambilan data
- **BPS (D1–D3):** situs bps.go.id memblokir unduhan lewat script (HTTP 403 dari Cloudflare). File diunduh lewat browser memakai tombol **Unduh → XLSX/CSV** di tiap tabel (satu file per tahun), lalu salinan mentahnya disimpan di repo. ETL memproses salinan mentah ini.
- **BPS PDF (D5):** diunduh langsung dari tautan "Unduh Publikasi" (`web-api.bps.go.id/download.php`).
- **World Bank (D4):** diunduh dengan `curl` dari API publik.
- **Peta (bukan dataset analisis):** GeoJSON 38 provinsi dari [denyherianto/indonesia-geojson-topojson-maps-with-38-provinces](https://github.com/denyherianto/indonesia-geojson-topojson-maps-with-38-provinces), lisensi CC BY 4.0. Perubahan: properti `KODE_PROV` untuk provinsi Papua disesuaikan dengan kode BPS berdasarkan nama provinsi (file sumber memakai kode 91/92 untuk beberapa provinsi).
