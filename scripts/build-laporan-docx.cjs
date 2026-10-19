/**
 * Menyusun laporan Word (docs/Laporan_EAI_Pariwisata_Indonesia.docx).
 *   node scripts/build-laporan-docx.cjs
 * Gambar diambil dari docs/figures (dibuat oleh scripts/report_figures.py dari database hub).
 */
const fs = require("fs");
const path = require("path");
const {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun, LevelFormat,
  Packer, PageBreak, PageNumber, Paragraph, ShadingType, Table, TableCell, TableOfContents, TableRow,
  TabStopType, TextRun, VerticalAlign, WidthType,
} = require("docx");

const ROOT = path.resolve(__dirname, "..");
const FIG = path.join(ROOT, "docs", "figures");
const OUT = path.join(ROOT, "docs", "Laporan_EAI_Pariwisata_Indonesia.docx");

const FONT = "Times New Roman";
const ACCENT = "4C1D95";
const CONTENT_W = 9026; // A4 (11906) - 2 × 1440

/* ------------------------------------------------------------------ helpers */
// **tebal**, *miring*, `kode`
function runs(text, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    const t = m[0];
    if (t.startsWith("**")) out.push(new TextRun({ text: t.slice(2, -2), bold: true, ...base }));
    else if (t.startsWith("`")) out.push(new TextRun({ text: t.slice(1, -1), font: "Consolas", size: 20, ...base }));
    else out.push(new TextRun({ text: t.slice(1, -1), italics: true, ...base }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}

const P = (text, opts = {}) =>
  new Paragraph({ children: runs(text, opts.run), alignment: opts.align ?? AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: 360 }, indent: opts.indent === false ? undefined : { firstLine: opts.firstLine ?? 0 }, ...opts.p });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)], pageBreakBefore: true });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const H3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] });
const B = (t, level = 0) => new Paragraph({ numbering: { reference: "bullets", level }, children: runs(t),
  alignment: AlignmentType.JUSTIFIED, spacing: { after: 60, line: 340 } });
const N = (t, ref = "num1") => new Paragraph({ numbering: { reference: ref, level: 0 }, children: runs(t),
  alignment: AlignmentType.JUSTIFIED, spacing: { after: 60, line: 340 } });
const Code = (lines) => lines.map((l, i) => new Paragraph({
  children: [new TextRun({ text: l, font: "Consolas", size: 18 })],
  shading: { type: ShadingType.CLEAR, fill: "F3F4F6", color: "auto" },
  spacing: { before: i === 0 ? 60 : 0, after: i === lines.length - 1 ? 160 : 0, line: 260 },
  indent: { left: 200 },
}));
const PB = () => new Paragraph({ children: [new PageBreak()] });

let figNo = 0, tabNo = 0;
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
function Figure(file, caption, widthPx = 600) {
  const f = path.join(FIG, file);
  const { w, h } = pngSize(f);
  figNo += 1;
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, keepNext: true,
      children: [new ImageRun({ type: "png", data: fs.readFileSync(f),
        transformation: { width: widthPx, height: Math.round((widthPx * h) / w) },
        altText: { title: caption, description: caption, name: file } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
      children: [new TextRun({ text: `Gambar ${figNo}. `, bold: true, size: 20 }), new TextRun({ text: caption, size: 20, italics: true })] }),
  ];
}

const border = { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" };
const borders = { top: border, bottom: border, left: border, right: border };
function Tbl(caption, headers, rows, widths, opts = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  const cell = (text, w, head = false, shade) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders, verticalAlign: VerticalAlign.CENTER,
    shading: head ? { type: ShadingType.CLEAR, fill: "EDE9FE", color: "auto" } : shade ? { type: ShadingType.CLEAR, fill: shade, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: String(text).split("\n").map((line) => new Paragraph({ spacing: { after: 0, line: 260 },
      alignment: opts.align?.[widths.indexOf(w)] ?? AlignmentType.LEFT,
      children: runs(line, { size: 19, bold: head || undefined }) })),
  });
  tabNo += 1;
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160, after: 80 }, keepNext: true,
      children: [new TextRun({ text: `Tabel ${tabNo}. `, bold: true, size: 20 }), new TextRun({ text: caption, size: 20, italics: true })] }),
    new Table({
      width: { size: total, type: WidthType.DXA }, columnWidths: widths,
      rows: [
        new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, widths[i], true)) }),
        ...rows.map((r, ri) => new TableRow({ children: r.map((c, i) => cell(c, widths[i], false, ri % 2 ? "FAFAFA" : undefined)) })),
      ],
    }),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
  ];
}
const Callout = (title, text) => new Table({
  width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [CONTENT_W],
  rows: [new TableRow({ children: [new TableCell({
    width: { size: CONTENT_W, type: WidthType.DXA },
    borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.SINGLE, size: 24, color: "7C3AED" } },
    shading: { type: ShadingType.CLEAR, fill: "F5F3FF", color: "auto" },
    margins: { top: 100, bottom: 100, left: 200, right: 160 },
    children: [new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: title, bold: true, color: ACCENT, size: 21 })] }),
      ...text.map((t) => new Paragraph({ spacing: { after: 40, line: 300 }, alignment: AlignmentType.JUSTIFIED, children: runs(t, { size: 21 }) }))],
  })] })],
});

/* --------------------------------------------------------------- insight */
function Insight(no, judul, temuan, interpretasi, verif) {
  const out = [
    H3(`8.${no} ${judul}`),
    new Paragraph({ spacing: { after: 80, line: 340 }, alignment: AlignmentType.JUSTIFIED,
      children: [new TextRun({ text: "Temuan dan angka. ", bold: true }), ...runs(temuan)] }),
    new Paragraph({ spacing: { after: 80, line: 340 }, alignment: AlignmentType.JUSTIFIED,
      children: [new TextRun({ text: "Interpretasi. ", bold: true }), ...runs(interpretasi)] }),
  ];
  if (verif) out.push(new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: `[VERIFIKASI] ${verif}`, italics: true, color: "B45309", size: 20 })] }));
  return out;
}

/* ===================================================================== */
const cover = [
  new Paragraph({ spacing: { before: 1400, after: 200 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "LAPORAN TUGAS KELOMPOK", bold: true, size: 28, color: "6B7280" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
    children: [new TextRun({ text: "Integrasi Data Pariwisata Indonesia dengan Pendekatan", bold: true, size: 36, color: ACCENT })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 },
    children: [new TextRun({ text: "Data-level Enterprise Application Integration", bold: true, size: 36, color: ACCENT, italics: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
    children: [new TextRun({ text: "Studi Kasus: Nusantara Tourism Hub — Dashboard EVD dari 5 Sumber Data Heterogen", size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 900 },
    children: [new TextRun({ text: "Mata Kuliah Enterprise Application Integration", size: 24, italics: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: "Disusun oleh:", size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: "Kelompok [nomor/nama kelompok]", bold: true, size: 24 })] }),
  ...["[Nama Anggota 1] — [NIM]", "[Nama Anggota 2] — [NIM]", "[Nama Anggota 3] — [NIM]", "[Nama Anggota 4] — [NIM]"].map((t) =>
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: t, size: 24 })] })),
  new Paragraph({ spacing: { before: 1200 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "PROGRAM STUDI TEKNOLOGI SAINS DATA", bold: true, size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "FAKULTAS TEKNOLOGI MAJU DAN MULTIDISIPLIN", bold: true, size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "UNIVERSITAS AIRLANGGA", bold: true, size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "2026", bold: true, size: 24 })] }),
];

const kataPengantar = [
  new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun("KATA PENGANTAR")], alignment: AlignmentType.CENTER }),
  P("Puji syukur kami panjatkan ke hadirat Tuhan Yang Maha Esa karena atas rahmat-Nya laporan tugas kelompok mata kuliah Enterprise Application Integration (EAI) dengan topik *Data-level EAI* ini dapat diselesaikan. Laporan ini mendokumentasikan perancangan dan implementasi **Nusantara Tourism Hub**, yaitu website dashboard *exploratory data visualization* (EVD) pariwisata Indonesia yang dibangun di atas integrasi lima dataset publik berformat berbeda ke dalam satu basis data terpusat.", { firstLine: 567 }),
  P("Laporan disusun untuk menjelaskan secara utuh pekerjaan yang dilakukan, mulai dari pemilihan sumber data, arsitektur integrasi, pipeline Extract–Transform–Load (ETL), skema basis data, fitur website, hingga analisis insight yang diperoleh dari hasil integrasi. Semua angka di dalam laporan diambil langsung dari basis data hasil integrasi, bukan dari file mentah.", { firstLine: 567 }),
  P("Kami mengucapkan terima kasih kepada dosen pengampu mata kuliah atas bimbingannya, serta kepada Badan Pusat Statistik dan World Bank yang menyediakan data secara terbuka. Kami menyadari laporan ini masih memiliki kekurangan, sehingga kritik dan saran sangat kami harapkan.", { firstLine: 567 }),
  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 400 }, children: [new TextRun("Surabaya, Oktober 2026")] }),
  new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Tim Penyusun", bold: true })] }),
];

