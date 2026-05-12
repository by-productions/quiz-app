import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "quiz-images";

export async function uploadQuizImage(
  file: File,
  supabase: SupabaseClient,
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteQuizImage(
  url: string,
  supabase: SupabaseClient,
): Promise<void> {
  const path = url.split(`/${BUCKET}/`)[1];
  if (!path) return;
  // Best-effort: ignore errors so editor flow isn't blocked by storage issues
  await supabase.storage.from(BUCKET).remove([path]);
}

export async function uploadAvatarBlob(
  blob: Blob,
  supabase: SupabaseClient,
): Promise<string> {
  const path = `avatars/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: "image/jpeg",
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
