/**
 * S-08 doneness revisions. Twelve factory v1 packages gain a v2 whose only
 * culinary change is the safe-cooking instruction, the matching minutes, and
 * a labeled optional note where the dish is traditionally served less done.
 * v1.json is not edited. kitchen_tested stays false. culinary_reviewed is not set.
 *
 *   node scripts/s08-doneness-revisions.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeFactoryPackage } from "../src/lib/catalog-import.js";
import { assessCulinaryQuality } from "../src/lib/culinary-quality.js";

const root = join(process.cwd(), "catalog");

function optionalNote(traditional) {
  return (
    `Optional traditional preparation: ${traditional}. That lower temperature does not meet the USDA/FDA recommendation ` +
    `and carries higher risk, especially for young children, pregnant people, older adults, and anyone immunocompromised.`
  );
}

function replaceOnce(text, from, to, label) {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 occurrence, found ${count}`);
  return text.replace(from, to);
}

function stepByTitle(pkg, title) {
  const step = pkg.recipe_version.steps.find((row) => row.title === title);
  if (!step) throw new Error(`missing step ${title} on ${pkg.dish.slug}`);
  return step;
}

function setTimes(pkg, cook, total) {
  const version = pkg.recipe_version;
  version.cook_minutes = cook;
  version.total_minutes = total;
  if (version.prep_minutes + cook !== total) {
    throw new Error(`${pkg.dish.slug}: ${version.prep_minutes}+${cook}!=${total}`);
  }
}

function assertClock(pkg) {
  const steps = pkg.recipe_version.steps;
  if (!steps.some((step) => step.clock_phase)) return;
  const sum = (phase) =>
    steps.filter((step) => step.clock_phase === phase).reduce((total, step) => total + step.clock_minutes, 0);
  const version = pkg.recipe_version;
  if (sum("prep") !== version.prep_minutes) {
    throw new Error(`${pkg.dish.slug}: prep clock ${sum("prep")} != ${version.prep_minutes}`);
  }
  if (sum("cook") !== version.cook_minutes) {
    throw new Error(`${pkg.dish.slug}: cook clock ${sum("cook")} != ${version.cook_minutes}`);
  }
}

function writeDoneness(slug, mutate) {
  const pkg = JSON.parse(readFileSync(join(root, slug, "v1.json"), "utf8"));
  const id = `rv_${slug}_v2`;
  pkg.dish.current_version_id = id;
  pkg.recipe_version.recipe_version_id = id;
  pkg.recipe_version.version_number = 2;
  pkg.recipe_version.supersedes_recipe_version_id = `rv_${slug}_v1`;
  pkg.package_revision = "s08-doneness";
  pkg.recipe_version.package_revision = "s08-doneness";
  if (pkg.recipe_version.culinary_hash) delete pkg.recipe_version.culinary_hash;
  pkg.recipe_version.culinary_hash_basis =
    "S-08 removed the v1 culinary hash because the doneness instruction changed. catalog-import.js computes the import content hash.";
  pkg.recipe_version.immutability_note =
    "v2 supersedes v1. Doneness instruction only. kitchen_tested is false. Not a household rating.";
  pkg.evidence = {
    doneness_reviewed: "s08-2026-10-18",
    kitchen_tested: false,
    household_rated: false,
    note: "The primary instruction is the USDA/FDA safe minimum. Where the dish is traditionally served less done, that doneness is a labeled optional note and is not the instruction. This is not a kitchen test and not a household rating.",
  };
  pkg.kitchen_tested = false;
  mutate(pkg);
  assertClock(pkg);
  const source = {
    source_path: `catalog/${slug}/v2.json`,
    freeze_integrity: "not_in_package",
    readme_declares_not_certified: true,
  };
  const normalized = normalizeFactoryPackage(pkg, source, { publicationStatus: "published" });
  if (!normalized.ok) {
    throw new Error(`${slug} normalize: ${JSON.stringify(normalized.errors)}`);
  }
  const culinary = assessCulinaryQuality(pkg);
  const unsafe = culinary.fails.filter((item) => item.code === "unsafe_temperature");
  if (unsafe.length || culinary.fails.some((item) => item.code !== "salt_type")) {
    throw new Error(`${slug} culinary: ${JSON.stringify(culinary)}`);
  }
  if (pkg.evidence.culinary_reviewed) throw new Error(`${slug} must not set culinary_reviewed`);
  writeFileSync(join(root, slug, "v2.json"), `${JSON.stringify(pkg, null, 2)}\n`);
  return pkg.recipe_version.recipe_version_id;
}

const ids = [];

ids.push(
  writeDoneness("ethiopian-beef-tibs", (pkg) => {
    const version = pkg.recipe_version;
    version.doneness = `Beef cubes browned outside and cooked to 145 F in the center, then a 3-minute rest (USDA whole-muscle beef). Onions soft and brick-red with berbere. Tomato melted into the base. Not a long braise. ${optionalNote("medium cubes, about 135 F to 140 F")} kitchen_tested is false.`;
    const step = stepByTitle(pkg, "Finish tibs and plate");
    step.body = replaceOnce(
      step.body,
      "Return the seared beef and any plate juices to the skillet. Toss over medium-high heat until the beef is coated and cooked to medium (about 135–140 F for cubes), about 2 to 3 minutes.",
      `Return the seared beef and any plate juices to the skillet. Toss over medium-high heat until the beef is coated and cooked to 145 F in the center, about 3 to 4 minutes, then rest 3 minutes off the heat. ${optionalNote("medium cubes, about 135 F to 140 F")}`,
      "tibs finish"
    );
    setTimes(pkg, 29, 44);
  })
);

ids.push(
  writeDoneness("gochujang-grilled-flank-steak", (pkg) => {
    pkg.recipe_version.doneness = `145 F in the center, then a 5-minute rest (USDA whole-muscle beef). Slice against the grain. ${optionalNote("medium-rare, 130 F to 135 F")}`;
    const step = stepByTitle(pkg, "Grill");
    step.body = replaceOnce(
      step.body,
      "Cook 4 to 5 minutes per side. It is done at 130–135°F in the thickest center for medium-rare.",
      `Cook 5 to 6 minutes per side. It is done at 145 F in the thickest center. ${optionalNote("medium-rare, 130 F to 135 F")}`,
      "flank grill"
    );
    setTimes(pkg, 27, 52);
  })
);

ids.push(
  writeDoneness("grilled-swordfish-olive-caper", (pkg) => {
    pkg.recipe_version.doneness = `Pull swordfish at 145 F in the center, then rest 3 minutes (FDA finfish). The flesh should be opaque and flake under pressure, not chalky. ${optionalNote("a center just losing translucence, 130 F to 135 F")} kitchen_tested is false.`;
    const step = stepByTitle(pkg, "Grill the swordfish");
    step.body = replaceOnce(
      step.body,
      "Lay the swordfish steak on the grates. Cook 4 minutes on the first side without moving it, then flip. Cook 3 to 4 minutes on the second side. Pull it at 130-135 F in the center. Do not press the fish. If a steak is thicker than 1 1/4 inches, add about 1 minute per side and trust the thermometer. For 145 F, add about 1 minute per side and expect a drier steak.",
      `Lay the swordfish steak on the grates. Cook 5 minutes on the first side without moving it, then flip. Cook 4 to 5 minutes on the second side. Pull it at 145 F in the center. Do not press the fish. If a steak is thicker than 1 1/4 inches, add about 1 minute per side and trust the thermometer. ${optionalNote("pulling at 130 F to 135 F, about 4 minutes then 3 to 4 minutes")}`,
      "swordfish grill"
    );
    setTimes(pkg, 30, 48);
  })
);

ids.push(
  writeDoneness("malaysian-curry-laksa", (pkg) => {
    const version = pkg.recipe_version;
    version.doneness = `Paste dark and fragrant with oil separating; broth creamy and orange-red; shrimp pink, opaque, and firm (FDA shellfish: cook until the flesh is opaque and firm). ${optionalNote("shrimp that are pink and still translucent in the center, about 120 F to 125 F")}`;
    const step = stepByTitle(pkg, "Poach the shrimp");
    step.body = replaceOnce(
      step.body,
      "Add the shrimp to the broth and simmer gently until pink and just opaque, 2 to 3 minutes.",
      `Add the shrimp to the broth and simmer gently until pink, opaque, and firm, 3 to 4 minutes. ${optionalNote("shrimp that are still translucent in the center, about 120 F to 125 F")}`,
      "laksa shrimp"
    );
    step.clock_minutes = 4;
    version.time_clock = replaceOnce(
      version.time_clock,
      "Prep 25 + cook 28 = 53",
      "Prep 25 + cook 29 = 54",
      "laksa clock"
    );
    setTimes(pkg, 29, 54);
  })
);

ids.push(
  writeDoneness("nigerian-beef-suya-skewers", (pkg) => {
    const version = pkg.recipe_version;
    version.doneness = `Beef charred at the edges and cooked to 145 F in thicker pieces, then a 3-minute rest (USDA whole-muscle beef). Rice tender with no liquid left. ${optionalNote("at least medium, about 140 F")}`;
    const step = stepByTitle(pkg, "Grill the suya");
    step.body = replaceOnce(
      step.body,
      "Grill the skewers over high heat, turning once, until charred at the edges and cooked to at least medium, 3 to 4 minutes per side. Sprinkle with the remaining yaji.",
      `Grill the skewers over high heat, turning once, until charred at the edges and 145 F in the thicker pieces, 4 to 5 minutes per side, then rest 3 minutes. Sprinkle with the remaining yaji. ${optionalNote("at least medium, about 140 F")}`,
      "suya grill"
    );
    step.clock_minutes = 13;
    version.time_clock = replaceOnce(
      version.time_clock,
      "Prep 20 + cook 36 = 56",
      "Prep 20 + cook 41 = 61",
      "suya clock"
    );
    setTimes(pkg, 41, 61);
  })
);

ids.push(
  writeDoneness("pan-seared-halibut-lemon-butter-corn", (pkg) => {
    const version = pkg.recipe_version;
    version.doneness = `Halibut golden on one side, opaque, and 145 F in the center (FDA finfish). Corn bright and lightly browned. ${optionalNote("just opaque at 130 F to 135 F")}`;
    const step = stepByTitle(pkg, "Baste with lemon butter");
    step.body = replaceOnce(
      step.body,
      "Lower to medium, add the butter and garlic, and spoon the foaming butter over the fish until just opaque at the center (130 to 135 F), 3 minutes. Add the lemon juice.",
      `Lower to medium, add the butter and garlic, and spoon the foaming butter over the fish until opaque at the center and 145 F, 4 minutes. Add the lemon juice. ${optionalNote("just opaque at 130 F to 135 F after about 3 minutes")}`,
      "halibut baste"
    );
    step.clock_minutes = 5;
    version.time_clock = replaceOnce(
      version.time_clock,
      "Prep 8 + cook 17 = 25",
      "Prep 8 + cook 18 = 26",
      "halibut clock"
    );
    setTimes(pkg, 18, 26);
  })
);

ids.push(
  writeDoneness("roasted-whole-branzino-salmoriglio", (pkg) => {
    const version = pkg.recipe_version;
    version.doneness = `Fish flesh opaque and lifting easily from the backbone, 145 F at the thickest point (FDA finfish); skin crisp at the edges. Potatoes golden and tender. ${optionalNote("135 F to 140 F at the thickest point")}`;
    const step = stepByTitle(pkg, "Roast the fish");
    step.body = replaceOnce(
      step.body,
      "Flip the potatoes, lay the fish on top, and roast 15 to 18 minutes, until the flesh is opaque at the backbone (135 to 140 F) and the potatoes are golden.",
      `Flip the potatoes, lay the fish on top, and roast 18 to 22 minutes, until the flesh is opaque at the backbone and 145 F at the thickest point and the potatoes are golden. ${optionalNote("135 F to 140 F at the thickest point")}`,
      "branzino roast"
    );
    step.clock_minutes = 22;
    version.time_clock = replaceOnce(
      version.time_clock,
      "Prep 15 + cook 45 = 60",
      "Prep 15 + cook 49 = 64",
      "branzino clock"
    );
    setTimes(pkg, 49, 64);
  })
);

ids.push(
  writeDoneness("salade-nicoise-seared-tuna", (pkg) => {
    const version = pkg.recipe_version;
    version.doneness = `Potatoes knife-tender; eggs jammy (7 minutes from cold); beans bright green and crisp-tender; tuna seared on the outside and cooked to 145 F in the center (FDA finfish). ${optionalNote("a deep-red rare center, about 115 F")} kitchen_tested is false.`;
    const step = stepByTitle(pkg, "Sear the tuna");
    step.body = replaceOnce(
      step.body,
      "Lay the steaks in the shimmering skillet and do not move them: 1 1/2 to 2 minutes per side for a rare, deep-red center with a thin cooked band (about 115 F inside), or 3 minutes per side to cook through (145 F). Briefly sear the edges with tongs. Move to a cutting board. About 4 minutes.",
      `Lay the steaks in the shimmering skillet and do not move them: 3 minutes per side until the center reaches 145 F. Briefly sear the edges with tongs. Move to a cutting board. About 7 minutes. ${optionalNote("a rare, deep-red center, about 115 F, for 1 1/2 to 2 minutes per side")}`,
      "nicoise sear"
    );
    version.time_clock = replaceOnce(
      version.time_clock,
      "Cook 29 = 13 potatoes with eggs added at minute 6 + 3 green beans (skillet heats at the same time) + 4 sear + 4 rest/peel + 5 slice and compose.",
      "Cook 32 = 13 potatoes with eggs added at minute 6 + 3 green beans (skillet heats at the same time) + 7 sear + 4 rest/peel + 5 slice and compose.",
      "nicoise clock"
    );
    setTimes(pkg, 32, 47);
  })
);

ids.push(
  writeDoneness("seared-duck-breast-cherry", (pkg) => {
    const version = pkg.recipe_version;
    version.doneness = `Skin crisp and golden, interior 165 F (USDA poultry), then a 5-minute rest. Sauce syrupy enough to coat a spoon. ${optionalNote("a rosy interior, about 135 F")}`;
    const sear = stepByTitle(pkg, "Sear the skin");
    sear.body = replaceOnce(
      sear.body,
      "Flip and sear the flesh side about 3 minutes, to 135 F. Rest the duck on a plate for 5 minutes.",
      `Flip and sear the flesh side about 7 minutes, to 165 F. Rest the duck on a plate for 5 minutes. ${optionalNote("a rosy interior, about 135 F, after about 3 minutes on the flesh side")}`,
      "duck sear"
    );
    const sauce = stepByTitle(pkg, "Cherry sauce and arugula");
    sauce.body = replaceOnce(sauce.body, "Cook is 22 minutes.", "Cook is 26 minutes.", "duck cook line");
    version.time_clock = replaceOnce(
      version.time_clock,
      "Cook 22 is about 10 minutes skin-side, 3 minutes on the flesh, and 8 minutes for the sauce while the duck rests.",
      "Cook 26 is about 10 minutes skin-side, 7 minutes on the flesh, and 8 minutes for the sauce while the duck rests.",
      "duck clock"
    );
    setTimes(pkg, 26, 36);
  })
);

ids.push(
  writeDoneness("seared-scallops-parsnip-puree", (pkg) => {
    const version = pkg.recipe_version;
    version.doneness = `Parsnips very tender; purée completely silky. Sage crisp and butter nutty brown, not black. Scallops with a deep golden-brown crust, opaque and firm throughout (FDA shellfish). ${optionalNote("scallops with a translucent center, about 120 F to 125 F")} kitchen_tested is false.`;
    const step = stepByTitle(pkg, "Sear the scallops");
    step.body = replaceOnce(
      step.body,
      "Sear without moving until a deep golden-brown crust forms, about 2 minutes, then flip and cook 1 minute more, until just opaque at the edges and still translucent in the center (120 to 125 F). For fully cooked scallops (recommended for young children, pregnant, older, or immunocompromised diners), cook 1 to 2 minutes longer on the second side until opaque throughout (145 F).",
      `Sear without moving until a deep golden-brown crust forms, about 2 minutes, then flip and cook 2 to 3 minutes more, until opaque and firm throughout. ${optionalNote("scallops that are still translucent in the center, about 120 F to 125 F")}`,
      "scallop sear"
    );
    version.time_clock = replaceOnce(
      version.time_clock,
      "Cook 37 = 20 parsnip simmer (5 to a simmer + 15 gentle; sage brown butter, 4 to 5 minutes, runs inside it) + 4 blend + 2 heat skillet + 3 first sear batch + 3 second batch + 5 dress salad and plate.",
      "Cook 41 = 20 parsnip simmer (5 to a simmer + 15 gentle; sage brown butter, 4 to 5 minutes, runs inside it) + 4 blend + 2 heat skillet + 5 first sear batch + 5 second batch + 5 dress salad and plate.",
      "scallop clock"
    );
    setTimes(pkg, 41, 51);
  })
);

ids.push(
  writeDoneness("tex-mex-steak-fajitas", (pkg) => {
    const version = pkg.recipe_version;
    version.doneness = `Steak deeply browned outside and 145 F in the center, then a 5-minute rest (USDA whole-muscle beef); peppers charred at the edges but still crisp-tender. ${optionalNote("medium-rare, 130 F to 135 F")}`;
    const step = stepByTitle(pkg, "Sear the steak");
    step.body = replaceOnce(
      step.body,
      "Heat the cast-iron skillet over high until smoking, about 4 minutes. Add 1 tbsp oil and sear 2 pieces of steak (pat off excess marinade) until deeply browned and 130 F, about 3 minutes per side. Repeat (2 batches). Rest on the cutting board 5 minutes.",
      `Heat the cast-iron skillet over high until smoking, about 4 minutes. Add 1 tbsp oil and sear 2 pieces of steak (pat off excess marinade) until deeply browned and 145 F, about 4 minutes per side. Repeat (2 batches). Rest on the cutting board 5 minutes. ${optionalNote("medium-rare, about 130 F")}`,
      "fajita sear"
    );
    step.clock_minutes = 24;
    version.time_clock = replaceOnce(
      version.time_clock,
      "Prep 20 + cook 30 = 50",
      "Prep 20 + cook 34 = 54",
      "fajita clock"
    );
    setTimes(pkg, 34, 54);
  })
);

ids.push(
  writeDoneness("thai-yum-nua-beef-salad", (pkg) => {
    const version = pkg.recipe_version;
    version.doneness = `Steak deeply browned outside and 145 F at the thickest point, then a 5-minute rest (USDA whole-muscle beef). Vegetables raw and crisp; herbs fresh, not wilted. Rice tender. ${optionalNote("medium-rare, about 130 F")}`;
    const step = stepByTitle(pkg, "Sear the steak");
    step.body = replaceOnce(
      step.body,
      "Heat a 12-inch cast-iron skillet over high until it just smokes, about 4 minutes. Add the oil and the steak and sear without moving it until deeply browned, about 5 minutes per side, until 130 F at the thickest point for medium-rare (or 145 F).",
      `Heat a 12-inch cast-iron skillet over high until it just smokes, about 4 minutes. Add the oil and the steak and sear without moving it until deeply browned, about 6 minutes per side, until 145 F at the thickest point. ${optionalNote("medium-rare, about 130 F")}`,
      "yum nua sear"
    );
    step.clock_minutes = 16;
    version.time_clock = replaceOnce(
      version.time_clock,
      "Prep 12 + cook 30 = 42 minutes.",
      "Prep 12 + cook 32 = 44 minutes.",
      "yum nua equation"
    );
    version.time_clock = replaceOnce(
      version.time_clock,
      "29 minutes against 30 minutes of steps 2 to 6.",
      "29 minutes against 32 minutes of steps 2 to 6.",
      "yum nua overlap"
    );
    setTimes(pkg, 32, 44);
  })
);

console.log(JSON.stringify({ ok: true, versions: ids }, null, 2));
