import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { createFixedWindowLimiter, getClientIp, jsonError, sanitizeText } from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const rateLimitLatest = createFixedWindowLimiter({
  limit: 60,
  windowMs: 60 * 1000,
  scope: "api-latest",
  message: "Too Many Requests",
  identity: (req) => getClientIp(req),
});

const sanitizeReading = (reading: Record<string, unknown> | null) => {
  if (!reading) return null;

  return {
    ...reading,
    status: typeof reading.status === "string" ? sanitizeText(reading.status, 32) : reading.status,
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const rateLimitResponse = await rateLimitLatest(req, corsHeaders);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("readings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return new Response(JSON.stringify({ reading: sanitizeReading(data) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("latest error:", e);
    return jsonError(e instanceof Error ? e.message : "Unknown", 500, corsHeaders);
  }
});
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
