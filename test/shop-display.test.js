import { describe, expect, it } from "vitest";
import {
  formatShopQty,
  rebuildShopSnapshotFromDeltas,
  shopLineChangeMeta,
} from "../src/lib/shop-display.js";

describe("formatShopQty", () => {
  it("renders 0.375 cup as 3/8 cup", () => {
    expect(formatShopQty({ quantity: 0.375, unit: "cup" })).toBe("3/8 cup");
  });

  it("keeps 1/4 as 1/4 not 1/2", () => {
    expect(formatShopQty({ quantity: 0.25, unit: "cup" })).toBe("1/4 cup");
  });

  it("renders common fractional cups", () => {
    expect(formatShopQty({ quantity: 1 / 3, unit: "cup" })).toBe("1/3 cup");
    expect(formatShopQty({ quantity: 2 / 3, unit: "cup" })).toBe("2/3 cup");
    expect(formatShopQty({ quantity: 0.125, unit: "cup" })).toBe("1/8 cup");
    expect(formatShopQty({ quantity: 0.5, unit: "cup" })).toBe("1/2 cup");
    expect(formatShopQty({ quantity: 0.75, unit: "cup" })).toBe("3/4 cup");
  });
});

describe("shopLineChangeMeta", () => {
  const cheese = {
    ingredient_id: "cheese",
    unit: "cup",
    quantity: 0.5,
    still_needed: true,
    list_state: "open",
    surplus_quantity: 0,
  };

  it("tags a new line as Added when it was not on the snapshot", () => {
    const meta = shopLineChangeMeta(cheese, {
      tagsVisible: true,
      snapshot: {},
      unseenDeltas: [
        {
          kind: "added",
          ingredient_id: "cheese",
          unit: "cup",
          quantity: 0.5,
          created_at: "2026-10-04T12:00:00.000Z",
        },
      ],
    });
    expect(meta && meta.tag).toBe("Added");
  });

  it("tags More needed when the same line quantity increased", () => {
    const meta = shopLineChangeMeta(
      { ...cheese, quantity: 1 },
      {
        tagsVisible: true,
        snapshot: { "cheese\u0000cup": { quantity: 0.5, list_state: "open" } },
        unseenDeltas: [
          {
            kind: "added",
            ingredient_id: "cheese",
            unit: "cup",
            quantity: 0.5,
            created_at: "2026-10-04T12:00:00.000Z",
          },
        ],
      }
    );
    expect(meta && meta.tag).toBe("More needed");
  });

  it("does not tag dropped lines", () => {
    const meta = shopLineChangeMeta(
      { ...cheese, still_needed: false, surplus_quantity: 0.5 },
      {
        tagsVisible: true,
        snapshot: { "cheese\u0000cup": { quantity: 1, list_state: "purchased" } },
        unseenDeltas: [
          {
            kind: "no_longer_needed",
            ingredient_id: "cheese",
            unit: "cup",
            quantity: 0.5,
            created_at: "2026-10-04T12:00:00.000Z",
          },
        ],
      }
    );
    expect(meta).toBeNull();
  });

  it("rebuildSnapshotFromDeltas removes a newly added line from baseline", () => {
    const snap = rebuildShopSnapshotFromDeltas(
      [{ ...cheese, still_needed: true }],
      [
        {
          kind: "added",
          ingredient_id: "cheese",
          unit: "cup",
          quantity: 0.5,
          created_at: "2026-10-04T12:00:00.000Z",
        },
      ]
    );
    expect(snap["cheese\u0000cup"]).toBeUndefined();
  });
});
