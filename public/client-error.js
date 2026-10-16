/**
 * Client error reports. A failed report is never reported again.
 * The page dedupes identical reports and, until one report is accepted,
 * sends only a few attempts. After the endpoint fails, reporting stops.
 */
(function (root) {
  var CLIENT_ERROR_PATH = "/api/client-errors";
  // In-flight burst before the first response. A failing endpoint stays inside this.
  var MAX_ATTEMPTS_UNTIL_PROVEN = 4;
  // Backstop once the endpoint has accepted a report. Normal pages stay far below it.
  var MAX_ATTEMPTS_PER_PAGE = 40;

  function reportKey(surface, code, message) {
    return String(surface == null ? "" : surface) + "\0" + String(code == null ? "" : code) + "\0" + String(message == null ? "" : message);
  }

  /**
   * @param {(path: string, body: object) => Promise<{ok?: boolean}|null|undefined>} post
   *   Transport. Must not report its own failure.
   */
  function createReporter(post) {
    var attempts = 0;
    var stopped = false;
    var proven = false;
    var seen = new Set();

    function report(input) {
      var body = input || {};
      if (stopped) return Promise.resolve({ sent: false, reason: "stopped" });
      var ceiling = proven ? MAX_ATTEMPTS_PER_PAGE : MAX_ATTEMPTS_UNTIL_PROVEN;
      if (attempts >= ceiling) return Promise.resolve({ sent: false, reason: "capped" });
      var key = reportKey(body.surface, body.code, body.message);
      if (seen.has(key)) return Promise.resolve({ sent: false, reason: "duplicate" });
      seen.add(key);
      attempts += 1;
      var attempt = attempts;
      return Promise.resolve()
        .then(function () {
          return post(CLIENT_ERROR_PATH, body);
        })
        .then(
          function (result) {
            var ok = !!(result && result.ok !== false);
            if (ok) proven = true;
            else stopped = true;
            return { sent: true, ok: ok, attempt: attempt };
          },
          function () {
            stopped = true;
            return { sent: true, ok: false, attempt: attempt };
          }
        );
    }

    return {
      report: report,
      path: CLIENT_ERROR_PATH,
      maxAttemptsUntilProven: MAX_ATTEMPTS_UNTIL_PROVEN,
      maxAttemptsPerPage: MAX_ATTEMPTS_PER_PAGE,
    };
  }

  root.FlavorWeaveClientErrors = {
    createReporter: createReporter,
    CLIENT_ERROR_PATH: CLIENT_ERROR_PATH,
    MAX_ATTEMPTS_UNTIL_PROVEN: MAX_ATTEMPTS_UNTIL_PROVEN,
    MAX_ATTEMPTS_PER_PAGE: MAX_ATTEMPTS_PER_PAGE,
  };
})(typeof window !== "undefined" ? window : globalThis);
