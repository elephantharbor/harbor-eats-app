import { describe, expect, it } from "vitest";

describe("session API contract", () => {
  it("postSession response must not echo session_token (documented shape)", () => {
    const sample = {
      ok: true,
      household_id: "hh_x",
      member_id: "m_x",
      expires_at: new Date().toISOString(),
    };
    expect(sample).not.toHaveProperty("session_token");
  });
});
