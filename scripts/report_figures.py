"""Membuat gambar untuk laporan Word (docs/figures/*.png).

    python -m scripts.report_figures

Semua data diambil dari hub Supabase Postgres (view & tabel fakta),
bukan dari file mentah — konsisten dengan prinsip data-level EAI.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import psycopg
from matplotlib.collections import PatchCollection
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch, Polygon

from etl.config import ROOT, database_url

OUT = ROOT / "docs" / "figures"
OUT.mkdir(parents=True, exist_ok=True)

VIOLET, BLUE, GREEN, CYAN, PINK, AMBER, INK, GREY = (
    "#7c3aed", "#2563eb", "#10b981", "#0891b2", "#db2777", "#d97706", "#1f2937", "#6b7280")
plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 9.5, "axes.titlesize": 11, "axes.titleweight": "bold",
    "axes.spines.top": False, "axes.spines.right": False, "axes.edgecolor": "#9ca3af",
    "axes.grid": True, "grid.color": "#e5e7eb", "grid.linestyle": "--", "grid.linewidth": 0.7,
    "axes.axisbelow": True, "figure.dpi": 100, "savefig.dpi": 200, "savefig.bbox": "tight",
    "legend.frameon": False,
})


def q(sql: str) -> pd.DataFrame:
    with psycopg.connect(database_url()) as c, c.cursor() as cur:
        cur.execute(sql)
        cols = [d.name for d in cur.description]
        return pd.DataFrame(cur.fetchall(), columns=cols)


def save(fig, name):
    fig.savefig(OUT / name, facecolor="white")
    plt.close(fig)
    print("✔", name)


def juta(x, _=None):
    if abs(x) >= 1e6:
        v = x / 1e6
        return f"{v:.0f} jt" if v >= 10 or v == int(v) else f"{v:.1f} jt".replace(".", ",")
    return f"{x/1e3:.0f} rb"


# ---------------------------------------------------------------- arsitektur
def fig_arsitektur():
    fig, ax = plt.subplots(figsize=(11, 4.2))
    ax.set_xlim(-1, 111); ax.set_ylim(0, 42); ax.axis("off")

    def box(x, y, w, h, title, sub, color):
        ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.4,rounding_size=1.6",
                                    fc=color + "18", ec=color, lw=1.6))
        ax.text(x + w / 2, y + h - 2.6, title, ha="center", va="top", weight="bold", color=INK, fontsize=10)
        ax.text(x + w / 2, y + h - 6.6, sub, ha="center", va="top", color=GREY, fontsize=7.6, linespacing=1.35)

    def arrow(x1, y1, x2, y2, style="-|>", ls="-", color=INK):
        ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle=style, mutation_scale=13,
                                     color=color, lw=1.4, linestyle=ls))

    srcs = [("D1 TPK hotel", "XLSX", VIOLET), ("D2 Wisnus", "CSV", BLUE), ("D3 Wisman", "CSV", BLUE),
            ("D4 World Bank", "JSON", AMBER), ("D5 Akomodasi", "PDF", PINK)]
    ax.text(9, 41, "SUMBER (data/raw)", ha="center", weight="bold", fontsize=8.5, color=GREY)
    for i, (n, f, c) in enumerate(srcs):
        y = 33 - i * 7.2
        ax.add_patch(FancyBboxPatch((0, y), 19, 5, boxstyle="round,pad=0.3,rounding_size=1", fc=c + "22", ec=c, lw=1.2))
        ax.text(1, y + 2.5, n, va="center", fontsize=8, color=INK)
        ax.text(18.4, y + 2.5, f, va="center", ha="right", fontsize=7.2, weight="bold", color=c)
        arrow(19.6, y + 2.5, 23, 20)

    box(23.5, 11, 15, 18, "EXTRACT", "1 modul per format\ncsv · xlsx · json\npdf (pdfplumber)\nbaca apa adanya", VIOLET)
    box(43, 11, 17, 18, "TRANSFORM", "wide → long\nalias provinsi\nangka format ID\n'-' / '…' → NULL\nvalidasi & dedup", BLUE)
    box(64.5, 11, 15, 18, "LOAD", "COPY → tabel temp\nINSERT … ON\nCONFLICT DO UPDATE\n(idempoten)", GREEN)
    box(84, 9, 25, 22, "HUB", "Supabase Postgres\n\nstar schema\ndim_provinsi · dim_waktu\n5 tabel fakta\nview analitik · RLS", CYAN)
    arrow(38.9, 20, 42.6, 20); arrow(60.4, 20, 64.1, 20); arrow(79.9, 20, 83.6, 20)

    ax.add_patch(FancyBboxPatch((25, 0.5), 54, 5.5, boxstyle="round,pad=0.3,rounding_size=1", fc="#f3f4f6", ec=GREY, lw=1))
    ax.text(52, 3.25, "etl_run · etl_step_log · data/rejected/*.csv", ha="center", va="center", fontsize=8, color=INK)
    for x in (31, 51.5, 72):
        arrow(x, 10.6, x, 6.3, style="-|>", ls=(0, (3, 2)), color=GREY)

    ax.add_patch(FancyBboxPatch((87, 35), 18, 5.5, boxstyle="round,pad=0.3,rounding_size=1", fc=VIOLET + "18", ec=VIOLET, lw=1.2))
    ax.text(96, 37.75, "Next.js Dashboard", ha="center", va="center", fontsize=8.5, weight="bold", color=INK)
    arrow(96, 31.6, 96, 34.6)
    ax.text(97, 33, "SELECT (RLS)", fontsize=7, color=GREY)

    ax.add_patch(FancyBboxPatch((23.5, 35), 22, 5.5, boxstyle="round,pad=0.3,rounding_size=1", fc=AMBER + "18", ec=AMBER, lw=1.2))
    ax.text(34.5, 37.75, "GitHub Actions · cron mingguan", ha="center", va="center", fontsize=8, color=INK)
    arrow(34.5, 34.6, 31, 29.6, ls=(0, (3, 2)), color=AMBER)
    ax.text(36, 31.5, "one-way sync", fontsize=7.5, color=AMBER, style="italic")
    save(fig, "01_arsitektur.png")


# ---------------------------------------------------------------- tren
def fig_tren(tren):
    fig, ax = plt.subplots(figsize=(10, 3.9))
    x = tren["tanggal_awal"]
    ax.axvspan(pd.Timestamp("2020-03-01"), pd.Timestamp("2022-12-31"), color=PINK, alpha=0.08)
    ax.text(pd.Timestamp("2021-07-15"), 1.62e6, "Periode COVID-19\n(Mar 2020 – Des 2022)", ha="center", color=PINK, fontsize=8.5)
    ax.plot(x, tren["wisman"], color=VIOLET, lw=2, label="Kunjungan wisman (sumbu kiri)")
    ax.fill_between(x, tren["wisman"].astype(float), color=VIOLET, alpha=0.08)
    ax.yaxis.set_major_formatter(juta); ax.set_ylim(0, 1.8e6)
    ax2 = ax.twinx(); ax2.grid(False)
    ax2.plot(x, tren["wisnus"], color=GREEN, lw=1.8, label="Perjalanan wisnus (sumbu kanan)")
    ax2.yaxis.set_major_formatter(juta); ax2.set_ylim(0, 1.5e8); ax2.spines["right"].set_visible(True)
    h1, l1 = ax.get_legend_handles_labels(); h2, l2 = ax2.get_legend_handles_labels()
    ax.legend(h1 + h2, l1 + l2, loc="upper center", bbox_to_anchor=(0.5, -0.1), ncol=2, fontsize=8.5)
    ax.set_title("Tren bulanan wisman dan wisnus, 2018–2025")
    save(fig, "02_tren_bulanan.png")


def fig_tpk(tren):
    fig, ax = plt.subplots(figsize=(10, 3.3))
    x = tren["tanggal_awal"]; y = tren["tpk"].astype(float)
    avg19 = y[tren["tahun"] == 2019].mean()
    ax.axvspan(pd.Timestamp("2020-03-01"), pd.Timestamp("2022-12-31"), color=PINK, alpha=0.08)
    ax.plot(x, y, color=CYAN, lw=2); ax.fill_between(x, y, color=CYAN, alpha=0.1)
    ax.axhline(avg19, color=AMBER, ls="--", lw=1.3)
    ax.text(x.iloc[-1], avg19 + 1.5, f"Rata-rata 2019 = {avg19:.1f}%", ha="right", color=AMBER, fontsize=8.5)
    lo = y.idxmin()
    ax.annotate(f"Titik terendah\n{tren.loc[lo,'label']}: {y[lo]:.2f}%", (x[lo], y[lo]), (x[lo] + pd.Timedelta(days=200), 8),
                fontsize=8, arrowprops=dict(arrowstyle="->", color=GREY))
    ax.set_ylim(0, 70); ax.yaxis.set_major_formatter(lambda v, _: f"{v:.0f}%")
    ax.set_title("Tingkat Penghunian Kamar (TPK) hotel bintang nasional per bulan")
    save(fig, "03_tpk_bulanan.png")


def fig_pemulihan(kpi):
    k = kpi[kpi.tahun.between(2018, 2025)].set_index("tahun")
    b = k.loc[2019]
    idx = pd.DataFrame({
        "Wisman": 100 * k.total_wisman.astype(float) / float(b.total_wisman),
        "Wisnus": 100 * k.total_wisnus.astype(float) / float(b.total_wisnus),
        "TPK": 100 * k.rata_tpk.astype(float) / float(b.rata_tpk),
    })
    fig, ax = plt.subplots(figsize=(10, 3.6))
    w = 0.26; xs = np.arange(len(idx))
    for i, (col, c) in enumerate(zip(idx.columns, [VIOLET, GREEN, CYAN])):
        bars = ax.bar(xs + (i - 1) * w, idx[col], w, color=c, label=col)
        for bx, v in zip(bars, idx[col]):
            if not math.isnan(v):
                ax.text(bx.get_x() + bx.get_width() / 2, v + 2, f"{v:.0f}", ha="center", fontsize=7, color=INK)
    ax.axhline(100, color=AMBER, ls="--", lw=1.2); ax.text(len(idx) - 0.5, 92, "Level 2019 = 100", color=AMBER, fontsize=8, ha="right")
    ax.set_xticks(xs, idx.index.astype(str)); ax.legend(ncol=3, loc="upper left"); ax.set_ylim(0, 185)
    ax.set_title("Indeks dampak COVID-19 dan pemulihan (2019 = 100)")
    save(fig, "04_pemulihan.png")


def fig_musiman(tren):
    t = tren.copy(); t["wisman"] = t["wisman"].astype(float)
    t["idx"] = t.groupby("tahun")["wisman"].transform(lambda s: s / s.mean() * 100)
    piv = t.pivot(index="tahun", columns="bulan", values="idx")
    fig, ax = plt.subplots(figsize=(10, 3.8))
    im = ax.imshow(piv.values, cmap="viridis", vmin=60, vmax=140, aspect="auto")
    ax.set_xticks(range(12), ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"])
    ax.set_yticks(range(len(piv)), piv.index.astype(str)); ax.grid(False)
    for i in range(piv.shape[0]):
        for j in range(piv.shape[1]):
            v = piv.values[i, j]
            if not np.isnan(v):
                ax.text(j, i, f"{v:.0f}", ha="center", va="center", fontsize=7.2, color="white" if v < 115 else INK)
    cb = fig.colorbar(im, ax=ax, fraction=0.025, pad=0.01); cb.set_label("indeks (100 = rata-rata tahun)")
    ax.set_title("Indeks musiman kunjungan wisman per bulan")
    save(fig, "05_musiman_wisman.png")


def fig_pintu():
    d = q("""select w.tahun, f.pintu_masuk, sum(jumlah_kunjungan)::float n
             from fact_wisman f join dim_waktu w using (waktu_id) where w.tahun in (2019, 2025) group by 1, 2""")
    tot = d.groupby("tahun").n.transform("sum"); d["pangsa"] = 100 * d.n / tot
    top = d[d.tahun == 2025].nlargest(8, "n").pintu_masuk.tolist()
    p = d[d.pintu_masuk.isin(top)].pivot(index="pintu_masuk", columns="tahun", values="pangsa").loc[top[::-1]]
    fig, ax = plt.subplots(figsize=(10, 3.6))
    ys = np.arange(len(p))
    ax.barh(ys + 0.2, p[2019], 0.38, color="#c4b5fd", label="2019")
    ax.barh(ys - 0.2, p[2025], 0.38, color=VIOLET, label="2025")
    for y, v in zip(ys, p[2025]):
        ax.text(v + 0.6, y - 0.2, f"{v:.1f}%", va="center", fontsize=7.5)
    ax.set_yticks(ys, p.index); ax.xaxis.set_major_formatter(lambda v, _: f"{v:.0f}%")
    ax.legend(loc="lower right"); ax.set_title("Pangsa kunjungan wisman menurut pintu masuk, 2019 vs 2025")
    save(fig, "06_pintu_masuk.png")


def fig_peta():
    geo = json.loads((ROOT / "public" / "geo" / "indonesia-38-provinsi.geojson").read_text())
    d = q("select provinsi_kode, wisnus::float from v_integrasi_provinsi_tahun where tahun = 2025")
    val = {int(r.provinsi_kode): r.wisnus for r in d.itertuples()}
    patches, colors = [], []
    for f in geo["features"]:
        k = int(f["properties"]["KODE_PROV"]); g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        for poly in polys:
            patches.append(Polygon(np.array(poly[0]), closed=True))
            colors.append(math.log10(val[k]) if val.get(k) else np.nan)
    fig, ax = plt.subplots(figsize=(10, 4))
    pc = PatchCollection(patches, cmap="viridis", edgecolor="white", linewidth=0.3)
    pc.set_array(np.array(colors)); ax.add_collection(pc)
    ax.set_xlim(94.5, 141.5); ax.set_ylim(-11.5, 6.5); ax.set_aspect("equal"); ax.axis("off")
    cb = fig.colorbar(pc, ax=ax, fraction=0.025, pad=0.01)
    ticks = [6, 7, 8]; cb.set_ticks(ticks); cb.set_ticklabels(["1 jt", "10 jt", "100 jt"]); cb.set_label("perjalanan (skala log)")
    ax.set_title("Perjalanan wisnus menurut provinsi tujuan, 2025 (38 provinsi)")
    save(fig, "07_peta_wisnus.png")


def fig_ranking():
    d = q("""select provinsi, pulau, wisnus::float, tpk_rata::float, kamar_akomodasi::float
             from v_integrasi_provinsi_tahun where tahun = 2025 order by wisnus desc limit 12""")[::-1]
    pal = {"Jawa": BLUE, "Sumatera": VIOLET, "Bali-Nusa Tenggara": PINK, "Kalimantan": GREEN,
           "Sulawesi": CYAN, "Maluku": AMBER, "Papua": "#ea580c"}
    fig, ax = plt.subplots(figsize=(10, 3.9))
    ax.barh(d.provinsi, d.wisnus, color=[pal[p] for p in d.pulau])
    for y, v in enumerate(d.wisnus):
        ax.text(v + 2e6, y, juta(v), va="center", fontsize=7.5)
    ax.xaxis.set_major_formatter(juta)
    handles = [plt.Rectangle((0, 0), 1, 1, color=c) for c in pal.values()]
    ax.legend(handles, pal.keys(), fontsize=7.5, ncol=4, loc="lower right")
    ax.set_title("12 provinsi tujuan wisnus terbesar, 2025")
    save(fig, "08_ranking_wisnus.png")


def fig_korelasi():
    d = q("""select provinsi, pulau, wisnus::float, tpk_rata::float, kamar_akomodasi::float
             from v_integrasi_provinsi_tahun where tahun = 2025 and wisnus > 0 and kamar_akomodasi > 0""")
    fig, axs = plt.subplots(1, 2, figsize=(10, 3.9))
    a, b = axs
    lx, ly = np.log10(d.kamar_akomodasi), np.log10(d.wisnus)
    r1 = np.corrcoef(lx, ly)[0, 1]
    a.scatter(d.kamar_akomodasi, d.wisnus, s=28, color=VIOLET, alpha=0.8, edgecolor="white")
    m, c0 = np.polyfit(lx, ly, 1); xx = np.linspace(lx.min(), lx.max(), 20)
    a.plot(10 ** xx, 10 ** (m * xx + c0), color=AMBER, lw=1.4)
    a.set_xscale("log"); a.set_yscale("log"); a.set_xlabel("Kamar akomodasi (D5, PDF)"); a.set_ylabel("Perjalanan wisnus (D2, CSV)")
    a.set_title(f"Kapasitas vs permintaan (r log = {r1:.2f})")
    for nama, off in [("Jawa Timur", (-70, 6)), ("Jawa Tengah", (-72, 4)), ("Bali", (-30, 14))]:
        r = d[d.provinsi == nama].iloc[0]
        a.annotate(nama, (r.kamar_akomodasi, r.wisnus), fontsize=7, xytext=off, textcoords="offset points",
                   arrowprops=dict(arrowstyle="-", color=GREY, lw=0.6))
    t = d.dropna(subset=["tpk_rata"])
    r2 = np.corrcoef(np.log10(t.wisnus), t.tpk_rata)[0, 1]
    sz = 15 + 180 * np.sqrt(t.kamar_akomodasi / t.kamar_akomodasi.max())
    b.scatter(t.wisnus, t.tpk_rata, s=sz, color=CYAN, alpha=0.65, edgecolor="white")
    b.set_xscale("log"); b.set_xlabel("Perjalanan wisnus (D2, CSV)"); b.set_ylabel("TPK hotel bintang % (D1, XLSX)")
    b.set_title(f"Permintaan vs hunian (r = {r2:.2f})")
    for _, r in t.nlargest(2, "tpk_rata").iterrows():
        b.annotate(r.provinsi, (r.wisnus, r.tpk_rata), fontsize=7, xytext=(5, 2), textcoords="offset points")
    fig.suptitle("Korelasi lintas dataset per provinsi, 2025 (n = %d)" % len(d), fontweight="bold", fontsize=11)
    fig.tight_layout()
    save(fig, "09_korelasi.png")


def fig_kapasitas(kpi):
    k = kpi[kpi.kamar_akomodasi.notna()].copy()
    fig, ax = plt.subplots(figsize=(10, 3.4))
    ax.bar(k.tahun.astype(str), k.kamar_akomodasi.astype(float), color="#bfdbfe", label="Kamar semua akomodasi (D5)")
    ax.bar(k.tahun.astype(str), k.kamar_hotel_bintang.astype(float), color=BLUE, width=0.5, label="Kamar hotel bintang (D5)")
    ax.yaxis.set_major_formatter(lambda v, _: f"{v/1e3:.0f} rb"); ax.set_ylim(0, 1.15e6)
    ax2 = ax.twinx(); ax2.grid(False); ax2.spines["right"].set_visible(True)
    ax2.plot(k.tahun.astype(str), k.rata_tpk.astype(float), color=PINK, marker="o", lw=2, label="Rata-rata TPK (D1)")
    for x, v in zip(k.tahun.astype(str), k.rata_tpk.astype(float)):
        ax2.text(x, v + 1.2, f"{v:.1f}%", ha="center", color=PINK, fontsize=8)
    ax2.set_ylim(20, 65); ax2.yaxis.set_major_formatter(lambda v, _: f"{v:.0f}%")
    h1, l1 = ax.get_legend_handles_labels(); h2, l2 = ax2.get_legend_handles_labels()
    ax.legend(h1 + h2, l1 + l2, loc="upper left", fontsize=8)
    ax.set_title("Kapasitas kamar nasional vs tingkat hunian, 2021–2025")
    save(fig, "10_kapasitas_vs_tpk.png")


def fig_asean():
    d = q("""select negara_nama, waktu_id/100 tahun, nilai::float from fact_wb_pariwisata
             where indikator_kode = 'ST.INT.ARVL' order by tahun""")
    fig, ax = plt.subplots(figsize=(10, 3.5))
    cols = {"Indonesia": VIOLET, "Thailand": BLUE, "Malaysia": GREEN, "Singapura": PINK, "Vietnam": CYAN, "Filipina": AMBER}
    for n, c in cols.items():
        s = d[d.negara_nama == n]
        ax.plot(s.tahun, s.nilai, color=c, lw=3 if n == "Indonesia" else 1.5, marker="o", ms=3 if n != "Indonesia" else 4, label=n)
    ax.yaxis.set_major_formatter(juta); ax.legend(ncol=6, fontsize=8, loc="upper left")
    ax.set_title("Kedatangan wisatawan internasional, Indonesia vs ASEAN (World Bank, 2010–2020)")
    save(fig, "11_asean.png")


def fig_etl():
    d = q("""select dataset, max(baris_keluar) filter (where tahap = 'L') dimuat,
                    max(baris_dibuang) filter (where tahap = 'T') dibuang
             from etl_step_log where run_id = (select max(run_id) from etl_run where status = 'success')
             group by dataset order by dataset""")
    labels = ["D1 TPK\n(XLSX)", "D2 Wisnus\n(CSV)", "D3 Wisman\n(CSV)", "D4 World Bank\n(JSON)", "D5 Akomodasi\n(PDF)"]
    fig, ax = plt.subplots(figsize=(10, 3.2))
    ax.bar(labels, d.dimuat, color=GREEN, label="Dimuat ke hub")
    ax.bar(labels, d.dibuang, bottom=d.dimuat, color=PINK, label="Dibuang (tercatat + alasan)")
    for i, (a, b) in enumerate(zip(d.dimuat, d.dibuang)):
        ax.text(i, a / 2, f"{a:,}".replace(",", "."), ha="center", color="white", fontsize=8.5, weight="bold")
        ax.text(i, a + b + 60, f"{b:,}".replace(",", "."), ha="center", color=PINK, fontsize=8)
    ax.legend(loc="upper right"); ax.set_ylabel("baris")
    ax.set_title("Hasil tahap Transform → Load per sumber (run ETL terakhir)")
    save(fig, "12_etl_baris.png")


if __name__ == "__main__":
    tren = q("select * from v_tren_bulanan order by waktu_id")
    tren["tanggal_awal"] = pd.to_datetime(tren["tanggal_awal"])
    kpi = q("select * from v_kpi_tahunan order by tahun")
    fig_arsitektur(); fig_tren(tren); fig_tpk(tren); fig_pemulihan(kpi); fig_musiman(tren)
    fig_pintu(); fig_peta(); fig_ranking(); fig_korelasi(); fig_kapasitas(kpi); fig_asean(); fig_etl()
