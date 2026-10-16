/**
 * Grocery error contract. Messages are ours. Provider HTML is never copied through.
 * Verified against Instacart error docs on 2026-10-16:
 * https://docs.instacart.com/developer_platform_api/api/error_and_status_codes
 */

const HTTP = {
  capability_unsupported: 400,
  not_configured: 403,
  auth_failed: 401,
  rate_limited: 429,
  provider_rejected: 502,
  invalid_request: 400,
  timeout: 504,
  cancelled: 400,
  revision_conflict: 409,
};

export function groceryError({
  code,
  retryable = false,
  provider_id = null,
  capability = null,
  provider_code = null,
  message,
  status,
  extra = {},
}) {
  const cleanCode = cleanProviderCode(provider_code);
  return {
    ok: false,
    code,
    error: code,
    retryable: !!retryable,
    provider_id,
    capability,
    provider_code: cleanCode,
    message,
    status: status || HTTP[code] || 400,
    ...extra,
  };
}

export function cleanProviderCode(value) {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  if (!/^\d{3,4}x?$/.test(text)) return null;
  return text;
}

export function capabilityUnsupported(providerId, capability) {
  const name = providerId === "instacart" ? "Instacart" : "This shop";
  return groceryError({
    code: "capability_unsupported",
    provider_id: providerId,
    capability,
    message: `${name} does not confirm that to FlavorWeave.`,
  });
}

export function notConfigured(providerId, capability) {
  return groceryError({
    code: "not_configured",
    provider_id: providerId,
    capability,
    message: "Online ordering is not connected.",
  });
}

/**
 * Map an Instacart HTTP result. Shopping-list 401 is auth_failed.
 * Retailers 401/403 is not_configured for that capability (a key may omit it).
 */
export function fromProviderHttp({ providerId, capability, httpStatus, body }) {
  const parsed = parseProviderBody(body);
  const providerCode = cleanProviderCode(parsed.code);
  if (capability === "retailer_discovery" && (httpStatus === 401 || httpStatus === 403)) {
    return notConfigured(providerId, capability);
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return groceryError({
      code: "auth_failed",
      provider_id: providerId,
      capability,
      provider_code: providerCode,
      message: "Instacart did not accept the connection. A person has to check the key.",
    });
  }
  if (httpStatus === 429 || providerCode === "2003") {
    return groceryError({
      code: "rate_limited",
      retryable: true,
      provider_id: providerId,
      capability,
      provider_code: providerCode || (httpStatus === 429 ? "2003" : null),
      message: "Instacart asked us to wait. Try once more in a moment.",
    });
  }
  if (httpStatus === 408) {
    return groceryError({
      code: "timeout",
      retryable: true,
      provider_id: providerId,
      capability,
      provider_code: providerCode,
      message: "Instacart took too long. Your list was not changed.",
    });
  }
  if (httpStatus >= 500) {
    return groceryError({
      code: "provider_rejected",
      retryable: true,
      provider_id: providerId,
      capability,
      provider_code: providerCode || "5000",
      message: "We couldn’t create the Instacart link. Your list is unchanged.",
    });
  }
  return groceryError({
    code: "provider_rejected",
    retryable: false,
    provider_id: providerId,
    capability,
    provider_code: providerCode,
    message: "We couldn’t create the Instacart link. Your list is unchanged.",
    extra: parsed.line_index == null ? {} : { line_index: parsed.line_index },
  });
}

function parseProviderBody(body) {
  if (!body || typeof body !== "object") return { code: null, line_index: null };
  const code = body.error && body.error.code != null ? body.error.code : body.code;
  const key = (body.meta && body.meta.key) || (body.error && body.error.key) || "";
  const match = String(key).match(/line_items\[(\d+)\]/);
  return { code, line_index: match ? Number(match[1]) : null };
}
