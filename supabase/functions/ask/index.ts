// @ts-nocheck
// This file is a Deno edge function and should not be validated by the main TypeScript compiler
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { createFixedWindowLimiter, getClientIp, jsonError, sanitizeText, z } from "../_shared/security.ts";

type Reading = { ph: number; tds: number; turbidity: number; temperature?: number; status?: string; created_at?: string };

const AskRequestSchema = z.object({
  question: z.string().trim().min(1, "Question is required").max(500, "Question must be 500 characters or less"),
});

const rateLimitAsk = createFixedWindowLimiter({
  limit: 10,
  windowMs: 60 * 1000,
  scope: "ai-ask",
  message: "Rate limit exceeded. Please try again shortly.",
  identity: (req) => sanitizeText(req.headers.get("x-user-id") || getClientIp(req), 128) || getClientIp(req),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const buildFallbackAnswer = (reading: Reading | null) => {
  if (!reading) {
    return "No sensor data is available yet. Please send at least one reading and ask again.";
  }

  const issues: string[] = [];
  if (reading.ph < 6.5 || reading.ph > 8.5) issues.push("pH out of safe range");
  if (reading.tds > 1000) issues.push("TDS above 1000 ppm");
  if (reading.turbidity > 25) issues.push("turbidity above 25 NTU");

  if (issues.length === 0) {
    return "Latest reading appears safe for general use based on pH, TDS, and turbidity.";
  }

  return `Latest reading is NOT SAFE: ${issues.join(", ")}. Avoid drinking until treated and re-tested.`;
};

const sanitizeAnswer = (raw: string) => {
  let out = (raw || "").trim();

  // Keep persona fixed even if model drifts.
  out = out.replace(/hydro\s*sentinel/gi, "HydroSentinal");

  // Remove common markdown emphasis noise from model output.
  out = out.replace(/\*\*/g, "").replace(/__/g, "");

  return out;
};

const sanitizeReading = (reading: Reading | null) => {
  if (!reading) return null;

  return {
    ...reading,
    status: typeof reading.status === "string" ? sanitizeText(reading.status, 32) : reading.status,
    created_at: typeof reading.created_at === "string" ? sanitizeText(reading.created_at, 64) : reading.created_at,
  };
};

const isIdentityQuestion = (q: string) =>
  /^(who are you|tum kaun ho|aap kaun ho)\??$/i.test(q.trim());

const isSafeReading = (reading: Reading | null) => {
  if (!reading) return false;
  return !(reading.ph < 6.5 || reading.ph > 8.5 || reading.tds > 1000 || reading.turbidity > 25);
};

const buildPolicyFallback = (reading: Reading | null) => {
  if (!reading) {
    return "I do not have enough water data. Please send a fresh reading. Action: send new sensor data and test again.";
  }

  if (isSafeReading(reading)) {
    return "SAFE: Water looks safe for drinking and daily use. Action: keep using it, and test again regularly.";
  }

  return "NOT SAFE: Water is not safe for drinking right now. Action: use a filter and boil before drinking.";
};

const enforcePromptPolicy = (raw: string, reading: Reading | null, question: string) => {
  if (isIdentityQuestion(question)) {
    return "I am HydroSentinal, your water quality assistant.";
  }

  let out = sanitizeAnswer(raw)
    .replace(/\b(ai|language model|llm|artificial intelligence)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!out) {
    out = buildPolicyFallback(reading);
  }

  const safe = isSafeReading(reading);
  if (!/\bSAFE\b|\bNOT SAFE\b/i.test(out)) {
    out = `${safe ? "SAFE" : "NOT SAFE"}: ${out}`;
  }

  if (!/(action|boil|filter|avoid|use|test again|do not drink|drink)/i.test(out)) {
    out += safe
      ? " Action: keep testing water regularly."
      : " Action: boil and filter before any drinking use.";
  }

  const words = out.split(/\s+/).filter(Boolean);
  if (words.length > 60) {
    out = words.slice(0, 60).join(" ");
  }

  return out;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const rateLimitResponse = await rateLimitAsk(req, corsHeaders);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch (error) {
      console.warn("ask validation failed: invalid JSON body", error);
      return jsonError("Invalid JSON body", 400, corsHeaders);
    }

    const parsed = AskRequestSchema.safeParse(body);
    if (!parsed.success) {
      console.warn("ask validation failed:", parsed.error.flatten());
      return jsonError("Invalid question payload", 400, corsHeaders, {
        issues: parsed.error.flatten(),
      });
    }

    const normalizedQuestion = sanitizeText(parsed.data.question, 500);
    if (!normalizedQuestion) {
      console.warn("ask validation failed: question was empty after sanitization");
      return jsonError("Question is required", 400, corsHeaders);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 👉 latest reading fetch karo
    const { data: readings } = await supabase
      .from("readings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    const latest = sanitizeReading(readings?.[0] ?? null);

    const context = latest
      ? `Latest water reading (at ${latest.created_at}):
- pH: ${latest.ph} (safe range 6.5–8.5)
- TDS: ${latest.tds} ppm (safe ≤ 1000)
- Turbidity: ${latest.turbidity} NTU (safe ≤ 25)
- Temperature: ${latest.temperature} °C
- Status: ${latest.status}`
      : "No sensor readings have been received yet.";

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      const answer = buildFallbackAnswer(latest);
      return new Response(JSON.stringify({ answer, latest }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Hard guard for identity queries so persona never drifts.
    if (isIdentityQuestion(normalizedQuestion)) {
      return new Response(
        JSON.stringify({ answer: "I am HydroSentinal, your water quality assistant.", latest }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const systemPrompt = `You are HydroSentinal, an intelligent water quality assistant.
 
Your job is:
1. Analyze water parameters (pH, TDS, turbidity)
2. Decide if water is SAFE or NOT SAFE
3. Give clear practical advice

Rules:
- If SAFE, say it is safe and where it can be used (drinking, washing, etc.)
- If NOT SAFE, explain why and suggest a practical solution (boil, filter, avoid, etc.)
- Keep answer short (max 60 words)
- Use very simple and clear language
- Avoid technical words where possible
- Always use the latest reading values while answering
- Always suggest at least one action based on the reading (e.g. "You can drink it", "Avoid using for cooking", "Boil before drinking", "Use a filter", etc.)
- If asked "who are you", reply: your name and that you are a water quality assistant. Do not mention being an AI or language model.
Reply in simple Hinglish (mix of Hindi + English).
Keep tone clear, helpful, and professional.`;

  const userPrompt = `${context}\n\nQuestion: ${normalizedQuestion}\nGive a concise, practical answer based on the above reading.`;

    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 140,
          },
        }),
      },
    );

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        const retryAfterSeconds = Number(aiRes.headers.get("Retry-After") || "60");
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded. Please try again shortly.",
            retryAfterSeconds,
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "Retry-After": String(retryAfterSeconds),
            },
          },
        );
      }

      const t = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
      });
    }

    const json = await aiRes.json();
    const rawAnswer =
      json?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p?.text ?? "")
        .join("\n")
        .trim() || buildFallbackAnswer(latest);

    const answer = enforcePromptPolicy(rawAnswer, latest, normalizedQuestion);

    return new Response(JSON.stringify({ answer, latest }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ask error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
