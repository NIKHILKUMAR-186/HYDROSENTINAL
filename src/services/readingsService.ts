import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type ReadingRow = Tables<"readings">;

export type ReadingInput = Pick<
  TablesInsert<"readings">,
  "ph" | "tds" | "turbidity" | "temperature"
> & {
  status?: string;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const computeReadingStatus = (
  ph: number,
  tds: number,
  turbidity: number,
): "SAFE" | "NOT SAFE" => {
  if (ph < 6.5 || ph > 8.5 || tds > 1000 || turbidity > 25) {
    return "NOT SAFE";
  }

  return "SAFE";
};

export const validateReadingInput = (reading: ReadingInput): ReadingInput => {
  const { ph, tds, turbidity, temperature } = reading;

  if (![ph, tds, turbidity, temperature].every(isFiniteNumber)) {
    throw new Error("Reading values must be valid numbers.");
  }

  return {
    ph,
    tds,
    turbidity,
    temperature,
    status: typeof reading.status === "string" ? reading.status : undefined,
  };
};

export const buildReadingPayload = (
  reading: ReadingInput,
): TablesInsert<"readings"> => {
  const validated = validateReadingInput(reading);
  const status =
    validated.status?.toUpperCase() === "SAFE" ||
    validated.status?.toUpperCase() === "NOT SAFE"
      ? validated.status.toUpperCase()
      : computeReadingStatus(validated.ph, validated.tds, validated.turbidity);

  return {
    ph: validated.ph,
    tds: validated.tds,
    turbidity: validated.turbidity,
    temperature: validated.temperature,
    status,
  };
};

export const postReadingToSupabase = async (
  reading: ReadingInput,
): Promise<ReadingRow> => {
  const payload = buildReadingPayload(reading);
  const { data, error } = await supabase.functions.invoke("data", {
    body: payload,
  });

  if (error) {
    throw error;
  }

  const insertedReading = data?.reading as ReadingRow | undefined;
  if (!insertedReading) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : "Supabase did not return the inserted reading.",
    );
  }

  return insertedReading;
};