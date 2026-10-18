/** Category C: consumer-assisted compatible applications. NOT integrations. */
export const CONSUMER_COMPATIBLE_APPS = Object.freeze([
  { id: "instacart_shopping_list", operator: "instacart", display_name: "Instacart Shopping List",
    inputs: [
      { method: "paste_text", platforms: ["ios"], max_items: 200,
        source_url: "https://www.instacart.com/help/section/2893565984", last_verified: "2026-10-18", evidence: "documented" },
      { method: "photo", platforms: ["ios"],
        source_url: "https://www.instacart.com/help/section/2893565984", last_verified: "2026-10-18", evidence: "documented" } ],
    retailers: ["schnucks", "dierbergs"], cart: "add_all_to_cart", human_test: null },
  { id: "instacart_clementine", operator: "instacart", display_name: "Instacart Clementine",
    inputs: [ { method: "assistant_image_upload", platforms: ["app", "web"], availability: "not_all_accounts",
      source_url: "https://www.instacart.com/help/section/809794019/603436865", last_verified: "2026-10-18", evidence: "documented" } ],
    retailers: ["schnucks", "dierbergs"], cart: "assistant_add_to_cart", human_test: null },
  { id: "schnucks_ai_assistant", operator: "schnucks", display_name: "Schnucks AI assistant",
    inputs: [ { method: "assistant_file_or_photo_upload", platforms: ["web", "app"], account: "schnucks_rewards", terms: true,
      source_url: "https://schnucks.com/ask-schnucks", last_verified: "2026-10-18", evidence: "documented" } ],
    retailers: ["schnucks"], cart: "user_selects_then_adds", human_test: null },
  { id: "amazon_alexa_for_shopping", operator: "amazon", display_name: "Alexa for Shopping",
    inputs: [ { method: "assistant_image_upload", platforms: ["app", "web"], note: "handwritten list documented; Whole Foods cart routing unverified",
      source_url: "https://www.aboutamazon.com/news/retail/how-to-use-amazon-shopping-ai-assistant", last_verified: "2026-10-18", evidence: "documented" } ],
    retailers: ["amazon"], cart: "amazon_cart", human_test: null },
  { id: "anylist", operator: "anylist", display_name: "AnyList",
    inputs: [ { method: "paste_text", platforms: ["ios", "android", "web", "mac"], note: "quantity parsing unverified",
      source_url: "https://help.anylist.com/articles/paste-items/", last_verified: "2026-10-18", evidence: "documented" } ],
    retailers: [], cart: "none", human_test: null },
]);

/** Facts a consumer app may later be named for. None are human-tested today. */
export function compatibleAppFacts(app) {
  if (!app) return [];
  return app.inputs || [];
}
