"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function translate(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "Email atau password salah.";
  if (/email not confirmed/i.test(msg)) return "Email belum dikonfirmasi. Periksa kotak masuk Anda.";
  if (/already registered|already been registered/i.test(msg)) return "Email ini sudah terdaftar. Silakan masuk.";
  if (/rate limit/i.test(msg)) return "Terlalu banyak percobaan. Coba lagi beberapa saat lagi.";
  if (/password should be/i.test(msg)) return "Password terlalu lemah (minimal 8 karakter).";
  return "Terjadi kesalahan: " + msg;
}

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fieldErrors: Record<string, string> = {};
  if (!EMAIL_RE.test(email)) fieldErrors.email = "Masukkan alamat email yang valid.";
  if (!password) fieldErrors.password = "Password wajib diisi.";
  if (Object.keys(fieldErrors).length) return { fieldErrors, values: { email } };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: translate(error.message), values: { email } };
  redirect(safeNext(formData.get("next")));
}

export async function register(_: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const fieldErrors: Record<string, string> = {};
  if (name.length < 2) fieldErrors.name = "Nama minimal 2 karakter.";
  if (!EMAIL_RE.test(email)) fieldErrors.email = "Masukkan alamat email yang valid.";
  if (password.length < 8) fieldErrors.password = "Password minimal 8 karakter.";
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    fieldErrors.password = "Password harus memuat huruf dan angka.";
  if (confirm !== password) fieldErrors.confirm = "Konfirmasi password tidak sama.";
  if (Object.keys(fieldErrors).length) return { fieldErrors, values: { name, email } };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });
  if (error) return { error: translate(error.message), values: { name, email } };
  if (!data.session) {
    return { error: "Akun dibuat, tetapi konfirmasi email diperlukan sebelum bisa masuk.", values: { name, email } };
  }
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
