/**
 * Split client_error rows into an actionable count and three expected buckets.
 * History stays in the table. Classification is read from the stored message
 * and the household origin already on the household row. No raw input is added.
 */

import { householdIsSynthetic } from "./evidence-origin.js";

export const CLIENT_ERROR_CLASSES = Object.freeze([
  "actionable",
  "expected_logged_out",
  "negative_path",
  "synthetic",
]);

const EXPECTED_LOGGED_OUT = new Set(["/api/sessions/me", "/api/events"]);

export function clientErrorApiStatus(row) {
  const message = String(row?.message || "").trim();
  const match = message.match(/^(\/api\/[A-Za-z0-9_./:-]{1,120}) (\d{3})$/);
  if (!match) return { api_path: null, status: null };
  return { api_path: match[1], status: Number(match[2]) };
}

export function clientErrorIsSynthetic(row) {
  if (!row) return false;
  if (householdIsSynthetic({ data_origin: row.data_origin, acquisition_source: row.acquisition_source })) return true;
  return /^\[synthetic\]/i.test(String(row.display_name || "").trim());
}

/**
 * Exclusive class. Expected logged-out checks win, then synthetic 4xx
 * (the suite's negative paths), then other synthetic traffic, then real errors.
 * @param {{ message?: string|null, data_origin?: string|null, acquisition_source?: string|null, display_name?: string|null }} row
 */
export function classifyClientError(row) {
  const { api_path, status } = clientErrorApiStatus(row);
  if (api_path && EXPECTED_LOGGED_OUT.has(api_path) && status === 401) return "expected_logged_out";
  const synthetic = clientErrorIsSynthetic(row);
  if (synthetic && status != null && status >= 400 && status < 500) return "negative_path";
  if (synthetic) return "synthetic";
  return "actionable";
}

export function summarizeClientErrors(rows) {
  const counts = {
    actionable: 0,
    expected_logged_out: 0,
    negative_path: 0,
    synthetic: 0,
  };
  for (const row of rows || []) counts[classifyClientError(row)] += 1;
  const total = counts.actionable + counts.expected_logged_out + counts.negative_path + counts.synthetic;
  return { total, ...counts };
}

const SAFE_MESSAGE = /^\/api\/[A-Za-z0-9_./:-]{1,120} \d{3}$/;
const SAFE_TOKEN = /^[a-z0-9_]{1,48}$/;
const SAFE_PATH = /^\/[A-Za-z0-9_./:-]{0,120}$/;

/** Keep a closed shape. Drop free text, response bodies, and anything that is not a path or status. */
export function sanitizeClientErrorReport(body) {
  const source = body && typeof body === "object" ? body : {};
  const message = SAFE_MESSAGE.test(String(source.message || "").trim()) ? String(source.message).trim() : null;
  const code = SAFE_TOKEN.test(String(source.code || "").trim()) ? String(source.code).trim() : null;
  const surface = SAFE_TOKEN.test(String(source.surface || "").trim()) ? String(source.surface).trim() : "client";
  const path = SAFE_PATH.test(String(source.path || "").trim()) ? String(source.path).trim() : null;
  return { surface, code, message, path };
}
