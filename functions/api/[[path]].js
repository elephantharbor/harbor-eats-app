/**
 * Pages Function: same-origin /api/* on harbor-eats-app.pages.dev
 * Reuses Worker handler + D1 binding (DB) from wrangler.pages.toml.
 */
import worker from "../../src/index.js";

export async function onRequest(context) {
  return worker.fetch(context.request, context.env, context);
}
