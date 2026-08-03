import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const CLEANUP_SECRET = Deno.env.get("CLEANUP_SECRET");
const BATCH_SIZE = 100;

type CleanupStats = {
  scanned: number;
  deleted: number;
  failed: number;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

function pathFromPublicUrl(url: string | null, bucket: string) {
  if (!url) {
    return "";
  }

  const marker = `/storage/v1/object/public/${bucket}/`;
  const markerIndex = url.indexOf(marker);

  if (markerIndex === -1) {
    return "";
  }

  return decodeURIComponent(url.slice(markerIndex + marker.length).split("?")[0]);
}

async function cleanupReceipts(supabase: ReturnType<typeof createClient>, now: string): Promise<CleanupStats> {
  const stats = { scanned: 0, deleted: 0, failed: 0 };
  const { data, error } = await supabase
    .from("receipts")
    .select("id, image_url, file_storage_path, thumbnail_url, thumbnail_storage_path")
    .is("file_deleted_at", null)
    .not("image_url", "is", null)
    .lte("file_retention_expires_at", now)
    .limit(BATCH_SIZE);

  if (error) {
    throw error;
  }

  for (const receipt of data ?? []) {
    stats.scanned += 1;
    const storagePath = receipt.file_storage_path || pathFromPublicUrl(receipt.image_url, "receipts");
    const thumbnailStoragePath = receipt.thumbnail_storage_path || pathFromPublicUrl(receipt.thumbnail_url, "receipts");
    const storagePaths = [storagePath, thumbnailStoragePath].filter(Boolean);

    if (storagePaths.length === 0) {
      stats.failed += 1;
      continue;
    }

    const { error: removeError } = await supabase.storage.from("receipts").remove(storagePaths);

    if (removeError) {
      stats.failed += 1;
      continue;
    }

    const { error: updateError } = await supabase
      .from("receipts")
      .update({
        image_url: null,
        thumbnail_url: null,
        file_deleted_at: now
      })
      .eq("id", receipt.id);

    if (updateError) {
      stats.failed += 1;
      continue;
    }

    stats.deleted += 1;
  }

  return stats;
}

async function cleanupStatements(supabase: ReturnType<typeof createClient>, now: string): Promise<CleanupStats> {
  const stats = { scanned: 0, deleted: 0, failed: 0 };
  const { data: tombstones, error: tombstoneQueryError } = await supabase
    .from("statement_imports")
    .select("id")
    .not("file_deleted_at", "is", null)
    .limit(BATCH_SIZE);

  if (tombstoneQueryError) {
    throw tombstoneQueryError;
  }

  const tombstoneIds = (tombstones ?? []).map((item) => item.id);

  if (tombstoneIds.length > 0) {
    stats.scanned += tombstoneIds.length;
    const { error: tombstoneDeleteError } = await supabase
      .from("statement_imports")
      .delete()
      .in("id", tombstoneIds);

    if (tombstoneDeleteError) {
      stats.failed += tombstoneIds.length;
    } else {
      stats.deleted += tombstoneIds.length;
    }
  }

  const { data, error } = await supabase
    .from("statement_imports")
    .select("id, file_url, file_storage_path")
    .is("file_deleted_at", null)
    .not("file_url", "is", null)
    .lte("file_retention_expires_at", now)
    .limit(BATCH_SIZE);

  if (error) {
    throw error;
  }

  for (const statementImport of data ?? []) {
    stats.scanned += 1;
    const storagePath = statementImport.file_storage_path || pathFromPublicUrl(statementImport.file_url, "statements");

    if (!storagePath) {
      stats.failed += 1;
      continue;
    }

    const { error: removeError } = await supabase.storage.from("statements").remove([storagePath]);

    if (removeError) {
      stats.failed += 1;
      continue;
    }

    const { error: deleteError } = await supabase
      .from("statement_imports")
      .delete()
      .eq("id", statementImport.id);

    if (deleteError) {
      stats.failed += 1;
      continue;
    }

    stats.deleted += 1;
  }

  return stats;
}

serve(async (req) => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Supabase cleanup environment is not configured." }, 500);
  }

  if (CLEANUP_SECRET && req.headers.get("x-cleanup-secret") !== CLEANUP_SECRET) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false
    }
  });
  const now = new Date().toISOString();

  try {
    const [receipts, statements] = await Promise.all([
      cleanupReceipts(supabase, now),
      cleanupStatements(supabase, now)
    ]);

    return jsonResponse({
      ok: true,
      now,
      receipts,
      statements
    });
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : "Cleanup failed."
    }, 500);
  }
});
