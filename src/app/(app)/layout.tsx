import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = (user.user_metadata?.full_name as string | undefined) || user.email?.split("@")[0] || "Pengguna";

  return (
    <div className="min-h-dvh">
      <AppNav name={name} email={user.email ?? ""} />
      <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-6 sm:px-6 lg:pl-[18.5rem] lg:pr-8 lg:pt-8">{children}</main>
    </div>
  );
}
