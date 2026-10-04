/**
 * Catalog publication. These names are the product states.
 * Certified is not on the normal menu until a version is Published.
 * Unpublished and invalid remain so an older package can be refused
 * without calling that failure QA Failed.
 */

export const CATALOG_PUBLICATION_STATES = Object.freeze([
  "draft",
  "qa_failed",
  "certified",
  "published",
  "retired",
  "unpublished",
  "invalid",
]);

export const CATALOG_PUBLICATION_LABELS = Object.freeze({
  draft: "Draft",
  qa_failed: "QA Failed",
  certified: "Certified",
  published: "Published",
  retired: "Retired",
  unpublished: "Unpublished",
  invalid: "Invalid",
});

/**
 * Normal recommendations, the planner, recipe detail, cooking, and shopping
 * read Published global versions only.
 * @param {{ publication_status?: string, visibility?: string, household_id?: string|null }} row
 */
export function isNormallyRecommendable(row) {
  if (!row) return false;
  if (row.publication_status !== "published") return false;
  if (row.visibility !== "global") return false;
  if (row.household_id) return false;
  return true;
}
