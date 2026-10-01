/** @param {string} cookieHeader */
export function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader || typeof cookieHeader !== "string") return out;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

export const SESSION_COOKIE = "he_session";

/**
 * @param {string} token
 * @param {string} expiresAtIso
 * @param {{ secure?: boolean }} opts
 */
export function sessionSetCookieHeader(token, expiresAtIso, opts = {}) {
  const secure = opts.secure !== false;
  const maxAge = Math.max(
    0,
    Math.floor((new Date(expiresAtIso).getTime() - Date.now()) / 1000)
  );
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function sessionClearCookieHeader(opts = {}) {
  const secure = opts.secure !== false;
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}
