-- Harbor Eats — durable HE-SHARE / HE-INV tokens (alpha cross-device)
-- Extends 0001 share_choice + invite. invite_code / token remain HE-INV-* / HE-SHARE-*.
-- options_snapshot_json: guest can render A/B/C without local meal catalog.

PRAGMA foreign_keys = ON;

-- Snapshot of options A/B/C at share time (JSON array of {letter,name,meal_option_id,...})
ALTER TABLE share_choice ADD COLUMN options_snapshot_json TEXT;

-- Channel attribution when share is created (align with invite.channel)
ALTER TABLE share_choice ADD COLUMN channel TEXT
  CHECK (channel IS NULL OR channel IN (
    'share_sheet','copy','email','sms','other'
  ));

-- Faster invite lookup by household (already have idx_invite_household)
-- Unique token already on share_choice.token; invite PK is invite_code (HE-INV-*).
