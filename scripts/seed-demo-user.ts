/**
 * Membuat (atau memperbarui) akun demo untuk dosen/penguji.
 *
 *   npm run seed:demo
 *
 * Memakai Supabase Admin API dengan SUPABASE_SERVICE_ROLE_KEY (hanya di
 * mesin lokal/CI — tidak pernah dikirim ke browser). Password diambil dari
 * DEMO_USER_PASSWORD di .env.local.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const EMAIL = "demo@pariwisata.id";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_USER_PASSWORD;

if (!url || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum di-set");
if (!password || password.length < 12) throw new Error("DEMO_USER_PASSWORD wajib diisi (≥ 12 karakter)");

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) throw listErr;
  const existing = list.users.find((u) => u.email === EMAIL);

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: "Akun Demo Dosen" },
    });
    if (error) throw error;
    console.log(`✔ Akun demo diperbarui: ${EMAIL}`);
  } else {
    const { error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Akun Demo Dosen" },
    });
    if (error) throw error;
    console.log(`✔ Akun demo dibuat: ${EMAIL}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
