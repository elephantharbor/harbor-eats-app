/**
 * Taste UI helpers: onboarding picks, Fine-tune rows, search results, and the
 * optional after-rating extras. Pure string builders and list reducers, so
 * app.js stays the only place that touches the DOM or the network.
 *
 * The term list, ranks, and labels come from /api/tastes/catalog. This file
 * never invents a taste. Confidence never reaches it.
 */
(function (root) {
  var FALLBACK_RANKS = [
    { rank: "love", label: "Love" },
    { rank: "like", label: "Like" },
    { rank: "less_often", label: "Less often" },
  ];
  var MENU_NOTE = "Nothing on the menu has this yet. We’ll keep it in mind as new dinners land.";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function has(list, slug) {
    return (list || []).indexOf(slug) >= 0;
  }

  /** Tap on, tap off. No cap: a diner can love as many things as they like. */
  function togglePick(list, slug) {
    var next = (list || []).slice();
    var i = next.indexOf(slug);
    if (i >= 0) next.splice(i, 1);
    else next.push(slug);
    return next;
  }

  function encouragement(count) {
    if (!count) return "Pick a few to get us started — or skip. Totally fine.";
    if (count === 1) return "Nice start. A couple more helps us aim.";
    if (count === 2) return "Ooh, good taste. Got another one?";
    return "Love it. Add as many as you like.";
  }

  /**
   * What to save when onboarding ends: new picks become Love, and anything
   * un-picked since the last save is removed. Nothing else is touched.
   */
  function onboardingChanges(picked, saved) {
    var changes = [];
    (picked || []).forEach(function (slug) {
      if (!has(saved, slug)) changes.push({ vocabulary_slug: slug, rank: "love" });
    });
    (saved || []).forEach(function (slug) {
      if (!has(picked, slug)) changes.push({ vocabulary_slug: slug, rank: "remove" });
    });
    return changes;
  }

  function findTerm(catalog, slug) {
    if (!catalog) return null;
    var groups = catalog.groups || [];
    for (var g = 0; g < groups.length; g++) {
      var terms = groups[g].terms || [];
      for (var t = 0; t < terms.length; t++) if (terms[t].slug === slug) return terms[t];
    }
    var starters = catalog.starters || [];
    for (var s = 0; s < starters.length; s++) if (starters[s].slug === slug) return starters[s];
    return null;
  }

  function pickChipHtml(term, on) {
    return (
      '<button type="button" class="chip-tog taste-chip' + (on ? " is-on" : "") + '"' +
      ' data-taste-pick="' + esc(term.slug) + '" aria-pressed="' + (on ? "true" : "false") + '">' +
      esc(term.name) +
      "</button>"
    );
  }

  function addChipHtml(term, rank, rankLabel) {
    var on = !!rank;
    var label = on ? term.name + ": " + rankLabel + ". Change it in your list." : "Add " + term.name + " as Like";
    return (
      '<button type="button" class="chip-tog taste-chip' + (on ? " is-on" : "") + '"' +
      ' data-taste-add="' + esc(term.slug) + '" data-rank="like" aria-pressed="' + (on ? "true" : "false") + '"' +
      ' aria-label="' + esc(label) + '">' +
      esc(term.name) +
      "</button>"
    );
  }

  function chipGridHtml(terms, picked) {
    return (terms || [])
      .map(function (term) {
        return pickChipHtml(term, has(picked, term.slug));
      })
      .join("");
  }

  function rankLabelFor(ranks, rank) {
    var list = ranks && ranks.length ? ranks : FALLBACK_RANKS;
    for (var i = 0; i < list.length; i++) if (list[i].rank === rank) return list[i].label;
    return "";
  }

  /**
   * @param {{ title: string, terms: object[] }[]} groups
   * @param {{ mode: "pick"|"add", picked?: string[], ranksBySlug?: object, ranks?: object[], idPrefix: string }} opts
   */
  function browseHtml(groups, opts) {
    var o = opts || {};
    return (groups || [])
      .map(function (group, i) {
        var headingId = o.idPrefix + "-group-" + i;
        var chips = (group.terms || [])
          .map(function (term) {
            if (o.mode === "add") {
              var rank = o.ranksBySlug && o.ranksBySlug[term.slug];
              return addChipHtml(term, rank, rankLabelFor(o.ranks, rank));
            }
            return pickChipHtml(term, has(o.picked, term.slug));
          })
          .join("");
        return (
          '<section class="taste-browse__group" aria-labelledby="' + headingId + '">' +
          '<h3 class="taste-browse__title" id="' + headingId + '">' + esc(group.title) + "</h3>" +
          '<div class="taste-browse__chips" role="group" aria-labelledby="' + headingId + '">' + chips + "</div>" +
          "</section>"
        );
      })
      .join("");
  }

  /**
   * @param {{ status: string, query: string, match: object|null, message: string|null }|null} result
   * @param {{ mode: "pick"|"add", picked?: string[], ranksBySlug?: object, ranks?: object[], explicit?: boolean }} opts
   */
  function searchResultHtml(result, opts) {
    var o = opts || {};
    if (!result || result.status === "empty") return "";
    if (result.status !== "resolved" || !result.match) {
      if (!o.explicit && result.status === "unresolved") return "";
      return '<p class="taste-search__message">' + esc(result.message || "") + "</p>";
    }
    var term = result.match;
    var note = term.on_menu ? "" : '<p class="taste-note">' + esc(MENU_NOTE) + "</p>";
    var group = term.group ? '<span class="taste-result__group">' + esc(term.group) + "</span>" : "";
    if (o.mode === "add") {
      var current = o.ranksBySlug && o.ranksBySlug[term.slug];
      var ranks = o.ranks && o.ranks.length ? o.ranks : FALLBACK_RANKS;
      var buttons = ranks
        .map(function (r) {
          var on = current === r.rank;
          return (
            '<button type="button" class="chip-tog taste-chip' + (on ? " is-on" : "") + '"' +
            ' data-taste-add="' + esc(term.slug) + '" data-rank="' + esc(r.rank) + '" aria-pressed="' + (on ? "true" : "false") + '"' +
            ' aria-label="' + esc(r.label + " " + term.name) + '">' + esc(r.label) + "</button>"
          );
        })
        .join("");
      var already = current
        ? '<p class="taste-result__already">Already in your tastes as ' + esc(rankLabelFor(ranks, current)) + ".</p>"
        : "";
      return (
        '<div class="taste-result">' +
        '<p class="taste-result__name">' + esc(term.name) + group + "</p>" +
        already +
        '<div class="taste-result__ranks" role="group" aria-label="' + esc("How do you feel about " + term.name + "?") + '">' + buttons + "</div>" +
        note +
        "</div>"
      );
    }
    return (
      '<div class="taste-result">' +
      '<p class="taste-result__name">' + esc(term.name) + group + "</p>" +
      '<div class="taste-result__ranks">' + pickChipHtml(term, has(o.picked, term.slug)) + "</div>" +
      note +
      "</div>"
    );
  }

  function rankControlHtml(item, ranks) {
    var list = ranks && ranks.length ? ranks : FALLBACK_RANKS;
    var name = "rank-" + item.slug;
    var checkedRank = item.stance === "explicit" ? item.rank : null;
    var radios = list
      .map(function (r) {
        var checked = checkedRank === r.rank;
        return (
          '<label class="rank-opt rank-opt--' + esc(r.rank) + '">' +
          '<input type="radio" name="' + esc(name) + '" value="' + esc(r.rank) + '" data-taste-rank="' + esc(item.slug) + '"' +
          (checked ? " checked" : "") + " />" +
          "<span>" + esc(r.label) + "</span></label>"
        );
      })
      .join("");
    return (
      '<fieldset class="rank-control">' +
      '<legend class="sr-only">' + esc("How do you feel about " + item.name + "?") + "</legend>" +
      radios +
      "</fieldset>"
    );
  }

  function profileItemHtml(item, ranks) {
    var learning = item.stance === "inferred";
    var badge =
      '<span class="badge badge--sm ' + (learning ? "badge--neutral taste-stance--learning" : "badge--match taste-stance--told") + '">' +
      esc(item.stance_label) +
      "</span>";
    var lines = [];
    if (learning) {
      lines.push(
        '<p class="taste-note">Looks like a ' + esc(item.rank_label) + ". Pick one to confirm, or remove it if we got it wrong.</p>"
      );
    }
    if (item.limit_note) lines.push('<p class="taste-note taste-note--limit">' + esc(item.limit_note) + "</p>");
    if (item.menu_note) lines.push('<p class="taste-note">' + esc(item.menu_note) + "</p>");
    return (
      '<li class="taste-item" data-taste-item="' + esc(item.slug) + '">' +
      '<div class="taste-item__head">' +
      '<p class="taste-item__name">' + esc(item.name) + "</p>" +
      badge +
      "</div>" +
      lines.join("") +
      '<div class="taste-item__controls">' +
      rankControlHtml(item, ranks) +
      '<button type="button" class="btn btn-quiet btn-sm taste-item__remove" data-taste-remove="' + esc(item.slug) + '"' +
      ' aria-label="' + esc("Remove " + item.name + " from your tastes") + '">Remove</button>' +
      "</div>" +
      "</li>"
    );
  }

  function profileListHtml(items, ranks, emptyText) {
    if (!items || !items.length) return '<li class="taste-empty">' + esc(emptyText) + "</li>";
    return items
      .map(function (item) {
        return profileItemHtml(item, ranks);
      })
      .join("");
  }

  function ranksBySlug(profile) {
    var map = {};
    if (!profile) return map;
    (profile.told || []).forEach(function (item) {
      map[item.slug] = item.rank;
    });
    return map;
  }

  /**
   * Optimistic local edit while the server confirms. Choosing a rank always
   * makes the row explicit; remove drops it.
   */
  function applyLocal(profile, slug, rank, term, ranks) {
    var base = profile || { told: [], learning: [] };
    var told = (base.told || []).filter(function (i) { return i.slug !== slug; });
    var learning = (base.learning || []).filter(function (i) { return i.slug !== slug; });
    if (rank !== "remove" && term) {
      var prior = (base.told || []).concat(base.learning || []).find(function (i) { return i.slug === slug; }) || {};
      told.push({
        slug: slug,
        name: term.name,
        category: term.category,
        group: term.group,
        on_menu: term.on_menu,
        rank: rank,
        rank_label: rankLabelFor(ranks, rank),
        stance: "explicit",
        stance_label: "You told us",
        editable: true,
        limit_note: prior.limit_note || null,
        menu_note: !term.on_menu && rank !== "less_often" && !prior.limit_note ? MENU_NOTE : null,
      });
    }
    var order = { love: 0, like: 1, less_often: 2 };
    told.sort(function (a, b) { return order[a.rank] - order[b.rank] || a.name.localeCompare(b.name); });
    return Object.assign({}, base, { told: told, learning: learning });
  }

  /**
   * Optional chips after one diner's own rating. Not a survey.
   * @param {{ code: string, label: string }[]} feedback
   * @param {string[]} sent codes already sent for this meal
   * @param {string} idSuffix
   */
  function feedbackHtml(feedback, sent, idSuffix) {
    if (!feedback || !feedback.length) return "";
    var labelId = "taste-fb-" + idSuffix;
    var chips = feedback
      .map(function (f) {
        var on = has(sent, f.code);
        return (
          '<button type="button" class="chip-tog taste-chip taste-chip--sm' + (on ? " is-on" : "") + '"' +
          ' data-feedback-code="' + esc(f.code) + '" aria-pressed="' + (on ? "true" : "false") + '">' + esc(f.label) + "</button>"
        );
      })
      .join("");
    return (
      '<div class="taste-feedback">' +
      '<p class="taste-feedback__label" id="' + labelId + '">Anything stand out? <span class="taste-feedback__optional">Optional</span></p>' +
      '<div class="taste-feedback__chips" role="group" aria-labelledby="' + labelId + '">' + chips + "</div>" +
      "</div>"
    );
  }

  root.FlavorWeaveTaste = {
    MENU_NOTE: MENU_NOTE,
    FALLBACK_RANKS: FALLBACK_RANKS,
    esc: esc,
    togglePick: togglePick,
    encouragement: encouragement,
    onboardingChanges: onboardingChanges,
    findTerm: findTerm,
    pickChipHtml: pickChipHtml,
    chipGridHtml: chipGridHtml,
    browseHtml: browseHtml,
    searchResultHtml: searchResultHtml,
    rankControlHtml: rankControlHtml,
    profileItemHtml: profileItemHtml,
    profileListHtml: profileListHtml,
    ranksBySlug: ranksBySlug,
    rankLabelFor: rankLabelFor,
    applyLocal: applyLocal,
    feedbackHtml: feedbackHtml,
  };
})(typeof window !== "undefined" ? window : globalThis);
