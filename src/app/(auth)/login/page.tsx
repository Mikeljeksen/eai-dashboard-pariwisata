import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "../auth-shell";
import { LoginForm } from "../auth-forms";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthShell
      title="Selamat datang kembali"
      subtitle="Masuk untuk menjelajahi dashboard pariwisata Indonesia."
      footer={
        <>
          Belum punya akun?{" "}
          <Link href="/register" className="font-semibold text-violet-300 hover:text-violet-200">Daftar di sini</Link>
        </>
      }
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}
