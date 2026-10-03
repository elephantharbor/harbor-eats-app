/** Cycle 3 onboarding ends on Home; legacy three-pick rounds are seeded for e2e when Tonight has no plan. */
/** @param {import('@playwright/test').Page} page */
export async function openTonightTab(page) {
  const heading = page.getByRole("heading", { name: /Which should we make\?|What are we cooking tonight\?/ });
  if (!(await heading.isVisible().catch(() => false))) {
    await page
      .locator('[data-go="choices"][data-nav="choices"]')
      .filter({ visible: true })
      .first()
      .click();
  }
  await heading.waitFor({ timeout: 30000 });
}

/** Legacy /api/recommendations/plan picks for e2e (Cycle 3B no-plan Tonight does not auto-fetch). */
/** @param {import('@playwright/test').Page} page */
export async function ensureLegacyTonightPicks(page) {
  const hasCards = await page
    .locator(".option-card[data-preview]")
    .first()
    .isVisible()
    .catch(() => false);
  if (hasCards) return;

  const retry = page.getByRole("button", { name: "Try again" });
  if (await retry.isVisible({ timeout: 2000 }).catch(() => false)) {
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes("/api/recommendations/plan") && res.ok(),
        { timeout: 60000 }
      ),
      retry.click(),
    ]);
    return;
  }

  await page.evaluate(async () => {
    const me = await fetch("/api/sessions/me", { credentials: "same-origin" }).then((r) => r.json());
    const hh = me.session?.household_id || me.household_id;
    if (!hh) throw new Error("no household for legacy plan seed");
    const res = await fetch("/api/recommendations/plan", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        household_id: hh,
        attribution_kind: "organic",
        attribution_last_touch: "organic",
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) {
      throw new Error("recommendations/plan failed: " + JSON.stringify(body));
    }
  });
  await page.goto("/");
  await page.locator(".view.is-active").first().waitFor({ timeout: 30000 });
  await openTonightTab(page);
}

/** @param {import('@playwright/test').Page} page */
export async function reachTonightChoices(page) {
  await openTonightTab(page);
  await ensureLegacyTonightPicks(page);
  await page.locator(".option-card[data-preview]").first().waitFor({ timeout: 30000 });
}

/** @param {import('@playwright/test').Page} page */
export async function skipToChoices(page) {
  await page.getByRole("button", { name: "Get started" }).click();
  await page.locator("#hhName").fill("E2E Kitchen");
  await page.locator("#ownerName").fill("Alex");
  await page.locator("#btnCreateHh").click();
  await page.locator("#newMemberName").fill("Partner");
  await page.getByRole("button", { name: "Add person" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.getByRole("button", { name: "Skip — show tonight’s picks" }).click();
  await reachTonightChoices(page);
}

/** @param {import('@playwright/test').APIRequestContext} request */
export async function apiCreateHousehold(request, name) {
  const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8787";
  const member_id = `owner-${Date.now().toString(36)}`;
  const hh = await request.post(`${base}/api/households`, {
    data: { display_name: name },
  });
  const body = await hh.json();
  const household_id = body.household_id;
  await request.post(`${base}/api/households/${household_id}/members`, {
    data: { member_id, display_name: "Owner", role: "owner", status: "active" },
  });
  const sess = await request.post(`${base}/api/sessions`, {
    data: { household_id, member_id },
  });
  const setCookie = sess.headers()["set-cookie"] || "";
  const tokenMatch = /he_session=([^;]+)/.exec(setCookie);
  const sessionToken = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
  const cookieHeader = sessionToken
    ? { Cookie: `he_session=${encodeURIComponent(sessionToken)}` }
    : {};
  await request.post(`${base}/api/members/${member_id}/constraints`, {
    headers: cookieHeader,
    data: { household_id, keys: ["dairy"] },
  });
  return {
    household_id,
    memberId: member_id,
    sessionToken,
    cookieHeader,
  };
}