const toc = [
  new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun("DAFTAR ISI")], alignment: AlignmentType.CENTER }),
  new TableOfContents("Daftar Isi", { hyperlink: true, headingStyleRange: "1-2" }),
  new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: "Catatan: bila nomor halaman belum tampil, klik kanan pada daftar isi lalu pilih Update Field (atau tekan F9).", italics: true, size: 18, color: "6B7280" })] }),
];

const ringkasan = [
  H1("RINGKASAN EKSEKUTIF"),
  P("Proyek ini mengintegrasikan **lima dataset publik pariwisata Indonesia** dalam **empat format berbeda** (XLSX, CSV, JSON, PDF) dari Badan Pusat Statistik (BPS) dan World Bank ke **satu hub data terpusat berbasis Supabase PostgreSQL** melalui pipeline **Extract → Transform → Load** yang ditulis dalam Python. Di atas hub dibangun website dashboard berbasis Next.js dengan fitur **login** dan **exploratory data visualization**. Dashboard hanya membaca dari hub dan tidak pernah membaca file mentah, sesuai prinsip data-level EAI."),
  ...Tbl("Ringkasan capaian proyek", ["Aspek", "Hasil"], [
    ["Sumber data", "5 dataset · 4 format (XLSX, CSV, JSON, PDF) · 27 file mentah"],
    ["Volume ETL (run terakhir)", "11.520 sel diproses → **9.936 baris dimuat**, 1.214 dibuang beserta alasannya"],
    ["Kualitas data", "0% NULL pada kolom nilai, 0 FK tidak valid, rekonsiliasi Σprovinsi = nasional cocok 84/84 bulan"],
    ["Validasi lintas sumber", "Total wisman BPS (CSV) = kedatangan World Bank (JSON) 2018–2020, selisih 0,00%"],
    ["Idempotensi", "Run ulang: \"0 baru, 3.456 diperbarui\" — tidak ada duplikasi"],
    ["Sinkronisasi", "GitHub Actions mingguan (one-way sync), run terjadwal tercatat sukses"],
    ["Website", "5 halaman (login/register, Overview, Provinsi, Pipeline, Data) · live di Vercel"],
    ["Keamanan", "RLS aktif; anon ditolak di semua tabel/view; authenticated hanya SELECT"],
  ], [2600, 6426]),
  P("Insight utama yang diperoleh antara lain: (1) wisman anjlok 74,8% pada 2020 sedangkan wisnus hanya turun 27,4%; (2) wisnus 2025 sudah mencapai 166% level 2019, sementara wisman baru 95,5%; (3) kapasitas kamar akomodasi naik 34,8% sejak 2021, tetapi TPK hotel bintang 2025 masih 4,6 poin di bawah 2019; (4) Jawa menyerap 64,8% wisnus dengan hanya 44,5% kamar; dan (5) antarprovinsi, jumlah kamar berkorelasi sangat kuat dengan wisnus (r = 0,91), tetapi wisnus hanya berkorelasi lemah dengan tingkat hunian (r = 0,37)."),
  ...Tbl("Tautan dan akses", ["Item", "Nilai"], [
    ["Website (produksi)", "https://eai-dashboard-pariwisata.vercel.app"],
    ["Repository kode", "https://github.com/Mikeljeksen/eai-dashboard-pariwisata"],
    ["Akun demo", "Email: `demo@pariwisata.id`\nPassword: `Demo-KPjFK4wp1GMUFx!9`"],
  ], [2600, 6426]),
];

/* -------------------------------------------------------------- BAB 1 */
const bab1 = [
  H1("BAB 1  PENDAHULUAN"),
  H2("1.1 Latar Belakang"),
  P("Pariwisata merupakan salah satu sektor penting perekonomian Indonesia, baik sebagai penghasil devisa melalui wisatawan mancanegara (wisman) maupun penggerak ekonomi daerah melalui perjalanan wisatawan nusantara (wisnus). Data mengenai sektor ini sebenarnya tersedia secara terbuka, tetapi tersebar di berbagai penerbit dan format. BPS merilis tabel statistik bulanan yang dapat diunduh dalam XLSX dan CSV, publikasi tahunan dalam bentuk PDF, sementara lembaga internasional seperti World Bank menyediakan data melalui API berformat JSON.", { firstLine: 567 }),
  P("Keragaman tersebut menimbulkan masalah heterogenitas yang khas dalam integrasi data. Nama provinsi ditulis berbeda (\"KEP. RIAU\", \"Kepulauan Riau\"), format angka berbeda (\"1.412\" sebagai ribuan, \"49.17\" sebagai desimal), penanda nilai kosong bervariasi (\"-\", \"…\", \"—\"), tabel disajikan dalam bentuk lebar dengan kolom bulan, bahkan publikasi PDF membawa artefak seperti watermark yang ikut terbaca. Akibatnya, pertanyaan analitis lintas sumber, misalnya *apakah provinsi dengan banyak wisatawan juga memiliki tingkat hunian hotel yang tinggi?*, tidak dapat dijawab hanya dengan membuka masing-masing file.", { firstLine: 567 }),
  P("Enterprise Application Integration (EAI) pada level data (*data-level EAI*) menawarkan pendekatan untuk masalah ini: data dari berbagai sistem sumber dipindahkan, ditransformasi, dan disatukan ke dalam satu basis data terpusat sehingga dapat digunakan bersama oleh aplikasi lain. Proyek ini menerapkan pendekatan tersebut untuk membangun **Nusantara Tourism Hub**, dashboard EVD pariwisata Indonesia yang seluruh datanya berasal dari hub integrasi.", { firstLine: 567 }),
  H2("1.2 Rumusan Masalah"),
  N("Bagaimana mengintegrasikan lima dataset pariwisata publik dengan format berbeda (XLSX, CSV, JSON, PDF) ke dalam satu basis data terpusat dengan kunci bersama provinsi dan periode?", "num1"),
  N("Bagaimana merancang pipeline ETL yang terdokumentasi, idempoten, dan dapat diaudit di setiap tahapnya?", "num1"),
  N("Bagaimana menyajikan data hasil integrasi dalam dashboard EVD yang aman (memerlukan login) dan informatif?", "num1"),
  N("Insight apa yang dapat diperoleh dari data pariwisata Indonesia setelah diintegrasikan, khususnya terkait tren, musiman, dampak COVID-19, ketimpangan antarprovinsi, dan korelasi lintas dataset?", "num1"),
  H2("1.3 Tujuan"),
  N("Membangun hub data pariwisata pada Supabase PostgreSQL dengan model dimensional (star schema).", "num2"),
  N("Mengimplementasikan pipeline ETL Python dengan satu modul ekstraksi per format, aturan transformasi eksplisit, dan *load* berbasis upsert.", "num2"),
  N("Menyediakan sinkronisasi satu arah terjadwal melalui GitHub Actions.", "num2"),
  N("Membangun website dashboard dengan autentikasi dan lima halaman: login/register, Overview, Analisis Provinsi, Data Pipeline ETL, dan Tabel Data.", "num2"),
  N("Menghasilkan minimal enam insight berbasis data dengan format temuan, angka, dan interpretasi.", "num2"),
  H2("1.4 Manfaat"),
  B("**Akademik:** menjadi contoh penerapan konsep data-level EAI (extract–process–update, transformasi data, sinkronisasi satu arah) pada data nyata."),
  B("**Praktis:** menyediakan satu tempat untuk mengeksplorasi data pariwisata lintas sumber, termasuk ekspor CSV untuk analisis lanjutan."),
  B("**Analitis:** memungkinkan analisis yang tidak bisa dilakukan dari satu sumber saja, seperti hubungan kapasitas akomodasi, permintaan wisatawan, dan tingkat hunian per provinsi."),
  H2("1.5 Batasan"),
  B("Cakupan waktu utama 2018–2025, dengan data World Bank hingga 2020 (tahun terakhir yang dirilis)."),
  B("Granularitas wilayah adalah provinsi (38 provinsi sesuai pemekaran 2022) dan nasional; data kabupaten/kota tidak dicakup."),
  B("Data BPS diambil dari tabel statistik dan publikasi yang tersedia publik pada 19 Oktober 2026."),
];

