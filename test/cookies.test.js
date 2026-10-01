import { describe, expect, it } from "vitest";
import { parseCookies, SESSION_COOKIE, sessionSetCookieHeader } from "../src/lib/cookies.js";

describe("cookies", () => {
  it("parses cookie header", () => {
    const c = parseCookies("a=1; he_session=abc%3D; b=two");
    expect(c.a).toBe("1");
    expect(c[SESSION_COOKIE]).toBe("abc=");
    expect(c.b).toBe("two");
  });

  it("builds session Set-Cookie", () => {
    const exp = new Date(Date.now() + 86400000).toISOString();
    const h = sessionSetCookieHeader("tok", exp, { secure: false });
    expect(h).toContain("he_session=tok");
    expect(h).toContain("HttpOnly");
  });
});
