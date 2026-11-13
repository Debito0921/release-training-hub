import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// Two different keys, on purpose.
//
// createUserClient uses the public anon key plus whoever is signed in, so it
// can only do what that person is allowed to do. Row level security is on with
// no policies, so on its own it can read nothing.
//
// createAdminClient uses the secret service role key, which skips row level
// security. It stays on the server, never in the browser.

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing from .env.local`);
  return value;
}

export async function createUserClient() {
  const store = await cookies();

  return createServerClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            for (const { name, value, options } of list) {
              store.set(name, value, options);
            }
          } catch {
            // Server components cannot write cookies. The middleware refreshes
            // the session instead, so this is safe to ignore.
          }
        },
      },
    },
  );
}

export function createAdminClient() {
  return createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
