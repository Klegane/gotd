// Shared date/time/text helpers used by both the rule-based fallback
// (chatbot.ts) and the LLM action catalog (chatbot-actions.ts).
// Date/time validators and shiftLocalDate live in voting.ts (single source
// of truth) and are re-exported here for the chatbot modules' convenience.

import { isValidLocalDate, isValidLocalTime, shiftLocalDate } from "@/server/voting";

export { isValidLocalDate, isValidLocalTime, shiftLocalDate };

export function normalizeText(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function normalizeYear(value: string): number {
  const year = Number(value);
  return value.length === 2 ? 2000 + year : year;
}

export function extractLocalDate(original: string, normalized: string, today: string): string | null {
  if (normalized.includes("pasado manana")) {
    return shiftLocalDate(today, 2);
  }

  if (normalized.includes("manana")) {
    return shiftLocalDate(today, 1);
  }

  if (normalized.includes("hoy")) {
    return today;
  }

  const isoMatch = original.match(/\b(20\d{2}-\d{2}-\d{2})\b/);

  if (isoMatch?.[1] && isValidLocalDate(isoMatch[1])) {
    return isoMatch[1];
  }

  const slashMatch = original.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);

  if (!slashMatch) {
    return null;
  }

  const day = slashMatch[1].padStart(2, "0");
  const month = slashMatch[2].padStart(2, "0");
  const currentYear = Number(today.slice(0, 4));
  const yearInput = slashMatch[3];
  const year = yearInput ? normalizeYear(yearInput) : currentYear;
  const candidate = `${year}-${month}-${day}`;

  if (!isValidLocalDate(candidate)) {
    return null;
  }

  if (!yearInput && candidate < today) {
    return `${currentYear + 1}-${month}-${day}`;
  }

  return candidate;
}

export function extractLocalStartTime(normalized: string): string | null {
  const minutesMatch = normalized.match(/\b([01]?\d|2[0-3])(?:[:h.])([0-5]\d)\b/);

  if (minutesMatch) {
    return `${minutesMatch[1].padStart(2, "0")}:${minutesMatch[2]}`;
  }

  const hourMatch = normalized.match(/\b(?:a las|las|sobre las)\s+([01]?\d|2[0-3])\b/);

  if (hourMatch) {
    return `${hourMatch[1].padStart(2, "0")}:00`;
  }

  return null;
}

export function extractTitle(original: string): string | null {
  const quoted = original.match(/["']([^"']{2,80})["']/);
  const candidate = quoted?.[1] ?? original.match(/\b(?:llamada|titulada|titulo|nombre)\s+([^.;,]{2,80})/i)?.[1];
  const clean = candidate?.replace(/\s+a\s+las\s+\d{1,2}.*$/i, "").trim();
  return clean || null;
}
