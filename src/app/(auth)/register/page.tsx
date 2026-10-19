import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "../auth-shell";
import { RegisterForm } from "../auth-forms";

export const metadata: Metadata = { title: "Daftar" };

export default function RegisterPage() {
  return (
    <AuthShell
      title="Buat akun baru"
      subtitle="Akses visualisasi hasil integrasi 5 sumber data pariwisata."
      footer={
        <>
          Sudah punya akun?{" "}
          <Link href="/login" className="font-semibold text-violet-300 hover:text-violet-200">Masuk</Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