/* -------------------------------------------------------------- BAB 2 */
const bab2 = [
  H1("BAB 2  LANDASAN TEORI"),
  H2("2.1 Enterprise Application Integration"),
  P("Enterprise Application Integration (EAI) adalah pendekatan untuk menghubungkan aplikasi, sistem, dan sumber data yang berbeda di dalam (dan antar) organisasi agar dapat bertukar informasi tanpa perlu ditulis ulang. Linthicum (2000) membagi EAI ke dalam beberapa level, yaitu *data level*, *application interface level*, *method level*, dan *user interface level*. Proyek ini berfokus pada **data-level EAI**, yaitu integrasi yang terjadi dengan memindahkan data antar penyimpanan data, tanpa mengubah logika aplikasi sumber.", { firstLine: 567 }),
  H2("2.2 Data-level EAI: Extract–Process–Update"),
  P("Pada data-level EAI, alur integrasi umumnya mengikuti pola **extract–process–update**: data diekstrak dari basis data atau file sumber, diproses (dibersihkan, diubah bentuk, disesuaikan skemanya), lalu basis data tujuan diperbarui. Dalam praktik modern pola ini dikenal sebagai **ETL (Extract, Transform, Load)**. Keuntungan pendekatan ini adalah biaya integrasi relatif rendah karena sistem sumber tidak perlu diubah; kekurangannya, kualitas integrasi sangat ditentukan oleh ketepatan aturan transformasi.", { firstLine: 567 }),
  H2("2.3 Transformasi, Replikasi, dan Sinkronisasi"),
  B("**Data transformation:** mengubah skema dan semantik data sumber ke skema kanonik tujuan, misalnya penyeragaman kode wilayah, format tanggal, dan satuan."),
  B("**Replication:** menyalin data dari sumber ke tujuan sehingga tujuan memiliki replika yang siap dipakai."),
  B("**Synchronization:** menjaga agar replika tetap mutakhir terhadap sumber. Sinkronisasi **satu arah (one-way)** berarti perubahan hanya mengalir dari sumber ke tujuan; tujuan tidak pernah menulis balik ke sumber."),
  B("**Idempotensi:** proses yang dijalankan berulang kali dengan input sama menghasilkan keadaan akhir yang sama. Pada ETL, ini dicapai dengan *upsert* (insert-or-update) berdasarkan kunci."),
  H2("2.4 Arsitektur Hub-and-Spoke"),
  P("Dalam arsitektur hub-and-spoke, seluruh sumber (spoke) terhubung ke satu pusat (hub) alih-alih saling terhubung satu sama lain. Dengan n sumber dan m konsumen, jumlah koneksi turun dari n × m menjadi n + m. Pada proyek ini, hub adalah basis data Supabase PostgreSQL, sedangkan konsumennya adalah dashboard, fitur ekspor CSV, dan skrip analisis laporan.", { firstLine: 567 }),
  H2("2.5 Model Dimensional (Star Schema)"),
  P("Star schema terdiri atas tabel **fakta** yang menyimpan ukuran numerik (misalnya jumlah kunjungan) dan tabel **dimensi** yang menyimpan konteks (misalnya provinsi dan waktu). Dimensi bersama (*conformed dimension*) memungkinkan fakta dari sumber berbeda digabungkan, dan inilah yang membuat integrasi lintas dataset menjadi mungkin.", { firstLine: 567 }),
  H2("2.6 Exploratory Data Visualization dan Keamanan Data"),
  P("Exploratory Data Visualization (EVD) adalah penggunaan visualisasi interaktif untuk menemukan pola, anomali, dan hubungan dalam data. Untuk melindungi data, PostgreSQL menyediakan **Row Level Security (RLS)**, yaitu kebijakan akses per baris yang dievaluasi di dalam basis data, sehingga aturan keamanan tetap berlaku walaupun data diakses melalui API.", { firstLine: 567 }),
];

/* -------------------------------------------------------------- BAB 3 */
const bab3 = [
  H1("BAB 3  SUMBER DATA"),
  H2("3.1 Ringkasan Dataset"),
  P("Lima dataset dipilih dengan kriteria: (1) bersumber resmi dan dapat diakses publik tanpa login atau API key, (2) memiliki kunci bersama provinsi dan/atau periode, (3) rentang tahunnya beririsan serta mencakup masa sebelum, saat, dan sesudah COVID-19, dan (4) secara keseluruhan mencakup minimal tiga format berbeda.", { firstLine: 567 }),
  ...Tbl("Lima dataset yang diintegrasikan", ["#", "Dataset", "Penerbit", "Format", "Cakupan", "Tabel fakta"], [
    ["D1", "Tingkat Penghunian Kamar (TPK) Hotel Bintang", "BPS", "XLSX (8 file)", "38 prov + nasional, bulanan 2018–2025", "fact_tpk_hotel"],
    ["D2", "Perjalanan Wisatawan Nusantara menurut Provinsi Tujuan", "BPS", "CSV (7 file)", "38 prov + nasional, bulanan 2019–2025", "fact_wisnus"],
    ["D3", "Kunjungan Wisman per Bulan menurut Pintu Masuk", "BPS", "CSV (8 file)", "26 pintu masuk + lainnya, bulanan 2018–2025", "fact_wisman"],
    ["D4", "International Tourism (WDI), Indonesia + 5 negara ASEAN", "World Bank", "JSON (API)", "6 negara, tahunan 2010–2020", "fact_wb_pariwisata"],
    ["D5", "Statistik Hotel & Akomodasi Lainnya di Indonesia 2025 (Lampiran 1, 2, 5, 6)", "BPS", "PDF (176 hlm)", "38 prov + nasional, tahunan 2021–2025", "fact_akomodasi"],
  ], [500, 2500, 950, 1200, 2200, 1676]),
  H2("3.2 Profil Setiap Dataset"),
  H3("D1 — TPK Hotel Bintang (XLSX)"),
  P("Persentase malam kamar terpakai terhadap malam kamar tersedia di hotel bintang, per provinsi per bulan. Sumber: https://www.bps.go.id/id/statistics-table/2/MTIyIzI=/. Setiap file berisi satu tahun dengan struktur lebar: baris = 38 provinsi + INDONESIA, kolom = Januari–Desember + Tahunan. Dataset ini dipilih sebagai indikator utama kinerja akomodasi yang bersifat bulanan, sehingga dapat memperlihatkan pola musiman dan dampak pandemi."),
  H3("D2 — Perjalanan Wisatawan Nusantara (CSV)"),
  P("Jumlah perjalanan wisatawan domestik menurut provinsi tujuan, berbasis *mobile positioning data* (MPD). Sumber: https://www.bps.go.id/id/statistics-table/2/MjIwMSMy/. Struktur sama dengan D1 dan tersedia mulai 2019. Dataset ini mewakili sisi permintaan domestik per provinsi."),
  H3("D3 — Kunjungan Wisman menurut Pintu Masuk (CSV)"),
  P("Kunjungan wisatawan mancanegara per bulan melalui 15 bandara, 6 pelabuhan, 5 pos lintas batas darat utama, dan kelompok \"lainnya\". Sumber: https://www.bps.go.id/id/statistics-table/2/MTE1MCMy/. Tabelnya mencampur baris detail dan subtotal, dan tidak memakai kunci provinsi sehingga memerlukan pemetaan tambahan."),
  H3("D4 — World Bank WDI (JSON)"),
  P("Empat indikator pariwisata internasional (kedatangan, keberangkatan, penerimaan, dan pengeluaran dalam US$) untuk Indonesia, Thailand, Malaysia, Vietnam, Singapura, dan Filipina melalui API publik World Bank (lisensi CC BY 4.0). Data yang dirilis World Bank berhenti pada 2020. Dataset ini dipilih sebagai sumber JSON tanpa API key, memberi pembanding regional, serta dimensi ekonomi (devisa)."),
  H3("D5 — Statistik Hotel dan Akomodasi Lainnya 2025 (PDF)"),
  P("Publikasi BPS nomor 06300.25009 (176 halaman, 22 MB). Empat tabel lampiran diekstrak: jumlah usaha akomodasi (Lampiran 1), jumlah kamar akomodasi (Lampiran 2), jumlah usaha hotel bintang (Lampiran 5), dan jumlah kamar hotel bintang (Lampiran 6), masing-masing per provinsi untuk 2021–2025. Dataset ini mewakili sisi penawaran (kapasitas) yang hanya tersedia dalam bentuk publikasi PDF."),
  H2("3.3 Metode Akuisisi Data"),
  P("Situs bps.go.id dilindungi Cloudflare yang menolak permintaan otomatis dari script (HTTP 403). Karena itu, file D1–D3 diunduh melalui tombol **Unduh → XLSX/CSV** pada halaman tabel di browser, satu file per tahun, lalu salinan mentahnya disimpan tanpa perubahan di folder `data/raw/` pada repository. File PDF D5 diunduh langsung melalui tautan \"Unduh Publikasi\", sedangkan JSON D4 diambil langsung dari API World Bank. Pipeline ETL selalu memproses salinan mentah ini sehingga proses dapat direproduksi.", { firstLine: 567 }),
  P("Katalog lengkap sumber (URL, tanggal akses, lisensi, alasan pemilihan) didokumentasikan pada `data/SOURCES.md`.", { firstLine: 567 }),
];

