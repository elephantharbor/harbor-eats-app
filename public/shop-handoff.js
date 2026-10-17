/**
 * Order online sheet. FlavorWeave keeps the list. Instacart, when connected,
 * only receives a reviewed link. The CTA stays disabled until an official
 * logo file is committed. Do not draw a substitute mark.
 */
(function () {
  var CTA_LABEL = "Shop on Instacart";
  var LOGO_SRC = "";
  var NAV_HOSTS = { "www.instacart.com": true, "instacart.com": true };

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function safeLaunchUrl(raw) {
    if (!LOGO_SRC) return null;
    try {
      var url = new URL(raw);
      if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
      if (!NAV_HOSTS[url.hostname.toLowerCase()]) return null;
      return url.toString();
    } catch (e) {
      return null;
    }
  }

  function storeNote(shop) {
    var prefs = shop && shop.preferences;
    var store = (prefs && prefs.member && prefs.member.usual_store) || (prefs && prefs.household && prefs.household.usual_store) || "";
    return store ? "You usually shop at " + store + ". You’ll confirm the store on Instacart." : "";
  }

  function renderUnavailable(root, shop) {
    var note = storeNote(shop);
    root.innerHTML =
      '<h2 class="card-title" id="shopOrderTitle">Order online</h2>' +
      (note ? '<p class="meta">' + escapeHtml(note) + "</p>" : "") +
      '<div class="shop-service" aria-disabled="true"><strong>Instacart</strong><span>Not connected yet</span></div>' +
      '<p class="meta">More stores later</p>' +
      '<p class="meta">Shop in store is ready now. Nothing is sent anywhere.</p>';
  }

  var MOCK_BADGE =
    '<p class="shop-mock-badge" data-shop-mock-badge role="note">Preview test — Not a real Instacart connection. Nothing is sent to Instacart.</p>';
  var DEV_BADGE =
    '<p class="shop-mock-badge shop-dev-badge" data-shop-dev-badge role="note">Instacart development — This can send a list to Instacart’s development API. It does not place an order. Shop on Instacart stays off until the official logo is in the app.</p>';

  function channelOf(source) {
    return source && source.channel ? source.channel : "";
  }

  function badgeFor(source) {
    if (!source) return "";
    if (source.mode === "mock" || channelOf(source) === "mock") return MOCK_BADGE;
    if (channelOf(source) === "development") return DEV_BADGE;
    return "";
  }

  function renderChoice(root, shop, provider) {
    var note = storeNote(shop);
    var mock = provider && (provider.mode === "mock" || provider.channel === "mock");
    var dev = provider && provider.channel === "development";
    var label = mock ? " (test)" : dev ? " (development)" : "";
    var detail = mock
      ? "Preview test only. Shows what the list would send."
      : dev
        ? "Development only. Nothing is ordered."
        : "Continues on Instacart. They choose the store and the products.";
    root.innerHTML =
      '<h2 class="card-title" id="shopOrderTitle">Order online</h2>' +
      badgeFor(provider) +
      (note ? '<p class="meta">' + escapeHtml(note) + "</p>" : "") +
      '<button type="button" class="shop-service shop-service--live" id="btnShopPickInstacart">' +
      "<strong>Instacart" + label + "</strong><span>" +
      detail +
      "</span></button>" +
      '<p class="meta">More stores later</p>';
  }

  function itemActions(item) {
    if (item.action !== "edit") return "";
    return (
      '<div class="shop-handoff__actions">' +
      '<button type="button" class="btn btn-secondary btn-sm" data-handoff-edit="' +
      escapeHtml(item.line_id) +
      '">Edit</button>' +
      (item.reason === "skipped"
        ? ""
        : '<button type="button" class="btn btn-quiet btn-sm" data-handoff-leave="' +
          escapeHtml(item.line_id) +
          '">Leave it off</button>') +
      "</div>"
    );
  }

  function quantityHtml(item) {
    var label = item.quantity_label || "";
    var accessible = item.quantity_accessible || "";
    if (accessible && accessible !== label) {
      return '<span aria-label="' + escapeHtml(accessible) + '">' + escapeHtml(label) + "</span>";
    }
    return escapeHtml(label);
  }

  function sectionsHtml(review) {
    var included = (review.included || [])
      .map(function (item) {
        return (
          "<li class=\"shop-handoff__item\"><span>" +
          escapeHtml(item.display_text) +
          "</span><span>" +
          quantityHtml(item) +
          "</span></li>"
        );
      })
      .join("");
    var staying = (review.staying || [])
      .map(function (item) {
        return (
          '<li class="shop-handoff__stay-item"><div><strong>' +
          escapeHtml(item.display_text) +
          '</strong><span class="shop-handoff__reason">' +
          escapeHtml(item.message) +
          "</span>" +
          itemActions(item) +
          "</div></li>"
        );
      })
      .join("");
    return (
      '<section class="shop-handoff__section" aria-labelledby="shopGoingTitle">' +
      '<h3 id="shopGoingTitle">Going to Instacart</h3>' +
      '<p class="shop-handoff__count">' +
      escapeHtml(String(review.transferable_count || 0)) +
      " to send</p>" +
      '<ul class="shop-handoff__items">' +
      (included || '<li class="meta">Nothing from this list can go on the link yet.</li>') +
      "</ul></section>" +
      '<section class="shop-handoff__section shop-handoff__stay" aria-labelledby="shopStayingTitle">' +
      '<h3 id="shopStayingTitle">Staying on your FlavorWeave list</h3>' +
      '<ul class="shop-handoff__stay-list">' +
      (staying || "<li>Everything open is going.</li>") +
      "</ul></section>"
    );
  }

  function ctaHtml(review) {
    var disabled = !LOGO_SRC || !review.launch_enabled;
    var reason = "The official Instacart logo isn’t in this app yet, so the button stays off.";
    return (
      '<div class="instacart-cta-inset' + (disabled ? " instacart-cta-inset--off" : "") + '">' +
      '<button type="button" class="instacart-cta' + (disabled ? " instacart-cta--off" : "") + '" id="btnShopInstacartCta"' +
      (disabled ? ' disabled aria-describedby="shopCtaOffReason"' : "") +
      ' aria-disabled="' +
      (disabled ? "true" : "false") +
      '">' +
      escapeHtml(CTA_LABEL) +
      (disabled ? '<span class="instacart-cta__state">Off</span>' : "") +
      "</button>" +
      (disabled ? '<p class="instacart-cta__reason" id="shopCtaOffReason">' + reason + "</p>" : "") +
      "</div>" +
      '<p class="meta">You’ll confirm products on Instacart. FlavorWeave won’t swap items for you.</p>' +
      '<p class="meta">Instacart will show what’s at the store you pick. FlavorWeave doesn’t see that stock.</p>'
    );
  }

  function statusHtml(review) {
    var handoff = review.handoff;
    if (!handoff) return "";
    if (handoff.status === "stale") {
      return '<p class="meta" id="shopHandoffStatus">This Instacart link is from an older list. Send it again when you want.</p>';
    }
    if (handoff.status === "expired") {
      return '<p class="meta" id="shopHandoffStatus">This Instacart link has expired. Send it again when you want.</p>';
    }
    if (handoff.status === "failed" || handoff.status === "rejected") {
      return '<div class="shop-handoff__stay" id="shopHandoffStatus"><h3>The link didn’t go through</h3><p class="meta">We couldn’t create the Instacart link. Your list is unchanged.</p></div>';
    }
    if (review.result && review.result.status === "link_created") {
      return '<p class="meta" id="shopHandoffStatus">Your list is still here. Nothing was marked bought.</p>';
    }
    return "";
  }

  function prepareHtml(review) {
    if (!review.can_prepare || review.launch_enabled) return "";
    var label = review.handoff && (review.handoff.status === "stale" || review.handoff.status === "failed" || review.handoff.status === "rejected" || review.handoff.status === "expired")
      ? "Send the list again"
      : "Prepare the test link";
    return (
      '<button type="button" class="btn btn-secondary" id="btnShopPrepare">' +
      label +
      "</button>" +
      '<p class="meta">This is a Preview test. It does not open Instacart, and it does not mark anything bought.</p>'
    );
  }

  function renderReview(root, review) {
    root.innerHTML =
      '<div class="shop-handoff">' +
      '<h2 class="card-title" id="shopOrderTitle">Order online</h2>' +
      (badgeFor(review) || '<p class="meta">Continues on Instacart. They choose the store and the products.</p>') +
      (review.usual_store_note ? '<p class="meta">' + escapeHtml(review.usual_store_note) + "</p>" : "") +
      statusHtml(review) +
      sectionsHtml(review) +
      ctaHtml(review) +
      prepareHtml(review) +
      "</div>";
  }

  function renderFailed(root, review, message) {
    var next = Object.assign({}, review, {
      handoff: { status: "failed" },
      result: null,
    });
    renderReview(root, next);
    var status = root.querySelector("#shopHandoffStatus");
    if (status && message) {
      var copy = status.querySelector(".meta");
      if (copy) copy.textContent = message;
    }
  }

  function wire(root, review, bridge) {
    root.querySelectorAll("[data-handoff-edit]").forEach(function (button) {
      button.addEventListener("click", function () {
        document.getElementById("shopOrderSheet").close();
        if (bridge.openLine) bridge.openLine(button.getAttribute("data-handoff-edit"));
      });
    });
    root.querySelectorAll("[data-handoff-leave]").forEach(function (button) {
      button.addEventListener("click", function () {
        leaveOff(button.getAttribute("data-handoff-leave"), bridge);
      });
    });
    var prepare = root.querySelector("#btnShopPrepare");
    if (prepare) {
      prepare.addEventListener("click", function () {
        send(review, bridge);
      });
    }
    var cta = root.querySelector("#btnShopInstacartCta");
    if (cta && !cta.disabled) {
      cta.addEventListener("click", function () {
        var target = safeLaunchUrl(review.products_link_url);
        if (!target) return;
        try {
          sessionStorage.setItem("fw_handoff_return", "instacart");
        } catch (e) {
          /* private mode */
        }
        window.location.assign(target);
      });
    }
  }

  async function leaveOff(lineId, bridge) {
    var shop = bridge.getShop();
    var list = shop && shop.list;
    if (!list || !bridge.apiPost) return;
    await bridge.apiPost("/api/household-shop", {
      op: "set_state",
      line_id: lineId,
      list_state: "skipped",
      expected_revision: list.revision,
    });
    if (bridge.reload) await bridge.reload();
    openReview(bridge);
  }

  async function openReview(bridge) {
    var root = document.getElementById("shopOrderBody");
    var shop = bridge.getShop();
    var revision = shop && shop.list ? shop.list.revision : null;
    var res = await bridge.apiPost("/api/grocery/review", {
      provider_id: "instacart",
      expected_revision: revision,
    });
    if (!res) {
      renderFailed(root, { included: [], staying: [], transferable_count: 0, launch_enabled: false }, "We couldn’t open the review. Your list is unchanged.");
      return;
    }
    if (res.code === "revision_conflict" && res.review) {
      if (res.list && shop) shop.list = res.list;
      renderReview(root, Object.assign({}, res.review, { can_prepare: false }));
      var banner = document.createElement("p");
      banner.className = "meta";
      banner.textContent = "The list changed. Review it again before sending.";
      root.prepend(banner);
      wire(root, res.review, bridge);
      return;
    }
    if (!res.ok) {
      renderFailed(root, { included: [], staying: [], transferable_count: 0, launch_enabled: false, can_prepare: false }, res.message || "Online ordering is not connected.");
      return;
    }
    renderReview(root, res);
    wire(root, res, bridge);
  }

  async function send(review, bridge) {
    var root = document.getElementById("shopOrderBody");
    var shop = bridge.getShop();
    var res = await bridge.apiPost("/api/grocery/handoff", {
      provider_id: "instacart",
      expected_revision: review.revision,
      reviewed_fingerprint: review.fingerprint,
    });
    if (res && res.code === "revision_conflict") {
      if (res.list && shop) shop.list = res.list;
      await openReview(bridge);
      return;
    }
    if (!res || res.ok === false) {
      renderFailed(root, review, (res && res.message) || "We couldn’t create the Instacart link. Your list is unchanged.");
      wire(root, Object.assign({}, review, { handoff: { status: "failed" }, can_prepare: review.can_prepare }), bridge);
      return;
    }
    var next = Object.assign({}, review, { result: { status: "link_created" }, handoff: { status: "link_created" } });
    renderReview(root, next);
    wire(root, next, bridge);
  }

  async function open(bridge) {
    var sheet = document.getElementById("shopOrderSheet");
    var root = document.getElementById("shopOrderBody");
    renderUnavailable(root, bridge.getShop());
    if (!sheet.open) sheet.showModal();
    var caps = await bridge.apiGet("/api/grocery/capabilities");
    var providers = (caps && caps.providers) || [];
    var instacart = null;
    for (var i = 0; i < providers.length; i += 1) {
      if (providers[i].id === "instacart" && providers[i].configured) instacart = providers[i];
    }
    if (!instacart) {
      renderUnavailable(root, bridge.getShop());
      return;
    }
    renderChoice(root, bridge.getShop(), instacart);
    var pick = document.getElementById("btnShopPickInstacart");
    if (pick) {
      pick.addEventListener("click", async function () {
        if (bridge.apiPost) await bridge.apiPost("/api/grocery/select", { provider_id: "instacart" });
        await openReview(bridge);
      });
    }
  }

  function syncReturnBanner(bridge) {
    var el = document.getElementById("shopReturnBanner");
    if (!el) return;
    var flag = "";
    try {
      flag = sessionStorage.getItem("fw_handoff_return") || "";
    } catch (e) {
      flag = "";
    }
    if (flag !== "instacart") {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.textContent = "Your list is still here.";
    try {
      sessionStorage.removeItem("fw_handoff_return");
    } catch (e2) {
      /* ignore */
    }
    if (bridge && bridge.apiPost) bridge.apiPost("/api/grocery/return", { provider_id: "instacart" });
  }

  window.FlavorWeaveShopHandoff = {
    CTA_LABEL: CTA_LABEL,
    logoPresent: function () {
      return !!LOGO_SRC;
    },
    safeLaunchUrl: safeLaunchUrl,
    renderUnavailable: renderUnavailable,
    renderChoice: renderChoice,
    renderReview: renderReview,
    renderFailed: renderFailed,
    open: open,
    syncReturnBanner: syncReturnBanner,
  };
})();
