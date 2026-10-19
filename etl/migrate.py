"""Menjalankan migrasi SQL di supabase/migrations secara berurutan.

Migrasi yang sudah dijalankan dicatat di tabel public.schema_migrations
sehingga aman dijalankan berulang. Gunakan --force untuk menjalankan ulang
semua file (semua migrasi ditulis idempoten: create if not exists /
create or replace / on conflict).
"""
from __future__ import annotations

import argparse

import psycopg

from .config import MIGRATIONS_DIR, database_url


def migrate(conn: psycopg.Connection, force: bool = False) -> list[str]:
    applied = []
    with conn.cursor() as cur:
        cur.execute("""create table if not exists public.schema_migrations (
                         nama text primary key, dijalankan timestamptz not null default now())""")
        cur.execute("alter table public.schema_migrations enable row level security")
        cur.execute("revoke all on public.schema_migrations from anon, authenticated")
        cur.execute("select nama from public.schema_migrations")
        done = {r[0] for r in cur.fetchall()}
    for f in sorted(MIGRATIONS_DIR.glob("*.sql")):
        if f.name in done and not force:
            continue
        with conn.transaction(), conn.cursor() as cur:
            cur.execute(f.read_text(encoding="utf-8"))
            cur.execute("insert into public.schema_migrations (nama) values (%s) "
                        "on conflict (nama) do update set dijalankan = now()", (f.name,))
        applied.append(f.name)
    return applied


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    with psycopg.connect(database_url(), autocommit=True) as c:
        names = migrate(c, args.force)
    print("Migrasi dijalankan:", names or "(tidak ada yang baru)")