/* -------------------------------------------------------------- BAB 4 */
const bab4 = [
  H1("BAB 4  ARSITEKTUR DAN PERANCANGAN SISTEM"),
  H2("4.1 Arsitektur Data-level EAI"),
  P("Gambar 1 memperlihatkan arsitektur sistem. Lima sumber heterogen di `data/raw/` diproses oleh pipeline ETL Python, kemudian dimuat ke hub Supabase PostgreSQL. Website Next.js hanya membaca dari hub melalui sesi pengguna yang dibatasi RLS. Setiap tahap ETL menulis log ke tabel `etl_run` dan `etl_step_log`, sedangkan baris yang dibuang disimpan di `data/rejected/`. Sinkronisasi dijalankan secara manual atau terjadwal mingguan melalui GitHub Actions.", { firstLine: 567 }),
  ...Figure("01_arsitektur.png", "Arsitektur data-level EAI Nusantara Tourism Hub"),
  H2("4.2 Pemetaan ke Konsep EAI"),
  ...Tbl("Penerapan konsep data-level EAI", ["Konsep", "Penerapan pada proyek"], [
    ["Extract", "Modul terpisah per format (`csv_extractor`, `xlsx_extractor`, `json_extractor`, `pdf_extractor`) membaca file apa adanya tanpa mengubah nilai."],
    ["Process / Transform", "Aturan transformasi eksplisit di `etl/transform/` (wide→long, alias provinsi, normalisasi angka, NULL, periode, deduplikasi, validasi)."],
    ["Update / Load", "COPY ke tabel sementara lalu `INSERT … ON CONFLICT DO UPDATE` ke tabel fakta (idempoten)."],
    ["Replication", "Hub menyimpan replika terbersihkan dari kelima sumber dalam satu skema kanonik."],
    ["One-way synchronization", "Data hanya mengalir dari sumber ke hub; dijalankan terjadwal setiap Senin 02.00 WIB oleh GitHub Actions."],
    ["Hub-and-spoke", "Dashboard, ekspor CSV, dan skrip insight semuanya membaca dari hub yang sama."],
    ["Auditability", "Setiap run dan tahap tercatat (baris masuk/keluar/dibuang, alasan, durasi); baris yang dibuang disimpan sebagai CSV."],
  ], [2400, 6626]),
  H2("4.3 Teknologi yang Digunakan"),
  ...Tbl("Stack teknologi", ["Lapisan", "Teknologi", "Fungsi"], [
    ["ETL", "Python 3.11, pandas, openpyxl, pdfplumber, psycopg 3", "Ekstraksi multi-format, transformasi, dan load ke Postgres"],
    ["Hub data", "Supabase PostgreSQL", "Basis data terpusat, view analitik, RLS"],
    ["Autentikasi", "Supabase Auth, @supabase/ssr", "Register, login, sesi berbasis cookie"],
    ["Frontend", "Next.js 15 (App Router, TypeScript), Tailwind CSS v4", "Halaman dashboard, Server Components"],
    ["Visualisasi", "Apache ECharts (echarts-for-react)", "Grafik garis, batang, heatmap, peta choropleth, scatter, sankey"],
    ["Penjadwalan", "GitHub Actions (cron)", "Sinkronisasi ETL mingguan (one-way sync)"],
    ["Deploy", "Vercel", "Hosting website produksi"],
  ], [1600, 3600, 3826]),
  H2("4.4 Keamanan"),
  B("**RLS aktif** di semua tabel. Role `authenticated` hanya memiliki hak `SELECT`; role `anon` dicabut seluruh haknya, sehingga permintaan tanpa login ditolak dengan *permission denied*."),
  B("View dibuat dengan `security_invoker = true` agar RLS tabel dasar tetap berlaku saat view diakses lewat API."),
  B("Penulisan data hanya dilakukan oleh ETL melalui koneksi `DATABASE_URL`."),
  B("Semua query website dijalankan di server memakai sesi pengguna. *Service role key* tidak pernah dikirim ke browser."),
  B("File rahasia (`.env*`) tidak di-commit; hanya `.env.example` yang disertakan. Riwayat git telah diperiksa bebas dari kredensial."),
];

