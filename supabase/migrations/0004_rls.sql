-- =====================================================================
-- 0004_rls.sql — Row Level Security
-- * authenticated : hanya SELECT
-- * anon          : tidak ada akses sama sekali
-- * Penulisan     : hanya lewat ETL (koneksi DATABASE_URL / service role,
--                   yang mem-bypass RLS)
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'dim_provinsi', 'dim_waktu', 'etl_run', 'etl_step_log', 'sumber_data',
    'fact_tpk_hotel', 'fact_wisnus', 'fact_wisman', 'fact_wb_pariwisata', 'fact_akomodasi'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "authenticated_read" on public.%I', t);
    execute format(
      'create policy "authenticated_read" on public.%I for select to authenticated using (true)', t);
    -- cabut hak tulis dari role API; anon dicabut seluruhnya
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

-- View: anon tidak boleh, authenticated boleh SELECT
do $$
declare v text;
begin
  foreach v in array array[
    'v_tren_bulanan', 'v_kpi_tahunan', 'v_integrasi_provinsi_tahun',
    'v_data_terintegrasi', 'v_etl_ringkasan_sumber'
  ] loop
    execute format('revoke all on public.%I from anon', v);
    execute format('grant select on public.%I to authenticated', v);
  end loop;
end $$;

-- Objek baru di schema public tidak otomatis terbuka untuk anon
alter default privileges in schema public revoke all on tables from anon;
