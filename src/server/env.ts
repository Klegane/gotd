import { z } from "zod";

const envSchema = z.object({
  APP_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  BGG_USERNAME: z.string().min(1),
  BGG_USER_ID: z.string().optional(),
  BGG_COLLECTION_URL: z.string().url().optional(),
  DATABASE_URL: z.string().min(1),
  APP_TIMEZONE: z.string().refine(isValidTimeZone, "APP_TIMEZONE must be a valid IANA timezone"),
  BGG_INCLUDE_EXPANSIONS: z.boolean(),
  ADMIN_EMAILS: z.array(z.string().email()),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  CHATBOT_MODEL: z.string().min(1).optional()
});

export type ServerEnv = z.infer<typeof envSchema>;

export class ConfigurationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid runtime configuration: ${issues.join("; ")}`);
    this.name = "ConfigurationError";
  }
}

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(readRawEnv());
  if (!parsed.success) {
    throw new ConfigurationError(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`));
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function getConfigStatus(): { ok: true; env: ServerEnv } | { ok: false; issues: string[] } {
  try {
    return { ok: true, env: getServerEnv() };
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return { ok: false, issues: error.issues };
    }

    return { ok: false, issues: [error instanceof Error ? error.message : "Unknown configuration error"] };
  }
}

function readRawEnv() {
  return {
    APP_URL: process.env.APP_URL ?? process.env.NEXTAUTH_URL,
    AUTH_SECRET: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    BGG_USERNAME: process.env.BGG_USERNAME,
    BGG_USER_ID: emptyToUndefined(process.env.BGG_USER_ID),
    BGG_COLLECTION_URL: emptyToUndefined(process.env.BGG_COLLECTION_URL),
    DATABASE_URL: process.env.DATABASE_URL,
    APP_TIMEZONE: process.env.APP_TIMEZONE ?? "Europe/Madrid",
    BGG_INCLUDE_EXPANSIONS: parseBoolean(process.env.BGG_INCLUDE_EXPANSIONS),
    ADMIN_EMAILS: parseCsv(process.env.ADMIN_EMAILS),
    ANTHROPIC_API_KEY: emptyToUndefined(process.env.ANTHROPIC_API_KEY),
    CHATBOT_MODEL: emptyToUndefined(process.env.CHATBOT_MODEL)
  };
}

function parseBoolean(value: string | undefined): boolean {
  return value?.toLowerCase() === "true";
}

function emptyToUndefined(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

function parseCsv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
