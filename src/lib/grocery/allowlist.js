/**
 * Destination URLs we may open or store.
 * API hosts are not navigation hosts.
 * Verified 2026-10-16: the create-shopping-list example uses http://example.com
 * as a placeholder. That host is not allowed.
 * https://docs.instacart.com/developer_platform_api/api/products/create_shopping_list_page/
 */

export const INSTACART_NAV_HOSTS = Object.freeze(["www.instacart.com", "instacart.com"]);

export const INSTACART_API_HOSTS = Object.freeze({
  development: "https://connect.dev.instacart.tools",
  production: "https://connect.instacart.com",
});

export function destinationAllowed(raw) {
  if (typeof raw !== "string" || !raw) return { ok: false, reason: "missing" };
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "scheme" };
  if (url.username || url.password) return { ok: false, reason: "credentials" };
  if (url.port) return { ok: false, reason: "port" };
  const host = url.hostname.toLowerCase();
  if (!INSTACART_NAV_HOSTS.includes(host)) return { ok: false, reason: "host" };
  return { ok: true, url: url.toString() };
}

export function linkbackUrl(requestUrl) {
  let url;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !local) return null;
  return `${url.origin}/shop`;
}
