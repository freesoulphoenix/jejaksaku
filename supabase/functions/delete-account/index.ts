import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS"
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "content-type": "application/json"
    }
  });
}

function getBearerToken(req: Request) {
  const authorization = req.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return "";
  }

  return token;
}

async function removeUserFolder(supabase: ReturnType<typeof createClient>, bucket: string, folder: string) {
  let removed = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, {
      limit: 1000
    });

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    const paths = data
      .filter((item) => item.name)
      .map((item) => `${folder}/${item.name}`);

    if (paths.length > 0) {
      const { error: removeError } = await supabase.storage.from(bucket).remove(paths);

      if (removeError) {
        throw removeError;
      }

      removed += paths.length;
    }

    if (data.length < 1000) {
      break;
    }
  }

  return removed;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: CORS_HEADERS
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Supabase delete account environment is not configured." }, 500);
  }

  const token = getBearerToken(req);

  if (!token) {
    return jsonResponse({ error: "Missing user session." }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false
    }
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return jsonResponse({ error: "Invalid user session." }, 401);
  }

  try {
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    let receiptFilesDeleted = 0;
    let statementFilesDeleted = 0;

    if (profile?.id) {
      receiptFilesDeleted = await removeUserFolder(supabase, "receipts", profile.id);
      statementFilesDeleted = await removeUserFolder(supabase, "statements", profile.id);

      const { error: deleteProfileError } = await supabase
        .from("user_profiles")
        .delete()
        .eq("id", profile.id);

      if (deleteProfileError) {
        throw deleteProfileError;
      }
    }

    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userData.user.id);

    if (deleteUserError) {
      throw deleteUserError;
    }

    return jsonResponse({
      ok: true,
      receiptFilesDeleted,
      statementFilesDeleted
    });
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : "Unable to delete account."
    }, 500);
  }
});
