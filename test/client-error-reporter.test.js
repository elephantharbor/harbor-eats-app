import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

function loadReporter() {
  const code = readFileSync(new URL("../public/client-error.js", import.meta.url), "utf8");
  const sandbox = { window: {}, Object, JSON, String, Set, Promise };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.FlavorWeaveClientErrors;
}

const ClientErrors = loadReporter();

function deferred() {
  /** @type {(value: {ok?: boolean}) => void} */
  let resolve;
  /** @type {(reason?: unknown) => void} */
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("client error reporter", () => {
  it("stops after the endpoint fails and does not report that failure", async () => {
    const calls = [];
    const gate = deferred();
    const reporter = ClientErrors.createReporter((_path, body) => {
      calls.push(body);
      return gate.promise;
    });

    const pending = [];
    for (let i = 0; i < 20; i += 1) {
      pending.push(reporter.report({ surface: "api", code: "down", message: `err ${i}` }));
    }
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toHaveLength(ClientErrors.MAX_ATTEMPTS_UNTIL_PROVEN);
    expect(calls.length).toBeLessThanOrEqual(4);

    gate.resolve({ ok: false });
    const firstWave = await Promise.all(pending);
    expect(firstWave.filter((row) => row.sent).length).toBe(ClientErrors.MAX_ATTEMPTS_UNTIL_PROVEN);

    const again = await reporter.report({ surface: "api", code: "down", message: "later" });
    expect(again).toEqual({ sent: false, reason: "stopped" });
    expect(calls).toHaveLength(ClientErrors.MAX_ATTEMPTS_UNTIL_PROVEN);
  });

  it("treats a thrown transport error as a failed report and does not retry it", async () => {
    const calls = [];
    const reporter = ClientErrors.createReporter(() => {
      calls.push("post");
      throw new Error("network down");
    });
    const first = await reporter.report({ surface: "api", code: "network", message: "network down" });
    expect(first.sent).toBe(true);
    expect(first.ok).toBe(false);
    const second = await reporter.report({ surface: "api", code: "network", message: "network down" });
    expect(second).toEqual({ sent: false, reason: "stopped" });
    expect(calls).toEqual(["post"]);
  });

  it("reports distinct errors once when the endpoint accepts them", async () => {
    const calls = [];
    const reporter = ClientErrors.createReporter((_path, body) => {
      calls.push(body.message);
      return Promise.resolve({ ok: true });
    });
    expect((await reporter.report({ surface: "api", code: "bad", message: "/api/sessions/me 500" })).ok).toBe(true);
    expect(await reporter.report({ surface: "api", code: "bad", message: "/api/sessions/me 500" })).toEqual({
      sent: false,
      reason: "duplicate",
    });
    expect((await reporter.report({ surface: "invite", code: "blocked", message: "cross household join blocked" })).ok).toBe(
      true
    );
    expect(calls).toEqual(["/api/sessions/me 500", "cross household join blocked"]);
  });

  it("does not post the reporter path through a transport that would re-enter reporting", async () => {
    const paths = [];
    const reporter = ClientErrors.createReporter((path) => {
      paths.push(path);
      if (path === "/api/client-errors") return Promise.resolve({ ok: false });
      return Promise.resolve({ ok: true });
    });
    await reporter.report({ surface: "api", code: "x", message: "one" });
    await reporter.report({ surface: "api", code: "x", message: "two" });
    expect(paths).toEqual(["/api/client-errors"]);
  });

  it("does not post an expected abort", async () => {
    const calls = [];
    const reporter = ClientErrors.createReporter((_path, body) => {
      calls.push(body);
      return Promise.resolve({ ok: true });
    });
    expect(await reporter.report({ surface: "share", code: "AbortError", message: "AbortError" })).toEqual({
      sent: false,
      reason: "expected_abort",
    });
    expect(await reporter.report({ surface: "share", code: "share_cancelled", message: "share cancelled" })).toEqual({
      sent: false,
      reason: "expected_abort",
    });
    expect((await reporter.report({ surface: "api", code: "internal", message: "/api/sessions/logout 500" })).sent).toBe(true);
    expect(calls).toEqual([{ surface: "api", code: "internal", message: "/api/sessions/logout 500" }]);
  });
});
