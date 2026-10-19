"""Konfigurasi ETL: lokasi file dan katalog 5 sumber data."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
REF_DIR = ROOT / "data" / "reference"
REJECTED_DIR = ROOT / "data" / "rejected"
MIGRATIONS_DIR = ROOT / "supabase" / "migrations"

# .env.local (lokal) atau environment variable (GitHub Actions)
load_dotenv(ROOT / ".env.local")
load_dotenv(ROOT / ".env")


def database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL belum di-set (lihat .env.example)")
    return url


@dataclass(frozen=True)
class Sumber:
    dataset: str          # id singkat, juga dipakai di etl_step_log
    judul: str
    penerbit: str
    format: str           # CSV / XLSX / JSON / PDF
    url: str
    cakupan: str
    tabel_fakta: str
    deskripsi: str
    raw_glob: str         # pola file mentah di data/raw


SUMBER: dict[str, Sumber] = {
    "d1_tpk_hotel": Sumber(
        dataset="d1_tpk_hotel",
        judul="Tingkat Penghunian Kamar (TPK) Hotel Bintang menurut Provinsi",
        penerbit="Badan Pusat Statistik (BPS)",
        format="XLSX",
        url="https://www.bps.go.id/id/statistics-table/2/MTIyIzI=/tingkat-penghunian-kamar-hotel.html",
        cakupan="38 provinsi + nasional, bulanan, 2018–2025",
        tabel_fakta="fact_tpk_hotel",
        deskripsi="Persentase malam kamar terpakai terhadap malam kamar tersedia di hotel bintang.",
        raw_glob="d1_tpk_hotel_bintang/*.xlsx",
    ),
    "d2_wisnus": Sumber(
        dataset="d2_wisnus",
        judul="Jumlah Perjalanan Wisatawan Nusantara menurut Provinsi Tujuan",
        penerbit="Badan Pusat Statistik (BPS)",
        format="CSV",
        url="https://www.bps.go.id/id/statistics-table/2/MjIwMSMy/jumlah-perjalanan-wisatawan-nusantara-menurut-provinsi-tujuan--perjalanan-.html",
        cakupan="38 provinsi + nasional, bulanan, 2019–2025",
        tabel_fakta="fact_wisnus",
        deskripsi="Perjalanan wisatawan domestik (mobile positioning data) menurut provinsi tujuan.",
        raw_glob="d2_wisnus_provinsi/*.csv",
    ),
    "d3_wisman": Sumber(
        dataset="d3_wisman",
        judul="Jumlah Kunjungan Wisatawan Mancanegara per Bulan menurut Pintu Masuk",
        penerbit="Badan Pusat Statistik (BPS)",
        format="CSV",
        url="https://www.bps.go.id/id/statistics-table/2/MTE1MCMy/jumlah-kunjungan-wisatawan-mancanegara-per-bulan-ke-indonesia-menurut-pintu-masuk--2008---sekarang--kunjungan-.html",
        cakupan="26 pintu masuk utama + 'lainnya', bulanan, 2018–2025",
        tabel_fakta="fact_wisman",
        deskripsi="Kunjungan wisman per pintu masuk udara/laut/darat; dipetakan ke provinsi lokasi pintu masuk.",
        raw_glob="d3_wisman_pintu_masuk/*.csv",
    ),
    "d4_worldbank": Sumber(
        dataset="d4_worldbank",
        judul="International Tourism Indicators (WDI) — Indonesia & ASEAN",
        penerbit="World Bank (data UN Tourism)",
        format="JSON",
        url="https://api.worldbank.org/v2/country/IDN;THA;MYS;VNM;SGP;PHL/indicator/ST.INT.ARVL;ST.INT.RCPT.CD;ST.INT.XPND.CD;ST.INT.DPRT?source=2&format=json&date=2010:2024&per_page=1000",
        cakupan="6 negara ASEAN, tahunan, 2010–2020 (nilai 2021+ belum dirilis)",
        tabel_fakta="fact_wb_pariwisata",
        deskripsi="Kedatangan & keberangkatan internasional, penerimaan & pengeluaran pariwisata (US$).",
        raw_glob="d4_worldbank_tourism/*.json",
    ),
    "d5_akomodasi": Sumber(
        dataset="d5_akomodasi",
        judul="Statistik Hotel dan Akomodasi Lainnya di Indonesia 2025 (Lampiran 1, 2, 5, 6)",
        penerbit="Badan Pusat Statistik (BPS)",
        format="PDF",
        url="https://www.bps.go.id/id/publication/2025/12/31/cc7df681d36107bb009a1e82/statistik-hotel-dan-akomodasi-lainnya-di-indonesia-2025.html",
        cakupan="38 provinsi + nasional, tahunan, 2021–2025",
        tabel_fakta="fact_akomodasi",
        deskripsi="Jumlah usaha dan kamar untuk seluruh akomodasi dan hotel bintang, diekstrak dari tabel PDF.",
        raw_glob="d5_akomodasi_pdf/*.pdf",
    ),
}
