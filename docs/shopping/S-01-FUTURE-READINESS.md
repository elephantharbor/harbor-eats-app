# S-01 Future Readiness

**Status.** Naming only. None of these are built. None of them add a column beyond the architecture card.

The household line’s stable key (`ingredient_id` or `general_key`), origin, unit, and separate required versus override quantities are the V1 primitives. They are required for the shopping product itself. They are not a pantry.

| Later capability | Minimal V1 primitive | Explicitly not built |
|---|---|---|
| Pantry tracking | The stable key, so a future `pantry_lot` can attach. `already_have` stays a trip mark and is not seeded into a lot. | On-hand quantity, location, expiry, confidence, deduction events. |
| Stock monitoring | Same key, plus `purchased` as a user assertion that a monitor could later read. | Thresholds, reminders, background jobs. |
| Package-aware buying | One honest measurement in the handoff. A later matcher needs `product_match` in a provider response. | Package-size math, UPC tables. |
| Budget-aware planning | None. A budget needs prices we do not have. | Budget field, price column. |
| Retailer comparison | Registry rows with empty verified capabilities. | A second live adapter, price table. |
| Waste reduction | Recipe lines already know `meal_ids` and scaled quantity, so a later cook flow could compare what was bought. | Waste log, spoilage model. |
| Preference learning | Member favorites are an explicit label the person sets in S-02 (a store name). They are not inferred. | Learning from handoffs. A handoff is not a purchase, so it must not train taste. |
| Order reconciliation | Handoff status without an order id. A later provider that returns an order id gets a new column then. | Order ingest, receipt parsing. |
| Recurring staples | General lines survive plan completion, so a person can leave “oat milk” on the list. | Automatic recurrence detection. |
| Duplicate-purchase avoidance | Aggregation already merges the same key and unit. The override and `already_have` stop a resync from re-opening a line the shopper settled. | Cross-list history mining. |

S-02 must not add “just in case” columns for the right-hand list. The architecture card’s `pantry_lot` paragraph is the extension note a future author needs.
