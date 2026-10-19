import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildQuery, parseFilters } from "@/lib/data-table";

const CHUNK = 1000;
const MAX_ROWS = 50_000;

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Export CSV hasil filter tabel data. Memakai sesi user (RLS berlaku). */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const f = parseFilters(Object.fromEntries(req.nextUrl.searchParams));
  const cols = ["dataset", "format", "wilayah", "provinsi_kode", "tahun", "bulan", "periode", "metrik", "satuan", "nilai"] as const;
  const lines: string[] = [cols.join(",")];

  for (let from = 0; from < MAX_ROWS; from += CHUNK) {
    const { data, error } = await buildQuery(supabase, f).range(from, from + CHUNK - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const row of data ?? []) lines.push(cols.map((c) => csvCell((row as Record<string, unknown>)[c])).join(","));
    if (!data || data.length < CHUNK) break;
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse("﻿" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pariwisata-terintegrasi-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