/* -------------------------------------------------------------- BAB 5 */
const bab5 = [
  H1("BAB 5  IMPLEMENTASI PIPELINE ETL"),
  H2("5.1 Struktur Kode"),
  ...Code([
    "etl/",
    "├── extract/      csv_ · xlsx_ · json_ · pdf_extractor.py (1 modul per format)",
    "├── transform/    common · bps_bulanan (D1,D2) · wisman · worldbank · akomodasi",
    "├── load/         loader.py  (upsert idempoten + RunLogger)",
    "├── migrate.py    menjalankan supabase/migrations/*.sql",
    "├── quality.py    quality check pasca-load",
    "├── insights.py   query analitik untuk Bab 8",
    "└── run_etl.py    entry point:  python -m etl.run_etl [--trigger scheduled] [--dry-run]",
  ]),
  H2("5.2 Tahap Extract"),
  P("Setiap format memiliki modul ekstraksi sendiri yang hanya membaca data tanpa membersihkan nilai. Semua sel dibaca sebagai teks (`dtype=str`, `keep_default_na=False`) agar token seperti \"-\" atau \"NA\" tidak diubah diam-diam oleh pandas dan dapat ditangani secara eksplisit di tahap Transform. Ekstraktor JSON melakukan *flatten* struktur bersarang, sedangkan ekstraktor PDF mencari halaman berdasarkan judul lampiran, bukan nomor halaman, sehingga tetap bekerja walaupun tata letak edisi berikutnya bergeser.", { firstLine: 567 }),
  H2("5.3 Tahap Transform"),
  P("Tabel berikut merangkum sepuluh aturan transformasi yang diimplementasikan secara eksplisit di kode.", { firstLine: 567 }),
  ...Tbl("Aturan transformasi", ["No", "Transformasi", "Penjelasan", "Dataset"], [
    ["1", "Wide → long", "Kolom Januari–Desember diubah menjadi baris (entitas, bulan, nilai).", "D1, D2, D3"],
    ["2", "Standardisasi nama provinsi", "Nama dinormalisasi (huruf besar, tanpa titik, spasi tunggal) lalu dicocokkan ke kode BPS melalui kolom `alias` di `dim_provinsi`.", "D1, D2, D5"],
    ["3", "Pemetaan pintu masuk → provinsi", "26 bandara/pelabuhan/PLBN dipetakan ke jenis pintu dan provinsi lokasi melalui tabel referensi.", "D3"],
    ["4", "Normalisasi angka", "Format Indonesia \"1.412\" (titik = ribuan) dibedakan dari \"49.17\" (titik = desimal) sesuai konfigurasi per sumber.", "D1, D5"],
    ["5", "Nilai kosong BPS → NULL", "\"-\", \"…\", \"NA\", dan karakter rusak U+FFFD diubah menjadi NULL dan dibuang dari fakta dengan alasan tercatat.", "Semua"],
    ["6", "Pembersihan artefak PDF", "Huruf watermark (font > 15 pt) dibuang; superskrip catatan kaki (< 5 pt) dilepas dari angka.", "D5"],
    ["7", "Penyeragaman periode", "Semua periode menjadi `waktu_id` = tahun × 100 + bulan (00 untuk tahunan).", "Semua"],
    ["8", "Buang subtotal + validasi silang", "Baris Total/Jumlah dan kolom Tahunan tidak dimuat, tetapi dipakai untuk memeriksa konsistensi.", "D1, D2, D3"],
    ["9", "Deduplikasi & validasi rentang", "Kunci ganda dibuang; TPK harus 0–100, jumlah ≥ 0, kamar ≥ usaha.", "Semua"],
    ["10", "Pivot multi-tabel", "Empat tabel PDF digabung menjadi satu baris per provinsi-tahun-kategori.", "D5"],
  ], [600, 2200, 4826, 1400]),
  H2("5.4 Tahap Load"),
  P("Load dilakukan dengan memuat data ke tabel sementara menggunakan perintah `COPY`, lalu `INSERT … ON CONFLICT (primary key) DO UPDATE` ke tabel fakta. Klausa `RETURNING (xmax = 0)` membedakan baris baru dari baris yang diperbarui sehingga log dapat menunjukkan idempotensi. Pada run kedua, D1 tercatat \"0 baru, 3.456 diperbarui\", yang membuktikan bahwa menjalankan ulang ETL tidak menggandakan data. Setiap baris fakta juga menyimpan `run_id` sebagai *data lineage*.", { firstLine: 567 }),
  H2("5.5 Hasil per Dataset"),
  ...Tbl("Ringkasan etl_step_log (run sukses terakhir)", ["Dataset", "E: file → baris", "T: sel masuk", "T: dibuang", "L: dimuat", "Alasan utama dibuang"], [
    ["D1 TPK (XLSX)", "8 → 344", "3.744", "288", "3.456", "'-' provinsi pemekaran 2018–2023"],
    ["D2 Wisnus (CSV)", "7 → 301", "3.276", "144", "3.132", "'-' provinsi pemekaran 2019–2021"],
    ["D3 Wisman (CSV)", "8 → 312", "3.360", "611", "2.749", "480 subtotal + 131 nilai kosong"],
    ["D4 World Bank (JSON)", "1 → 360", "360", "131", "229", "nilai null (2021+ belum dirilis)"],
    ["D5 Akomodasi (PDF)", "1 → 168", "780", "40", "370", "'—' provinsi belum terbentuk"],
    ["**Total**", "", "**11.520**", "**1.214**", "**9.936**", ""],
  ], [1900, 1300, 1100, 1000, 1000, 2726]),
  ...Figure("12_etl_baris.png", "Baris dimuat dan dibuang per sumber pada run ETL terakhir"),
  H3("D1 — TPK Hotel Bintang (XLSX)"),
  B("**Masalah:** tabel lebar, header empat baris, angka disimpan sebagai teks dengan titik desimal, nilai \"-\" untuk empat provinsi pemekaran Papua sebelum terbentuk."),
  B("**Penanganan:** wide→long, alias provinsi, baris INDONESIA disimpan sebagai kode 0, konversi ke numeric(5,2), validasi 0–100%."),
  B("**Hasil:** 288 sel kosong dibuang (4 provinsi × 12 bulan × 6 tahun). Kolom Tahunan dipakai untuk cek silang: rata-rata 12 bulan = Tahunan BPS (±2 poin) pada **39/39** baris lengkap."),
  H3("D2 — Wisatawan Nusantara (CSV)"),
  B("**Penanganan:** wide→long, alias provinsi, konversi ke bigint."),
  B("**Hasil:** 144 sel kosong dibuang. Cek silang Σ12 bulan = Tahunan cocok **261/261** baris; rekonsiliasi Σ38 provinsi = nasional cocok **84/84** bulan."),
  H3("D3 — Wisatawan Mancanegara (CSV)"),
  B("**Masalah:** baris detail bercampur subtotal (\"A. Pintu Udara\", \"Jumlah (A+B+C)\", \"Total\"); sumber tidak memiliki kunci provinsi."),
  B("**Penanganan:** 480 sel subtotal dibuang tetapi dipakai untuk validasi Σdetail = Total (**96/96** bulan cocok). Pintu masuk dipetakan ke provinsi melalui `data/reference/pintu_masuk_provinsi.csv` (mis. Ngurah Rai → Bali, Batam → Kepulauan Riau, Entikong → Kalimantan Barat, Soekarno-Hatta → Banten)."),
  H3("D4 — World Bank (JSON)"),
  B("**Penanganan:** flatten JSON, `waktu_id = YYYY00`, penamaan indikator dan satuan dalam Bahasa Indonesia; 131 record bernilai null dibuang."),
  B("**Validasi lintas sumber:** kedatangan internasional World Bank identik dengan total wisman BPS hasil ETL untuk 2018–2020 (selisih 0,00%)."),
  H3("D5 — Akomodasi (PDF)"),
  B("**Masalah:** huruf watermark diagonal menyusup ke sel (contoh `\"d\\n398\"`), superskrip catatan kaki menempel pada angka (695 terbaca 6951), angka format Indonesia, tanda \"—\" terbaca U+FFFD, dan data tersebar di empat tabel."),
  B("**Penanganan:** 84 karakter watermark dibuang berdasarkan ukuran font, 11 penanda superskrip dilepas, angka dinormalisasi, pivot empat tabel, validasi kamar ≥ usaha."),
  H2("5.6 Quality Check Pasca-Load"),
  ...Tbl("Hasil quality check otomatis", ["Tabel", "Baris", "NULL %", "FK tidak valid", "Rentang"], [
    ["fact_tpk_hotel", "3.456", "0,0", "0", "2018–2025"],
    ["fact_wisnus", "3.132", "0,0", "0", "2019–2025"],
    ["fact_wisman", "2.749", "0,0", "0", "2018–2025"],
    ["fact_wb_pariwisata", "229", "0,0", "0", "2010–2020"],
    ["fact_akomodasi", "370", "0,0", "0", "2021–2025"],
    ["Rekonsiliasi Σprovinsi = nasional (wisnus)", "84 bulan", "–", "–", "84/84 cocok"],
  ], [3426, 1200, 1100, 1500, 1800]),
  H2("5.7 Penanganan 34 vs 38 Provinsi"),
  P("Pada 2022, Papua dimekarkan menjadi Papua, Papua Selatan, Papua Tengah, dan Papua Pegunungan, sedangkan Papua Barat dimekarkan menjadi Papua Barat dan Papua Barat Daya. Data disimpan sesuai publikasi (38 provinsi) tanpa imputasi untuk tahun sebelum provinsi baru terbentuk. Kolom `dim_provinsi.kode_induk` menunjuk provinsi induk (92 → 91; 95, 96, 97 → 94), sehingga dashboard menyediakan opsi **basis 34 provinsi** yang menjumlahkan (atau merata-ratakan untuk TPK) provinsi pemekaran ke induknya agar runtun waktu tetap sebanding.", { firstLine: 567 }),
  H2("5.8 Sinkronisasi Terjadwal (GitHub Actions)"),
  P("Workflow `.github/workflows/etl.yml` dipicu oleh `workflow_dispatch` (manual) dan cron mingguan (`0 19 * * 0`, yaitu Senin 02.00 WIB). Workflow memasang Python 3.11, menginstal dependensi, lalu menjalankan `python -m etl.run_etl --trigger scheduled` dengan secret `DATABASE_URL`. Baris yang dibuang diunggah sebagai artefak. Run terjadwal pertama tercatat di tabel `etl_run` dengan status *success* dan trigger *scheduled*, serta jumlah baris fakta tidak bertambah, yang kembali membuktikan idempotensi.", { firstLine: 567 }),
];

/* -------------------------------------------------------------- BAB 6 */
const bab6 = [
  H1("BAB 6  SKEMA BASIS DATA"),
  H2("6.1 Model Dimensional"),
  P("Hub menggunakan star schema dengan dua dimensi bersama dan lima tabel fakta, ditambah tabel metadata ETL. Migrasi SQL disimpan di `supabase/migrations/` (0001–0005) dan dijalankan otomatis oleh ETL.", { firstLine: 567 }),
  ...Tbl("Tabel dimensi dan metadata", ["Tabel", "Kolom utama", "Keterangan"], [
    ["dim_provinsi", "kode_bps (PK), nama, pulau, region, kode_induk (FK), tahun_dibentuk, is_nasional, alias[]", "38 provinsi + baris nasional (kode 0); alias untuk pencocokan nama"],
    ["dim_waktu", "waktu_id (PK), tahun, bulan, kuartal, granularitas, label, tanggal_awal", "2010–2030, bulanan dan tahunan"],
    ["etl_run", "run_id (PK), mulai, selesai, status, trigger, catatan", "Satu baris per eksekusi pipeline"],
    ["etl_step_log", "run_id (FK), dataset, format_sumber, tahap (E/T/L), baris_masuk, baris_keluar, baris_dibuang, alasan_dibuang (jsonb), catatan_transformasi, durasi_ms", "Log per dataset per tahap"],
    ["sumber_data", "dataset (PK), judul, penerbit, format, url, cakupan, tabel_fakta", "Katalog sumber untuk halaman Pipeline"],
  ], [1800, 4426, 2800]),
  ...Tbl("Tabel fakta", ["Tabel", "Primary key", "Ukuran", "Sumber"], [
    ["fact_tpk_hotel", "(provinsi_kode, waktu_id)", "tpk_persen numeric(5,2)", "D1 XLSX"],
    ["fact_wisnus", "(provinsi_kode, waktu_id)", "jumlah_perjalanan bigint", "D2 CSV"],
    ["fact_wisman", "(pintu_masuk, waktu_id)", "jumlah_kunjungan bigint; jenis_pintu; provinsi_kode (nullable)", "D3 CSV"],
    ["fact_wb_pariwisata", "(negara_iso3, waktu_id, indikator_kode)", "nilai numeric; satuan", "D4 JSON"],
    ["fact_akomodasi", "(provinsi_kode, waktu_id, kategori)", "jumlah_usaha, jumlah_kamar", "D5 PDF"],
  ], [2000, 2700, 3126, 1200]),
  H2("6.2 View Analitik"),
  ...Tbl("View yang dikonsumsi dashboard", ["View", "Isi"], [
    ["v_tren_bulanan", "Wisman (Σ semua pintu), wisnus nasional, dan TPK nasional per bulan"],
    ["v_kpi_tahunan", "KPI tahunan: total wisman/wisnus, rata-rata TPK, kamar akomodasi, penerimaan WB, serta YoY"],
    ["v_integrasi_provinsi_tahun", "Gabungan kelima dataset per provinsi-tahun, termasuk rasio wisnus per kamar"],
    ["v_data_terintegrasi", "Seluruh fakta dalam format panjang (dataset, wilayah, periode, metrik, nilai)"],
    ["v_etl_ringkasan_sumber", "Ringkasan run ETL terakhir per sumber"],
  ], [3000, 6026]),
  H2("6.3 Kebijakan RLS"),
  ...Code([
    "alter table public.<tabel> enable row level security;",
    "create policy \"authenticated_read\" on public.<tabel> for select to authenticated using (true);",
    "revoke all on public.<tabel> from anon;",
    "revoke insert, update, delete, truncate on public.<tabel> from authenticated;",
  ]),
  P("Pengujian langsung ke REST API Supabase menggunakan anon key menghasilkan galat `permission denied` untuk tabel `fact_wisnus`, `dim_provinsi`, `etl_run`, dan view `v_kpi_tahunan`, sehingga anon terbukti tidak dapat membaca data apa pun.", { firstLine: 567 }),
];

