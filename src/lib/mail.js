/**
 * Outbound mail abstraction — real provider is a human/coordinator step.
 * Dev/test transport records the recovery URL for CI and local use.
 */

/**
 * @param {Record<string, string>|undefined} env
 * @param {{ to?: string|null, recovery_url: string, member_id?: string }} payload
 */
export async function deliverRecoveryLink(env, payload) {
  const transport = (env && env.MAIL_TRANSPORT) || "dev";
  if (transport === "dev" || transport === "test") {
    return {
      ok: true,
      transport,
      /** Echo for automated tests — not shown in production UI */
      dev_recovery_url: payload.recovery_url,
    };
  }
  return { ok: false, error: "mail_provider_not_configured", transport };
}
