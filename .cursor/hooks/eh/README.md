# Elephant Harbor model gate (Cursor hooks)

Source of truth: `/workspace/elephant-harbor/ops/model-governance/enforcement/` on the shared box (Portfolio Systems, Wells).
Policy: Grok 4.7 default; Composer 2.5 only for trivial work chosen explicitly; no Auto; every third-party model
(Claude/Opus/Sonnet, GPT, Gemini, Kimi, GLM, others) denied unless Thomas explicitly approves. Freeze runs through
at least 2026-11-03 and does not auto-expire.

- `subagentStart` (failClosed): ENFORCING. Denies a subagent whose `subagent_model` is not approved, or is missing.
- `preToolUse`: ENFORCING per tool call. Denies a tool call that carries a non-approved model in `tool_input`
  (Task / task_v2) or that comes from an agent whose own model is not approved.
- `beforeSubmitPrompt`: ENFORCING where it runs (IDE/CLI). Cloud agents skip hooks on early read-only turns.
- `stop` / `subagentStop`: MONITORING only (append-only audit log at `.cursor/hooks/eh/audit.jsonl`, git-ignored).

Deny-not-substitute: the gate never swaps in another model. No env-var override exists; exceptions go into
`allowed-models.json` `approved_exceptions` by PR, with Thomas's explicit yes.
Offline tests: `python3 .cursor/hooks/eh/test_model_gate.py`.