/* -------------------------------------------------------------- BAB 7 */
const shot = (label) => new Table({
  width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [CONTENT_W],
  rows: [new TableRow({ height: { value: 2600, rule: "atLeast" }, children: [new TableCell({
    width: { size: CONTENT_W, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    borders: { top: { style: BorderStyle.DASHED, size: 6, color: "A78BFA" }, bottom: { style: BorderStyle.DASHED, size: 6, color: "A78BFA" },
      left: { style: BorderStyle.DASHED, size: 6, color: "A78BFA" }, right: { style: BorderStyle.DASHED, size: 6, color: "A78BFA" } },
    shading: { type: ShadingType.CLEAR, fill: "FAF5FF", color: "auto" },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `[Tempel screenshot: ${label}]`, italics: true, color: "7C3AED" })] })],
  })] })],
});
const bab7 = [
  H1("BAB 7  FITUR DAN DESAIN WEBSITE"),
  H2("7.1 Konsep Desain"),
  P("Website menggunakan gaya **glassmorphism** dengan palet **Aurora** (ungu #7c3aed, biru #2563eb, hijau #10b981) di atas latar gelap #0b0b1a. Empat *blob* gradien bergerak perlahan di latar belakang dan otomatis berhenti bila pengguna mengaktifkan `prefers-reduced-motion`. Kartu menggunakan latar semi-transparan dengan efek blur dan garis sorot tipis di tepi atas. Tema ECharts kustom menyelaraskan warna seri, garis grid transparan, dan tooltip bergaya kaca. Teks utama (#f4f4fb) di atas latar gelap memenuhi rasio kontras WCAG AA. Seluruh halaman responsif hingga lebar 375 px dan dilengkapi *skeleton loading* serta *empty state*.", { firstLine: 567 }),
  H2("7.2 Halaman Website"),
  ...Tbl("Daftar halaman dan fitur", ["Halaman", "Fitur utama"], [
    ["/login, /register", "Kartu kaca di tengah layar; validasi form (format email, password ≥ 8 karakter berisi huruf dan angka, konfirmasi password); pesan galat Bahasa Indonesia; tautan antarhalaman"],
    ["/dashboard (Overview)", "Empat kartu KPI dengan perubahan YoY dan filter tahun; tren bulanan dua sumbu dengan anotasi periode COVID-19; heatmap indeks musiman (wisman/wisnus/TPK); indeks pemulihan (2019 = 100); 10 pintu masuk wisman teratas; pembanding ASEAN"],
    ["/provinsi", "Peta choropleth 38 provinsi (skala log); ranking bar berwarna per pulau; pangsa 5 provinsi teratas dan koefisien Gini; scatter korelasi lintas dataset dengan nilai r; filter tahun, metrik, dan basis 34/38 provinsi"],
    ["/pipeline", "Diagram alur sumber → Extract → Transform → Load → hub → dashboard; sankey aliran baris (dimuat vs dibuang per alasan); kartu per sumber; riwayat etl_run; isi etl_step_log; penjelasan 10 transformasi"],
    ["/data", "Tabel hasil integrasi dengan pencarian, filter dataset/provinsi/tahun, pengurutan kolom, paginasi di server, dan ekspor CSV sesuai filter"],
  ], [2200, 6826]),
  H2("7.3 Tangkapan Layar"),
  shot("halaman Login"), ...Figure0("Halaman login"),
  shot("halaman Overview"), ...Figure0("Halaman Overview"),
  shot("halaman Analisis Provinsi"), ...Figure0("Halaman Analisis Provinsi"),
  shot("halaman Data Pipeline ETL"), ...Figure0("Halaman Data Pipeline ETL"),
  shot("halaman Tabel Data"), ...Figure0("Halaman Tabel Data"),
  H2("7.4 Pengujian Fungsional"),
  ...Tbl("Hasil pengujian (definition of done)", ["Skenario", "Hasil"], [
    ["ETL end-to-end tanpa galat, kelima tabel fakta terisi, etl_run tercatat", "Lulus"],
    ["Menjalankan ETL dua kali tidak menggandakan data", "Lulus (\"0 baru, 3.456 diperbarui\")"],
    ["npm run build dan npm run lint", "Lulus"],
    ["Akses halaman terproteksi tanpa login diarahkan ke /login", "Lulus (HTTP 307 → /login?next=…)"],
    ["Login salah menampilkan pesan \"Email atau password salah.\"", "Lulus"],
    ["Login benar → dashboard; logout → kembali ke /login", "Lulus"],
    ["Register akun baru langsung masuk ke dashboard", "Lulus"],
    ["Semua halaman menampilkan data nyata dari DB; tampilan 375 px tanpa scroll horizontal", "Lulus"],
    ["Ekspor CSV mengikuti filter, termasuk > 1.000 baris (3.132 baris D2)", "Lulus"],
    ["Anon key tidak dapat membaca tabel/view (RLS)", "Lulus (permission denied)"],
    ["Tidak ada secret di riwayat git", "Lulus"],
    ["Repository ter-push dan workflow Actions sukses dijalankan", "Lulus"],
  ], [6026, 3000]),
];
function Figure0(caption) {
  figNo += 1;
  return [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 200 },
    children: [new TextRun({ text: `Gambar ${figNo}. `, bold: true, size: 20 }), new TextRun({ text: caption, size: 20, italics: true })] })];
}

