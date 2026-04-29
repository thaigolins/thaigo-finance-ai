import { supabase } from "@/integrations/supabase/client";

export type StorageBucket =
  | "invoices"
  | "bank-statements"
  | "payslips"
  | "fgts-statements"
  | "loan-contracts"
  | "images";

/**
 * Faz upload de um arquivo para um bucket privado.
 * Caminho: {userId}/{timestamp}-{filename}
 * Retorna o path interno (não a URL pública).
 */
export async function uploadFile(opts: {
  bucket: StorageBucket;
  userId: string;
  file: File;
  prefix?: string;
}): Promise<{ path: string; size: number; mime: string; filename: string }> {
  const safeName = opts.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${opts.userId}/${opts.prefix ? `${opts.prefix}/` : ""}${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(opts.bucket).upload(path, opts.file, {
    cacheControl: "3600",
    upsert: false,
    contentType: opts.file.type || "application/octet-stream",
  });
  if (error) throw error;
  return {
    path,
    size: opts.file.size,
    mime: opts.file.type || "application/octet-stream",
    filename: opts.file.name,
  };
}

/** Gera URL assinada de leitura (default 1h). */
export async function getSignedUrl(bucket: StorageBucket, path: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

/** Remove um arquivo do bucket. */
export async function removeFile(bucket: StorageBucket, path: string) {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

/** Faz upload de um Blob (ex: PDF gerado em runtime) e retorna o path. */
export async function uploadBlob(opts: {
  bucket: StorageBucket;
  userId: string;
  blob: Blob;
  filename: string;
  contentType?: string;
}): Promise<{ path: string; size: number; mime: string; filename: string }> {
  const safe = opts.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${opts.userId}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from(opts.bucket).upload(path, opts.blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: opts.contentType ?? opts.blob.type ?? "application/octet-stream",
  });
  if (error) throw error;
  return {
    path,
    size: opts.blob.size,
    mime: opts.contentType ?? opts.blob.type ?? "application/octet-stream",
    filename: opts.filename,
  };
}
