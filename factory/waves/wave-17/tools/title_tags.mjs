// Prints the app's title-word allergen tags for each title on stdin (JSON array of strings).
// Uses harbor-eats-app/src/lib/eligibility.js optionTags with no stored tags, so only the title matcher runs.
import { optionTags } from "/workspace/harbor-eats-app/src/lib/eligibility.js";
let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  const titles = JSON.parse(input);
  const out = {};
  for (const t of titles) out[t] = optionTags({ name: t, tags: [] });
  process.stdout.write(JSON.stringify(out));
});
