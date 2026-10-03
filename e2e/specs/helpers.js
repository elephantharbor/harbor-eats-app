/** Cycle 3 onboarding ends on Home; legacy picks live under Tonight. */
/** @param {import('@playwright/test').Page} page */
export async function reachTonightChoices(page) {
  const heading = page.getByRole("heading", { name: "Which should we make?" });
  if (!(await heading.isVisible().catch(() => false))) {
    await page
      .locator('[data-go="choices"][data-nav="choices"]')
      .filter({ visible: true })
      .first()
      .click();
  }
  await heading.waitFor({ timeout: 30000 });
  const retry = page.getByRole("button", { name: "Try again" });
  if (await retry.isVisible({ timeout: 3000 }).catch(() => false)) {
    await retry.click();
  }
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
