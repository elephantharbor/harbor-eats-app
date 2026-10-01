// @ts-check
import { test, expect } from "@playwright/test";
import { apiCreateHousehold } from "./helpers.js";

async function addMember(request, household_id, cookieHeader, display_name) {
  const member_id = `${display_name.toLowerCase()}-${Date.now().toString(36)}`;
  const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8787";
  await request.post(`${base}/api/households/${household_id}/members`, {
    data: { member_id, display_name, role: "member", status: "active" },
  });
  const sess = await request.post(`${base}/api/sessions`, {
    data: { household_id, member_id },
  });
  const setCookie = sess.headers()["set-cookie"] || "";
  const tokenMatch = /he_session=([^;]+)/.exec(setCookie);
  const sessionToken = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
  return {
    member_id,
    cookieHeader: sessionToken
      ? { Cookie: `he_session=${encodeURIComponent(sessionToken)}` }
      : cookieHeader,
  };
}

test("three-diner API path: votes, recipe servings, partial then full ratings", async ({
  request,
}) => {
  const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8787";
  const { household_id, memberId, cookieHeader } = await apiCreateHousehold(
    request,
    "Three Diner Kitchen"
  );
  const m2 = await addMember(request, household_id, cookieHeader, "Alex");
  const m3 = await addMember(request, household_id, cookieHeader, "Sam");

  const planRes = await request.post(`${base}/api/recommendations/plan`, {
    headers: m2.cookieHeader,
    data: { household_id, attribution_last_touch: "organic" },
  });
  const planBody = await planRes.json();
  expect(planBody.ok).toBe(true);
  const plan_id = planBody.plan_id;
  const optionA = planBody.meal_options[0].meal_option_id;
  const slug = planBody.meal_options[0].recipe_slug;

  let lastVoteBody = null;
  for (const ctx of [cookieHeader, m2.cookieHeader, m3.cookieHeader]) {
    const vote = await request.post(`${base}/api/plans/${plan_id}/votes`, {
      headers: ctx,
      data: { meal_option_id: optionA, auto_resolve: true },
    });
    lastVoteBody = await vote.json();
    expect(lastVoteBody.ok).toBe(true);
  }
  expect(lastVoteBody.status).toBe("Selected");
  expect(lastVoteBody.meal_option_id).toBe(optionA);

  const recipe = await request.get(`${base}/api/recipes/${slug}?servings=3`);
  const recipeBody = await recipe.json();
  expect(recipeBody.ok).toBe(true);
  expect(recipeBody.recipe.servings).toBe(3);
  expect(recipeBody.recipe.requested_servings).toBe(3);

  await request.post(`${base}/api/cooks`, {
    headers: cookieHeader,
    data: {
      plan_id,
      meal_option_id: optionA,
      household_id,
      source: "app",
      actor_member_id: memberId,
    },
  });

  await request.post(`${base}/api/ratings`, {
    headers: cookieHeader,
    data: {
      plan_id,
      meal_option_id: optionA,
      household_id,
      member_id: memberId,
      score: 8,
      source: "app",
    },
  });

  const snapPartial = await request.get(`${base}/api/sessions/me`, {
    headers: cookieHeader,
  });
  const partial = await snapPartial.json();
  expect(partial.rating_state).toBe("partial");
  expect(partial.cml_complete).not.toBe(true);

  await request.post(`${base}/api/ratings`, {
    headers: m2.cookieHeader,
    data: {
      plan_id,
      meal_option_id: optionA,
      household_id,
      member_id: m2.member_id,
      score: 9,
      source: "app",
    },
  });
  await request.post(`${base}/api/ratings`, {
    headers: m3.cookieHeader,
    data: {
      plan_id,
      meal_option_id: optionA,
      household_id,
      member_id: m3.member_id,
      score: 7,
      source: "app",
    },
  });

  const snapFull = await request.get(`${base}/api/sessions/me`, {
    headers: m3.cookieHeader,
  });
  const full = await snapFull.json();
  expect(full.rating_state).toBe("full");
  expect(full.lifecycle).toBe("Rated");
});

test("four-diner recipe scales to serves 4", async ({ request }) => {
  const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8787";
  const { household_id, cookieHeader } = await apiCreateHousehold(request, "Four Diner");
  await addMember(request, household_id, cookieHeader, "B");
  await addMember(request, household_id, cookieHeader, "C");
  await addMember(request, household_id, cookieHeader, "D");

  const recipe = await request.get(
    `${base}/api/recipes/crispy-chipotle-tofu-tacos?servings=4`
  );
  const body = await recipe.json();
  expect(body.recipe.servings).toBe(4);
  expect(body.recipe.base_servings).toBe(4);
});