/* -------------------------------------------------------------- BAB 8 */
const bab8 = () => [
  H1("BAB 8  ANALISIS INSIGHT"),
  P("Seluruh angka pada bab ini diperoleh dari query ke hub (`python -m etl.insights` dan `scripts/report_figures.py`), bukan dari file mentah. Setiap insight disajikan dalam format temuan, angka, dan interpretasi. Bagian bertanda [VERIFIKASI] perlu dicek ulang oleh tim sebelum dikumpulkan.", { firstLine: 567 }),
  ...Insight(1, "Pukulan COVID-19 jauh lebih dalam pada wisman daripada wisnus",
    "Kunjungan wisman turun dari 16,11 juta (2019) menjadi 4,05 juta (2020, **−74,8%**) dan mencapai dasar 1,56 juta pada 2021 (9,7% dari level 2019). Titik terendah bulanan terjadi pada Februari 2021 dengan 105.788 kunjungan. Sebaliknya, perjalanan wisnus hanya turun **27,4%** pada 2020 (722,2 juta → 524,6 juta) dan sudah naik lagi 16,9% pada 2021.",
    "Penutupan perbatasan internasional menghentikan pasar mancanegara hampir total, sedangkan permintaan domestik jauh lebih tangguh dan menjadi penopang industri selama pandemi. Kebijakan pemulihan jangka pendek yang menyasar wisnus memiliki dasar data yang kuat."),
  ...Figure("02_tren_bulanan.png", "Tren bulanan wisman dan wisnus dengan anotasi periode COVID-19"),
  ...Insight(2, "Pemulihan wisnus melampaui pra-pandemi jauh lebih cepat daripada wisman",
    "Wisnus 2025 mencapai 1,20 miliar perjalanan atau **166%** dari level 2019, sedangkan wisman 2025 (15,39 juta) baru **95,5%** dari level 2019. TPK hotel bintang 2025 (49,23%) masih **4,6 poin** di bawah 2019 (53,80%) dan turun 3,27 poin dibanding 2024.",
    "Volume perjalanan sudah pulih, tetapi hunian hotel bintang belum. Insight 8 menunjukkan salah satu penjelasannya: kapasitas kamar tumbuh lebih cepat daripada permintaan. Lonjakan wisnus juga perlu dibaca hati-hati karena metodologinya berbasis mobile positioning data.",
    "Periksa catatan metodologi BPS bila ada perubahan cakupan MPD antartahun."),
  ...Figure("04_pemulihan.png", "Indeks dampak COVID-19 dan pemulihan (2019 = 100)"),
  ...Figure("03_tpk_bulanan.png", "TPK hotel bintang nasional per bulan dan acuan rata-rata 2019"),
  ...Insight(3, "Pola musiman: wisman memuncak Juli–Agustus, wisnus saat libur nasional",
    "Pada tahun normal (2018, 2019, 2023–2025), indeks musiman wisman tertinggi terjadi pada Agustus (**115,7**) dan Juli (114,2), terendah pada Januari (85,0). Wisnus memuncak pada Desember (**117,5**) dan April (112,5). TPK tertinggi pada Desember (111,3) dan November (107,9).",
    "Wisman mengikuti musim libur musim panas negara asal (Eropa, Australia), sedangkan wisnus mengikuti kalender libur nasional seperti Idulfitri dan akhir tahun. Pengelola destinasi dapat memanfaatkan perbedaan puncak ini, misalnya mempromosikan pasar domestik pada Juli–Agustus di destinasi yang kurang diminati wisman.",
    "Tanggal Idulfitri bergeser tiap tahun; puncak April adalah rata-rata beberapa tahun."),
  ...Figure("05_musiman_wisman.png", "Heatmap indeks musiman kunjungan wisman (100 = rata-rata bulanan tahun tersebut)"),
  ...Insight(4, "Konsentrasi pintu masuk wisman makin tinggi ke Bali",
    "Bandara Ngurah Rai menyumbang **38,7%** wisman pada 2019 dan naik menjadi **44,9%** pada 2025 (6,91 juta kunjungan). Soekarno-Hatta naik dari 15,0% menjadi 17,9%, sementara pintu darat \"lainnya\" turun dari 11,8% menjadi 7,1% dan Batam dari 12,1% menjadi 10,4%.",
    "Pemulihan wisman sangat bergantung pada satu gerbang. Ini menjadi risiko konsentrasi (gangguan di Bali langsung berdampak nasional) sekaligus tanda bahwa pengembangan destinasi prioritas di luar Bali belum tercermin pada data pintu masuk."),
  ...Figure("06_pintu_masuk.png", "Pangsa kunjungan wisman menurut pintu masuk, 2019 dan 2025"),
  ...Insight(5, "Ketimpangan antarprovinsi: Jawa menyerap 64,8% wisnus dengan 44,5% kamar",
    "Pada 2025, lima provinsi teratas (Jawa Timur 18,1%, Jawa Barat 17,6%, Jawa Tengah 12,2%, DKI Jakarta 8,3%, Banten 5,2%) menyumbang **61,4%** perjalanan wisnus, dengan koefisien Gini antarprovinsi **0,67**. Pulau Jawa menerima 64,8% wisnus tetapi hanya memiliki 44,5% kamar akomodasi.",
    "Wisnus didominasi perjalanan jarak dekat di Jawa yang padat penduduk. Ketidakseimbangan permintaan dan kapasitas di Jawa mengindikasikan banyak perjalanan yang tidak menginap di akomodasi komersial (kunjungan keluarga, perjalanan harian), sementara luar Jawa memiliki kapasitas yang relatif lebih besar dibanding permintaannya."),
  ...Figure("07_peta_wisnus.png", "Peta choropleth perjalanan wisnus menurut provinsi tujuan, 2025"),
  ...Figure("08_ranking_wisnus.png", "Dua belas provinsi tujuan wisnus terbesar, 2025"),
  ...Insight(6, "Korelasi lintas dataset: kapasitas mengikuti permintaan, hunian berkorelasi lemah",
    "Antarprovinsi pada 2025 (n = 38): korelasi log(kamar akomodasi) dengan log(wisnus) **r = 0,91** (positif kuat); log(kamar hotel bintang) dengan TPK **r = 0,52** (sedang); log(wisnus) dengan TPK **r = 0,37** (lemah); wisman per pintu masuk dengan TPK **r = 0,39**.",
    "Analisis ini hanya mungkin setelah integrasi, karena variabelnya berasal dari tiga sumber dan tiga format berbeda (CSV, PDF, XLSX). Kapasitas akomodasi tumbuh mengikuti volume wisatawan, tetapi tingkat hunian ditentukan faktor lain, terutama komposisi wisatawan (wisman cenderung menginap di hotel bintang) dan kesesuaian kelas hotel. Banyak wisnus belum tentu berarti hotel penuh.",
    "Korelasi bukan kausalitas; ukuran sampel kecil (n = 38)."),
  ...Figure("09_korelasi.png", "Scatter korelasi lintas dataset per provinsi, 2025"),
  ...Insight(7, "Tekanan permintaan per kamar berbeda sekitar 15 kali antarprovinsi",
    "Rasio wisnus per kamar akomodasi 2025 tertinggi di Banten (2.636), Jawa Timur (2.170), dan Lampung (2.126), terendah di Bali (171) dan Kepulauan Riau (207). Meski rasionya paling rendah, Bali memiliki TPK tertinggi (**60,62%**).",
    "Rasio rendah di Bali bukan berarti kelebihan pasokan, melainkan karena hunian Bali ditopang wisman (Insight 4) yang tidak tercakup dalam data wisnus. Ini menegaskan bahwa analisis pasokan-permintaan harus menggabungkan D2, D3, dan D5; satu sumber saja akan menyesatkan."),
  ...Insight(8, "Kapasitas tumbuh lebih cepat daripada hunian",
    "Jumlah kamar akomodasi nasional naik dari 718.898 (2021) menjadi 969.329 (2025, **+34,8%**), dengan lonjakan +24,5% pada 2024. Pertumbuhan tertinggi di NTB (+162,9%) dan Bali (+96,4%). Pada periode yang sama, TPK hotel bintang 2025 turun ke 49,23% dari 52,50% (2024).",
    "Penambahan kapasitas yang agresif, terutama di destinasi super prioritas seperti Mandalika (NTB), belum diimbangi permintaan sehingga hunian rata-rata tertekan.",
    "Lonjakan 2024 mungkin juga dipengaruhi pemutakhiran direktori usaha BPS, bukan murni pembangunan baru."),
  ...Figure("10_kapasitas_vs_tpk.png", "Kapasitas kamar nasional dan rata-rata TPK, 2021–2025"),
  ...Insight(9, "Posisi Indonesia di ASEAN: volume kalah, nilai per wisatawan kompetitif",
    "Pada 2019 Indonesia menerima 16,1 juta kedatangan internasional, di bawah Thailand (39,9 juta), Malaysia (26,1 juta), Singapura (19,1 juta), dan Vietnam (18,0 juta). Namun penerimaan per kedatangan Indonesia **US$ 1.143**, lebih tinggi dari Malaysia (US$ 851) dan Vietnam (US$ 657), di bawah Thailand (US$ 1.613). Penerimaan Indonesia anjlok dari US$ 18,41 miliar (2019) menjadi US$ 3,53 miliar (2020).",
    "Strategi *quality over quantity* memiliki dasar data: Indonesia lebih unggul pada nilai belanja per wisatawan daripada jumlah wisatawan."),
  ...Figure("11_asean.png", "Kedatangan wisatawan internasional Indonesia dan negara ASEAN, 2010–2020"),
  ...Insight(10, "Validasi lintas sumber membuktikan integritas integrasi",
    "Total wisman hasil ETL dari CSV BPS sama dengan kedatangan internasional World Bank (JSON): 2018: 15.810.305 vs 15.810.000; 2019: 16.106.954 vs 16.107.000; 2020: 4.052.923 vs 4.053.000. Selisihnya **0,00%** (World Bank membulatkan ke ribuan).",
    "Dua sumber, dua format, dan dua penerbit berbeda menghasilkan angka yang sama setelah integrasi. Ini bukti bahwa transformasi D3 (pembuangan subtotal dan pemetaan pintu masuk) tidak menghilangkan maupun menggandakan data."),
];

