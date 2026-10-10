#!/usr/bin/env node
/**
 * Live D-06 eval (NEVER run in CI). Bounded spend via --max-usd.
 * Usage: npm run eval:d06:live -- --url <preview> --max-usd 0.05
 */
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    url: { type: "string" },
    "max-usd": { type: "string", default: "0.05" },
  },
});

const base = values.url;
if (!base) {
  console.error("Missing --url");
  process.exit(2);
}
const cap = Number(values["max-usd"] || "0.05");
let spent = 0;
const samples = [
  { path: "/api/plan/interpret", body: { schema_version: 1, text: "Plan three easy dinners this week.", state: null } },
  { path: "/api/discovery/interpret", body: { schema_version: 1, text: "Something cozy but not too heavy", state: null, mode: "standalone" } },
];

for (const sample of samples) {
  if (spent >= cap) break;
  const res = await fetch(`${base.replace(/\/$/, "")}${sample.path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sample.body),
  });
  const data = await res.json();
  const rowCost = Number(data.estimated_cost_usd || data.cost_usd || 0);
  spent += rowCost;
  console.log(JSON.stringify({ path: sample.path, ok: data.ok, source: data.source, spent }));
}
console.log(JSON.stringify({ spent_usd: spent, cap_usd: cap }));
