# Elephant Harbor model gate (Cursor hooks)

> **STATUS: UNPROVEN IN CLOUD AGENTS — MONITORING ONLY.** Live test bc-bb2dd80a (postrema/ALC, 2026-10-17) ran an Explore
> subagent on `cursor-grok-4.6-low` with no hook deny from repo `subagentStart`/`preToolUse` hooks. Only the account-level
> Enterprise model allowlist can block a cloud-agent subagent's model. The ENFORCING labels below describe intended IDE/CLI behaviour.

Source of truth: `/workspace/elephant-harbor/ops/model-governance/enforcement/` on the shared box (Portfolio Systems, Wells).
Policy: Grok 4.7 default; Composer 2.5 only for trivial work chosen explicitly; no Auto; every third-party model
(Claude/Opus/Sonnet, GPT, Gemini, Kimi, GLM, others) denied unless Thomas explicitly approves. Freeze runs through
at least 2026-11-03 and does not auto-expire.

- `subagentStart` (failClosed): ENFORCING. Denies a subagent whose own model is not approved, or is missing. Reads only the
  child's model (`subagent_model`, else model fields nested under `tool_input`/`subagent`), never the root `model`/`model_id`,
  which Cursor fills with the parent's model.
- `preToolUse`: ENFORCING per tool call. Denies a tool call that carries a non-approved model in `tool_input`
  (Task / task_v2) or that comes from an agent whose own model is not approved.
- `beforeSubmitPrompt`: ENFORCING where it runs (IDE/CLI). Cloud agents skip hooks on early read-only turns.
- `stop` / `subagentStop`: MONITORING only (append-only audit log at `.cursor/hooks/eh/audit.jsonl`, git-ignored).

Exact live cloud-agent slugs only: `grok-4.7`, `grok-4.7-{low,medium,high,xhigh}` and their `-fast` variants;
`composer-2.5` and `composer-2.5-fast` for explicitly trivial work (alias `composer-2-5`). Everything else is denied,
including `cursor-grok-4.6-*`, `grok-4.7-fast`, `cursor-grok-4.7-*` and floating aliases `auto`, `default`, `composer`, `composer-latest`.

Deny-not-substitute: the gate never swaps in another model. No env-var override exists; exceptions go into
`allowed-models.json` `approved_exceptions` by PR, with Thomas's explicit yes.
Offline tests: `python3 .cursor/hooks/eh/test_model_gate.py`.