/* -------------------------------------------------------------- BAB 9-10 */
const bab9 = [
  H1("BAB 9  KESIMPULAN, KETERBATASAN, DAN SARAN"),
  H2("9.1 Kesimpulan"),
  N("Lima sumber heterogen (XLSX, CSV, JSON, PDF) berhasil diintegrasikan ke satu hub Supabase PostgreSQL melalui pipeline ETL yang terdokumentasi. Dari 11.520 sel data, 9.936 baris dimuat dan 1.214 dibuang dengan alasan yang tercatat.", "num3"),
  N("Pipeline memenuhi prinsip data-level EAI: extract–process–update, transformasi ke skema kanonik, serta sinkronisasi satu arah yang idempoten dan terjadwal.", "num3"),
  N("Dashboard EVD dengan autentikasi berhasil dibangun dan di-deploy; seluruh datanya dibaca dari hub yang dilindungi RLS.", "num3"),
  N("Integrasi menghasilkan analisis yang tidak mungkin dari satu sumber saja, seperti korelasi kapasitas–permintaan–hunian per provinsi dan validasi silang BPS–World Bank.", "num3"),
  H2("9.2 Keterbatasan"),
  B("Data World Bank berhenti di 2020 sehingga pembanding ASEAN belum mencakup masa pemulihan."),
  B("Data wisnus berbasis mobile positioning data yang tersedia sejak 2019; perbandingan dengan metode survei lama tidak dilakukan."),
  B("Pemetaan pintu masuk → provinsi mewakili lokasi kedatangan, bukan destinasi akhir wisman."),
  B("Data akomodasi (PDF) hanya mencakup 2021–2025 dan berasal dari satu edisi publikasi."),
  B("Karena bps.go.id memblokir unduhan otomatis, pembaruan data BPS masih memerlukan langkah unduh manual sebelum sinkronisasi terjadwal memprosesnya."),
  H2("9.3 Saran Pengembangan"),
  B("Menggunakan WebAPI resmi BPS (dengan API key) agar langkah Extract sepenuhnya otomatis."),
  B("Menambahkan data UN Tourism terbaru atau neraca pembayaran Bank Indonesia untuk penerimaan devisa pasca-2020."),
  B("Menambah granularitas kabupaten/kota dan data wisman menurut negara asal."),
  B("Menerapkan *change data capture* sederhana (hash per file mentah) agar ETL hanya memproses file yang berubah."),
  H1("BAB 10  PEMBAGIAN TUGAS KELOMPOK"),
  ...Tbl("Pembagian tugas anggota", ["Nama", "NIM", "Kontribusi"], [
    ["[Nama 1]", "[NIM]", "[mis. pencarian dataset, ekstraksi PDF, ETL]"],
    ["[Nama 2]", "[NIM]", "[mis. desain database, migrasi, RLS]"],
    ["[Nama 3]", "[NIM]", "[mis. frontend & visualisasi]"],
    ["[Nama 4]", "[NIM]", "[mis. analisis insight & laporan]"],
  ], [3000, 1800, 4226]),
];

const pustaka = [
  H1("DAFTAR PUSTAKA"),
  ...[
    "Badan Pusat Statistik. (2026). *Tingkat Penghunian Kamar pada Hotel Bintang* [Tabel statistik, XLSX]. https://www.bps.go.id/id/statistics-table/2/MTIyIzI=/tingkat-penghunian-kamar-hotel.html. Diakses 19 Oktober 2026.",
    "Badan Pusat Statistik. (2026). *Jumlah Perjalanan Wisatawan Nusantara Menurut Provinsi Tujuan* [Tabel statistik, CSV]. https://www.bps.go.id/id/statistics-table/2/MjIwMSMy/. Diakses 19 Oktober 2026.",
    "Badan Pusat Statistik. (2026). *Jumlah Kunjungan Wisatawan Mancanegara per Bulan ke Indonesia Menurut Pintu Masuk, 2008–sekarang* [Tabel statistik, CSV]. https://www.bps.go.id/id/statistics-table/2/MTE1MCMy/. Diakses 19 Oktober 2026.",
    "Badan Pusat Statistik. (2025). *Statistik Hotel dan Akomodasi Lainnya di Indonesia 2025* (No. Publikasi 06300.25009). Jakarta: BPS.",
    "Herianto, D. (2025). *Indonesia GeoJSON & TopoJSON Maps (38 Provinces)*. https://github.com/denyherianto/indonesia-geojson-topojson-maps-with-38-provinces. Lisensi CC BY 4.0.",
    "Hohpe, G., & Woolf, B. (2003). *Enterprise Integration Patterns: Designing, Building, and Deploying Messaging Solutions*. Boston: Addison-Wesley.",
    "Kimball, R., & Ross, M. (2013). *The Data Warehouse Toolkit: The Definitive Guide to Dimensional Modeling* (3rd ed.). Indianapolis: Wiley.",
    "Linthicum, D. S. (2000). *Enterprise Application Integration*. Boston: Addison-Wesley.",
    "World Bank. (2026). *World Development Indicators: International Tourism (ST.INT.ARVL, ST.INT.RCPT.CD, ST.INT.XPND.CD, ST.INT.DPRT)* [API JSON]. https://api.worldbank.org/v2/. Lisensi CC BY 4.0.",
  ].map((t) => new Paragraph({ children: runs(t), alignment: AlignmentType.JUSTIFIED, spacing: { after: 120, line: 300 }, indent: { left: 567, hanging: 567 } })),
];

const lampiran = [
  H1("LAMPIRAN"),
  H2("Lampiran A. Cara Mengakses Website"),
  N("Buka https://eai-dashboard-pariwisata.vercel.app di browser (Chrome, Edge, Firefox, atau Safari; desktop maupun ponsel).", "num4"),
  N("Halaman akan diarahkan ke halaman Masuk. Gunakan akun demo: email `demo@pariwisata.id`, password `Demo-KPjFK4wp1GMUFx!9`. Alternatifnya, klik \"Daftar di sini\" untuk membuat akun baru.", "num4"),
  N("Setelah masuk, gunakan menu di sisi kiri (atau tombol menu ☰ di ponsel) untuk berpindah ke Overview, Analisis Provinsi, Data Pipeline ETL, dan Tabel Data.", "num4"),
  N("Klik tombol \"Keluar\" di bagian bawah menu untuk logout.", "num4"),
  H2("Lampiran B. Menjalankan Proyek Secara Lokal"),
  ...Code([
    "# 1. ETL (Python 3.11+)",
    "python -m venv .venv && .venv\\Scripts\\activate",
    "pip install -r etl/requirements.txt",
    "python -m etl.run_etl            # migrasi + extract → transform → load + quality check",
    "",
    "# 2. Website (Node.js 20+)",
    "npm install",
    "npm run seed:demo               # membuat akun demo",
    "npm run dev                     # http://localhost:3000",
  ]),
  H2("Lampiran C. Struktur Repository"),
  ...Code([
    "data/raw/            file mentah format asli (5 dataset)",
    "data/reference/      pemetaan pintu masuk → provinsi",
    "data/rejected/       baris yang dibuang ETL + alasannya",
    "etl/                 pipeline Python (extract, transform, load, quality, insights)",
    "supabase/migrations/ skema, seed provinsi, view, RLS",
    "src/                 aplikasi Next.js (halaman, komponen, query)",
    ".github/workflows/   etl.yml (sinkronisasi terjadwal)",
    "docs/                laporan dan gambar",
  ]),
  H2("Lampiran D. Contoh Baris yang Dibuang ETL"),
  ...Tbl("Contoh isi data/rejected (cuplikan)", ["Dataset", "Label", "Periode", "Nilai mentah", "Alasan"], [
    ["D1 TPK", "PAPUA SELATAN", "Jan 2020", "-", "nilai kosong BPS ('-' / '…') → NULL"],
    ["D3 Wisman", "A. Pintu Udara", "Jan 2019", "706704", "baris subtotal/total (dihitung ulang di view)"],
    ["D3 Wisman", "Lainnya", "Mar 2024", "-", "nilai kosong BPS ('-') → NULL"],
    ["D4 World Bank", "IDN · ST.INT.ARVL", "2023", "null", "nilai null di sumber (belum dirilis)"],
    ["D5 Akomodasi", "Papua Barat Daya", "2021", "�", "tanda '—' (provinsi belum terbentuk) → NULL"],
  ], [1500, 2000, 1300, 1500, 2726]),
];

/* ============================================================== DOKUMEN */
const doc = new Document({
  creator: "Kelompok EAI",
  title: "Laporan Data-level EAI Pariwisata Indonesia",
  description: "Laporan tugas kelompok EAI: Nusantara Tourism Hub",
  styles: {
    default: { document: { run: { font: FONT, size: 24 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, font: FONT, color: ACCENT }, paragraph: { spacing: { before: 120, after: 280 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: FONT, color: "1F2937" }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1, keepNext: true } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: FONT, color: "374151" }, paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2, keepNext: true } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }, { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 1080, hanging: 360 } } } }] },
      ...["num1", "num2", "num3", "num4"].map((reference) => ({ reference, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.",
        alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] })),
    ],
  },
  sections: [
    { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: cover },
    {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        pageNumbers: { start: 1 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "C4B5FD", space: 4 } },
        children: [new TextRun({ text: "Data-level EAI · Pariwisata Indonesia", size: 18, color: "6B7280", italics: true })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT], size: 20 })] })] }) },
      children: [
        ...kataPengantar, ...toc, ...ringkasan, ...bab1, ...bab2, ...bab3, ...bab4, ...bab5, ...bab6,
        ...bab7, ...bab8(), ...bab9, ...pustaka, ...lampiran,
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("✔", path.relative(ROOT, OUT), `(${(buf.length / 1024).toFixed(0)} KB, ${figNo} gambar, ${tabNo} tabel)`);
});
