import { createBrowserClient } from "@supabase/ssr";

type Client = ReturnType<typeof createBrowserClient>;

let _client: Client | null = null;

export function createClient(): Client {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _client;
}
