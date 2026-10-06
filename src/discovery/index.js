/**
 * D-07 Catalog Discovery contracts.
 * UI work imports this module. Ranking stays in runDiscoveryPipeline.
 */

export {
  COMPLEXITY_FILTERS,
  DIET_FILTERS,
  DISCOVERY_DEFAULT_LIMIT,
  DISCOVERY_MAX_LIMIT,
  DISCOVERY_MODES,
  DISCOVERY_SCHEMA_VERSION,
  DISCOVERY_TASTE_BAND,
  EFFORT_FILTERS,
  EXCLUSION_CODES,
  PIPELINE_STAGES,
  PRIMARY_REASON_PRIORITY,
  PROTEIN_GROUP_FILTERS,
  QUICK_MAX_MINUTES,
  RANK_REASON_CODES,
  TEXTURE_FILTERS,
} from "./constants.js";

export {
  emptyNightCount,
  normalizeClientContext,
  publicContext,
  resolveDiscoveryContext,
  selectionFor,
} from "./context.js";

export { matchExplicitCriteria } from "./criteria.js";
export { EMPTY_QUERY_FIXTURE, EXPLICIT_EASY_FIXTURE, QUICK_NOT_EASY_FIXTURE } from "./fixtures.js";
export { parseDiscoveryHttp, routeDiscoveryRequest } from "./http.js";
export { matchMealText, tokenize } from "./match.js";
export { discoveryMeal, projectDiscoveryMeal, proteinGroupsFromSignals } from "./meal.js";
export { applyNoveltyDiversityRecency } from "./novelty.js";
export { interpretFreeText, NLP_BINDING_RULES, NLP_OWNERS } from "./nlp.js";
export {
  eligibleByServer,
  presentResult,
  runDiscoveryPipeline,
  stageContext,
  stageExplicitCriteria,
  stageHardEligibility,
  stageNovelty,
  stageResults,
  stageSoftPrefs,
  stageTasteRanking,
  stageTextMatch,
} from "./pipeline.js";
export {
  canonicalQuery,
  emptyQuery,
  expandCuisineTokens,
  expandDietTokens,
  normalizeQuery,
  parseQuery,
  serializeQueryString,
  validateQuery,
} from "./query.js";
export {
  DISCOVERY_SHELVES,
  SHELF_MIN_TOTAL,
  apiSearchQueryString,
  browserDiscoverySearch,
  defaultBrowseQuery,
  emptyStateKind,
  findPathFromState,
  queryHasActiveCriteria,
  relaxRemoveChips,
  shelfDisplaySubtitle,
  shelfDisplayTitle,
  tasteReasonLine,
} from "./client-ui.js";
export { reasonCodesFor } from "./reasons.js";
export { softPreferenceFor } from "./soft-prefs.js";
export { scoreDiscoveryTaste } from "./taste.js";
