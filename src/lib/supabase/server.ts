import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Klien Supabase untuk Server Components / Route Handlers / Server Actions.
 *  Memakai anon key + sesi user (cookie), sehingga semua query tunduk pada RLS. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // dipanggil dari Server Component: cookie di-refresh oleh middleware
          }
        },
      },
    },
  );
}
