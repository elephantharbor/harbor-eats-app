/**
 * Serialization fixtures for DiscoveryQuery.
 * Round-trip tests load these. The objects are the contract.
 */

import { emptyQuery } from "./query.js";

export const EMPTY_QUERY_FIXTURE = Object.freeze({
  name: "empty",
  input: {},
  query: emptyQuery(),
  search: "schema=1&limit=20&offset=0",
});

export const EXPLICIT_EASY_FIXTURE = Object.freeze({
  name: "explicit-easy-not-quick",
  input: {
    schema_version: 1,
    text: "  Lemon   Herb ",
    criteria: {
      effort_levels: ["Easy", "easy"],
      quick: false,
      cuisines: ["american"],
    },
    soft: { keep_it_easy: false, keep_ingredients_simple: true },
    limit: 10,
    offset: 0,
  },
  search: "schema=1&text=lemon+herb&cuisine=american%2Camerican-inspired&effort=easy&keep_it_easy=0&keep_ingredients_simple=1&limit=10&offset=0",
});

export const QUICK_NOT_EASY_FIXTURE = Object.freeze({
  name: "quick-not-easy",
  input: {
    text: "tacos",
    criteria: { quick: true, max_minutes: 25 },
  },
  search: "schema=1&text=tacos&max_minutes=25&quick=1&limit=20&offset=0",
});
