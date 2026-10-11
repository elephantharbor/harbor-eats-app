/* global window, document */
/**
 * Reason lines and in-place "Why this one?" disclosure (UX card §5).
 */
(function (global) {
  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function joinFacts(parts, maxLen) {
    const line = parts.filter(Boolean).slice(0, 2).join(" · ");
    if (!line) return "";
    if (!maxLen || line.length <= maxLen) return line;
    return line.slice(0, maxLen - 1).trim() + "…";
  }

  function reasonLineFromRow(row, deps) {
    if (!row) return "";
    const tasteFn = deps && deps.tasteReasonLine;
    if (tasteFn) {
      const taste = tasteFn(row);
      if (taste) {
        const short = taste.replace(/^You (said you like|told us you love) /i, "");
        if (row.primary_reason === "taste_love") return joinFacts(["A favorite flavor"], 40);
        return joinFacts([short ? short.charAt(0).toUpperCase() + short.slice(1) : "A flavor you like"], 40);
      }
    }
    const facts = [];
    if (row.effort_level === "easy") facts.push("Easy, like you asked");
    if (row.ingredient_complexity === "simple") facts.push("Simple ingredients");
    if ((row.reasons || []).indexOf("explicit_different") >= 0) facts.push("Not on your table lately");
    if ((row.reasons || []).indexOf("fatigue") >= 0) facts.push("A break from the usual");
    if (row.total_minutes != null && row.total_minutes <= 30) facts.push("On the table quickly");
    return joinFacts(facts, 40);
  }

  function reasonLineFromMeal(meal, row, intent) {
    const fromRow = reasonLineFromRow(row, { tasteReasonLine: null });
    if (fromRow) return fromRow;
    if (meal && meal.pers && meal.pers.line && !/^clears/i.test(meal.pers.line)) {
      return joinFacts([meal.pers.line], 40);
    }
    if (intent && intent.keep_it_easy) return "Easy, like you asked";
    return "";
  }

  function disclosureHtml(id, reasonLine, opts) {
    if (!reasonLine && !(opts && opts.forceButton)) return "";
    const rid = id || "why-" + Math.random().toString(36).slice(2, 9);
    const revealId = rid + "-reveal";
    const payloadAttr = opts && opts.payload ? ' data-why-payload="' + esc(JSON.stringify(opts.payload)) + '"' : "";
    let html = "";
    if (reasonLine) {
      html += '<p class="reason-line" data-why-reason>' + esc(reasonLine) + "</p>";
    }
    html +=
      '<button type="button" class="btn btn-quiet btn-sm why-disclosure" data-why-toggle aria-expanded="false" aria-controls="' +
      esc(revealId) +
      '"' +
      payloadAttr +
      ">Why this one? <span class=\"why-disclosure__chev\" aria-hidden=\"true\">▾</span></button>" +
      '<div class="why-reveal" id="' +
      esc(revealId) +
      '" hidden data-why-reveal>' +
      '<div class="why-reveal__inner" aria-live="polite"></div>' +
      '<p class="meta why-cold-hint" hidden data-why-cold>Rate a few dinners and these get sharper.</p>' +
      "</div>";
    return html;
  }

  function bindDisclosures(root, deps) {
    if (!root) return;
    root.querySelectorAll("[data-why-toggle]").forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", function () {
        const wrap = btn.closest("[data-why-wrap]") || btn.parentElement;
        const reveal = wrap && wrap.querySelector("[data-why-reveal]");
        if (!reveal) return;
        const open = btn.getAttribute("aria-expanded") === "true";
        if (open) {
          btn.setAttribute("aria-expanded", "false");
          reveal.hidden = true;
          const chev = btn.querySelector(".why-disclosure__chev");
          if (chev) chev.textContent = "▾";
          return;
        }
        btn.setAttribute("aria-expanded", "true");
        reveal.hidden = false;
        const chev = btn.querySelector(".why-disclosure__chev");
        if (chev) chev.textContent = "▴";
        const inner = reveal.querySelector(".why-reveal__inner");
        const cached = reveal.dataset.cachedText;
        if (cached && inner) {
          inner.textContent = cached;
          inner.classList.add("is-visible");
          return;
        }
        if (!deps || !deps.fetchExplanation) return;
        const payload = JSON.parse(btn.dataset.whyPayload || reveal.dataset.whyPayload || "{}");
        const mark =
          '<span class="weave-mark weave-mark--mini" aria-hidden="true"><span></span><span></span><span></span></span>';
        if (inner) inner.innerHTML = mark;
        const t0 = Date.now();
        deps
          .fetchExplanation(payload)
          .then(function (res) {
            const text = (res && res.text) || payload.template || "";
            if (inner) {
              inner.innerHTML = '<span class="why-reveal__text" aria-hidden="true">' + esc(text) + "</span>";
              inner.classList.add("is-visible");
            }
            reveal.dataset.cachedText = text;
            if (deps.track) deps.track("explanation_opened", {
              recipe_slug: payload.recipe_slug,
              source: (res && res.source) || "template",
              basis: (res && res.basis) || payload.basis,
            });
            const cold = reveal.querySelector("[data-why-cold]");
            if (cold && res && res.basis === "cold" && !sessionStorage.getItem("fw_why_cold_hint")) {
              cold.hidden = false;
              sessionStorage.setItem("fw_why_cold_hint", "1");
            }
          })
          .catch(function () {
            const fallback = payload.template || "Something different that still keeps tonight easy.";
            if (inner) {
              inner.textContent = fallback;
              inner.classList.add("is-visible");
            }
            reveal.dataset.cachedText = fallback;
          })
          .finally(function () {
            if (Date.now() - t0 < 6000) return;
          });
      });
    });
  }

  global.FlavorWeaveExplanation = {
    reasonLineFromRow,
    reasonLineFromMeal,
    disclosureHtml,
    bindDisclosures,
    joinFacts,
  };
})(window);
