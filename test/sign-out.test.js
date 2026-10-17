import { describe, expect, it } from "vitest";
import { confirmServerSignOut } from "../public/sign-out.js";
import { ensureShopImageFont } from "../public/shop-list-image.js";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

describe("confirmServerSignOut", () => {
  it("confirms when logout succeeds and the session read is 401", async () => {
    const calls = [];
    const result = await confirmServerSignOut(async (path) => {
      calls.push(path);
      if (path === "/api/sessions/logout") return jsonResponse(200, { ok: true });
      return jsonResponse(401, { ok: false });
    });
    expect(result).toEqual({ ok: true, confirmed: true, via: "me" });
    expect(calls).toEqual(["/api/sessions/logout", "/api/sessions/me"]);
  });

  it("does not treat a still-valid session as signed out", async () => {
    const result = await confirmServerSignOut(async (path) => {
      if (path === "/api/sessions/logout") return jsonResponse(200, { ok: true });
      return jsonResponse(200, { ok: true, household_id: "hh" });
    });
    expect(result).toEqual({ ok: false, confirmed: false, reason: "still_signed_in", status: 200 });
  });

  it("accepts the logout body when the follow-up read cannot be reached", async () => {
    const result = await confirmServerSignOut(async (path) => {
      if (path === "/api/sessions/logout") return jsonResponse(200, { ok: true });
      throw new Error("offline");
    });
    expect(result).toEqual({ ok: true, confirmed: true, via: "body" });
  });

  it("reports a network failure without confirming", async () => {
    const result = await confirmServerSignOut(async () => {
      throw new Error("offline");
    });
    expect(result).toEqual({ ok: false, confirmed: false, reason: "network" });
  });

  it("reports an HTTP failure without confirming", async () => {
    const result = await confirmServerSignOut(async () => jsonResponse(500, { ok: false }));
    expect(result).toEqual({ ok: false, confirmed: false, reason: "http", status: 500 });
  });

  it("times out a hanging logout", async () => {
    const result = await confirmServerSignOut(
      (_path, init) =>
        new Promise((_resolve, reject) => {
          const signal = init && init.signal;
          if (signal && signal.aborted) {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
            return;
          }
          if (signal) {
            signal.addEventListener("abort", () => {
              reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
            });
          }
        }),
      { timeoutMs: 20 }
    );
    expect(result).toEqual({ ok: false, confirmed: false, reason: "timeout" });
  });
});

describe("ensureShopImageFont", () => {
  it("uses Plus Jakarta Sans when the face loads", async () => {
    const loaded = [];
    const result = await ensureShopImageFont({
      fonts: {
        load(spec) {
          loaded.push(spec);
          return Promise.resolve([]);
        },
        check() {
          return true;
        },
      },
    });
    expect(loaded).toEqual([
      '700 64px "Plus Jakarta Sans"',
      '400 44px "Plus Jakarta Sans"',
      '500 22px "Plus Jakarta Sans"',
    ]);
    expect(result.loaded).toBe(true);
    expect(result.fontFamily).toContain("Plus Jakarta Sans");
  });

  it("keeps the fallback stack when the face never loads", async () => {
    const result = await ensureShopImageFont({
      timeoutMs: 15,
      fonts: {
        load() {
          return new Promise(() => {});
        },
      },
    });
    expect(result.loaded).toBe(false);
    expect(result.fontFamily).toContain("Inter");
    expect(result.fontFamily).toContain("Plus Jakarta Sans");
  });
});
