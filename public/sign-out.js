/**
 * Confirm a sign-out with the server before the device forgets the kitchen.
 * A timeout, a dropped request, or a 5xx is not a sign-out.
 */
const DEFAULT_TIMEOUT_MS = 8000;

export async function confirmServerSignOut(fetchImpl, options = {}) {
  const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const parent = options.signal;
  const onParentAbort = () => controller.abort();
  if (parent) {
    if (parent.aborted) controller.abort();
    else parent.addEventListener("abort", onParentAbort);
  }

  function abortedReason() {
    return { ok: false, confirmed: false, reason: "timeout" };
  }

  try {
    let response;
    try {
      response = await fetchImpl("/api/sessions/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: "{}",
        signal: controller.signal,
      });
    } catch (error) {
      if (error && error.name === "AbortError") return abortedReason();
      return { ok: false, confirmed: false, reason: "network" };
    }
    if (!response || !response.ok) {
      return { ok: false, confirmed: false, reason: "http", status: response ? response.status : 0 };
    }
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    const bodyOk = !!(body && body.ok === true);
    let meStatus = null;
    try {
      const me = await fetchImpl("/api/sessions/me", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      meStatus = me ? me.status : null;
    } catch (error) {
      if (error && error.name === "AbortError") {
        if (bodyOk) return { ok: true, confirmed: true, via: "body" };
        return abortedReason();
      }
      if (bodyOk) return { ok: true, confirmed: true, via: "body" };
      return { ok: false, confirmed: false, reason: "network" };
    }
    if (meStatus === 401) return { ok: true, confirmed: true, via: "me" };
    if (meStatus === 200) return { ok: false, confirmed: false, reason: "still_signed_in", status: 200 };
    if (bodyOk) return { ok: true, confirmed: true, via: "body" };
    return { ok: false, confirmed: false, reason: "unconfirmed", status: meStatus };
  } finally {
    clearTimeout(timer);
    if (parent) parent.removeEventListener("abort", onParentAbort);
  }
}

export const SIGN_OUT_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;

if (typeof window !== "undefined") {
  window.FlavorWeaveSignOut = {
    confirmServerSignOut,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
}
