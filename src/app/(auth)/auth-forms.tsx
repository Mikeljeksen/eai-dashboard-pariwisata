"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { login, register, type AuthState } from "./actions";
import { Field, FormAlert } from "./auth-shell";

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-blue-600 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<AuthState, FormData>(login, {});
  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <FormAlert message={state.error} />
      <Field label="Email" name="email" type="email" autoComplete="email" placeholder="nama@email.com"
             defaultValue={state.values?.email} error={state.fieldErrors?.email} />
      <Field label="Password" name="password" type="password" autoComplete="current-password"
             error={state.fieldErrors?.password} />
      <SubmitButton>Masuk</SubmitButton>
    </form>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState<AuthState, FormData>(register, {});
  return (
    <form action={action} noValidate className="space-y-4">
      <FormAlert message={state.error} />
      <Field label="Nama lengkap" name="name" autoComplete="name"
             defaultValue={state.values?.name} error={state.fieldErrors?.name} />
      <Field label="Email" name="email" type="email" autoComplete="email" placeholder="nama@email.com"
             defaultValue={state.values?.email} error={state.fieldErrors?.email} />
      <Field label="Password" name="password" type="password" autoComplete="new-password"
             placeholder="Min. 8 karakter, huruf + angka" error={state.fieldErrors?.password} />
      <Field label="Konfirmasi password" name="confirm" type="password" autoComplete="new-password"
             error={state.fieldErrors?.confirm} />
      <SubmitButton>Buat akun</SubmitButton>
    </form>
  );
}
