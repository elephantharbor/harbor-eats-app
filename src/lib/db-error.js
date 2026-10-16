/**
 * Database failures stay on the server.
 * API bodies get a stable code. They do not get SQL, constraint names, or driver text.
 */

const LEAK = /unique constraint|not null constraint|foreign key constraint|check constraint|sqlite_|d1_error|no such table|no such column|syntax error|sql logic error|constraint failed|\bidx_[a-z0-9_]+|\binsert into\b|\bdelete from\b|\bselect\b[\s\S]{0,80}\bfrom\b|\bupdate\b[\s\S]{0,40}\bset\b|household_shop_|pragma /i;

export function databaseLeakText(value) {
  return LEAK.test(String(value ?? ""));
}

export function isUniqueViolation(error) {
  return /unique constraint failed/i.test(String(error?.message || error || ""));
}

/**
 * Server log: a class, never the SQL text or bound values.
 * @param {string} scope
 * @param {unknown} error
 */
export function logDatabaseError(scope, error) {
  const text = String(error?.message || error || "");
  let kind = "internal";
  if (/unique constraint failed/i.test(text)) kind = "unique";
  else if (/not null constraint failed/i.test(text)) kind = "not_null";
  else if (/foreign key constraint failed/i.test(text)) kind = "foreign_key";
  else if (/check constraint failed/i.test(text)) kind = "check";
  else if (/no such table|no such column/i.test(text)) kind = "schema";
  else if (databaseLeakText(text)) kind = "database";
  console.error(JSON.stringify({ event: "db_error", scope: String(scope || "api").slice(0, 60), kind }));
}

/**
 * Drop leaked database text from an error body. User-facing grocery copy is kept
 * when it does not look like SQL.
 * @param {Record<string, unknown>|null|undefined} body
 */
export function stripDatabaseDetail(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const next = { ...body };
  if (next.detail != null && databaseLeakText(next.detail)) {
    logDatabaseError(String(next.error || next.code || "api"), next.detail);
    delete next.detail;
  }
  if (typeof next.message === "string" && databaseLeakText(next.message)) {
    logDatabaseError(String(next.error || next.code || "api"), next.message);
    delete next.message;
  }
  return next;
}
