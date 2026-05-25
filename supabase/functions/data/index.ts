// @ts-nocheck
// This file is a Deno edge function and should not be validated by the main TypeScript compiler
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { createFixedWindowLimiter, getClientIp, jsonError, sanitizeText, z } from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ReadingSchema = z.object({
  ph: z.coerce.number().finite().min(0).max(14),
  tds: z.coerce.number().finite().min(0).max(10000),
  turbidity: z.coerce.number().finite().min(0).max(5000),
  temperature: z.coerce.number().finite().min(-50).max(100),
  status: z
    .preprocess((value) => (typeof value === "string" ? sanitizeText(value, 16).toUpperCase() : value), z.enum(["SAFE", "NOT SAFE"]))
    .optional(),
});

const rateLimitData = createFixedWindowLimiter({
  limit: 60,
  windowMs: 60 * 1000,
  scope: "api-data",
  message: "Too Many Requests",
  identity: (req) => getClientIp(req),
});

function computeStatus(ph: number, tds: number, turbidity: number): "SAFE" | "NOT SAFE" {
  if (ph < 6.5 || ph > 8.5 || tds > 1000 || turbidity > 25) return "NOT SAFE";
  return "SAFE";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405, corsHeaders);
  }

  const rateLimitResponse = await rateLimitData(req, corsHeaders);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch (error) {
      console.warn("data validation failed: invalid JSON body", error);
      return jsonError("Invalid JSON body", 400, corsHeaders);
    }

    const parsed = ReadingSchema.safeParse(body);
    if (!parsed.success) {
      console.warn("data validation failed:", parsed.error.flatten());
      return jsonError("Invalid sensor payload", 400, corsHeaders, {
        issues: parsed.error.flatten(),
      });
    }

    const ph = parsed.data.ph;
    const tds = parsed.data.tds;
    const turbidity = parsed.data.turbidity;
    const temperature = parsed.data.temperature;

    const status = parsed.data.status ?? computeStatus(ph, tds, turbidity);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("readings")
      .insert({ ph, tds, turbidity, temperature, status })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, reading: { ...data, status: sanitizeText(data.status, 16) } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("data error:", e);
    return jsonError(e instanceof Error ? e.message : "Unknown", 500, corsHeaders);
  }
});
