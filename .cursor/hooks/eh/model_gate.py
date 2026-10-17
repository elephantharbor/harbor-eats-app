#!/usr/bin/env python3
"""Elephant Harbor model gate for Cursor hooks (portable: Linux/macOS/Windows, stdlib only).

Hook events handled (see https://cursor.com/docs/agent/hooks):
  subagentStart     -> checks the CHILD's model only: `subagent_model` (any depth), else model fields nested under
                       tool_input/subagent/... Never the root `model`/`model_id` (those are the parent's, per the
                       docs' common schema). No child model -> deny. ENFORCING: deny blocks the spawn.
  preToolUse        -> checks model fields inside `tool_input` (Task / task_v2 / any tool that carries a model)
                       and the agent's own `model_id`/`model`. ENFORCING for the tool call only; the parent's
                       own tokens for that turn are already spent.
  beforeSubmitPrompt-> checks the composer's own `model_id`/`model` before the backend request. ENFORCING where it
                       runs (IDE/CLI); cloud agents skip hooks on early read-only turns, so treat as partial.
  stop/subagentStop/afterAgentResponse -> MONITORING only (append to the audit log, never block).

Decision rule: deny-not-substitute. Exact allowlist (allowed_ids after trim/lowercase/alias map); everything else is
denied, including a missing child model, suffix variants (grok-4.7-high, composer-2.5-fast) and floating aliases
(auto, default, composer, composer-latest).
No environment-variable override exists by design: exceptions are added to allowed-models.json by PR with
Thomas's explicit yes recorded in approved_exceptions.
Exit code 2 = deny (documented equivalent to permission:"deny"); JSON is also printed.
"""
import json, os, re, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODEL_KEYS = ("subagent_model", "model_id", "modelId", "model", "requested_model", "model_slug")
NESTED = ("tool_input", "input", "params", "arguments", "args", "subagent", "agent", "request")


def load_policy():
    for p in (os.environ.get("EH_MODEL_POLICY"), HERE / "allowed-models.json",
              Path(os.environ.get("CURSOR_PROJECT_DIR", ".")) / ".cursor/hooks/eh/allowed-models.json"):
        if p and Path(p).is_file():
            return json.loads(Path(p).read_text(encoding="utf-8"))
    return None


def model_values(node, depth=0):
    """Yield (path, value) for every model-ish string field, searching common nested containers."""
    if depth > 3 or not isinstance(node, dict):
        return
    for k in MODEL_KEYS:
        v = node.get(k)
        if isinstance(v, dict):
            v = v.get("id") or v.get("name")
        if isinstance(v, str) and v.strip():
            yield k, v.strip()
    for k in NESTED:
        sub = node.get(k)
        if isinstance(sub, str):
            try:
                sub = json.loads(sub)
            except ValueError:
                sub = None
        if isinstance(sub, dict):
            for kk, vv in model_values(sub, depth + 1):
                yield f"{k}.{kk}", vv


def normalize(model, policy):
    m = str(model).strip().lower()
    return policy.get("aliases", {}).get(m, m)


def allowed(model, policy):
    raw = str(model).strip().lower()
    if raw in {a.lower() for a in policy.get("refused_aliases", [])}:
        return False
    m = normalize(model, policy)
    for exc in policy.get("approved_exceptions", []):
        if m == str(exc.get("model", "")).strip().lower() and exc.get("approved_by") == "Thomas" and exc.get("expires", "") >= time.strftime("%Y-%m-%d"):
            return True
    return m in {i.lower() for i in policy.get("allowed_ids", [])}


def child_models(payload):
    """The subagent's own model. Root model/model_id belong to the parent and are never used here."""
    found = list(model_values(payload))
    child = [v for k, v in found if k.split(".")[-1] == "subagent_model"]
    if not child:
        child = [v for k, v in found if "." in k]  # nested under tool_input/subagent/...; root keys excluded
    return child


def audit(event, decision, models, payload):
    log = os.environ.get("EH_MODEL_AUDIT_LOG") or str(Path(os.environ.get("CURSOR_PROJECT_DIR", ".")) / ".cursor/hooks/eh/audit.jsonl")
    try:
        Path(log).parent.mkdir(parents=True, exist_ok=True)
        rec = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "event": event, "decision": decision, "models": models,
               "conversation_id": payload.get("conversation_id"), "parent_conversation_id": payload.get("parent_conversation_id"),
               "subagent_id": payload.get("subagent_id"), "subagent_type": payload.get("subagent_type"),
               "tool_name": payload.get("tool_name"), "parent_model": payload.get("model_id") or payload.get("model"),
               "user_email": payload.get("user_email")}
        with open(log, "a", encoding="utf-8") as f:
            f.write(json.dumps(rec) + "\n")
    except OSError:
        pass  # logging is monitoring only; never changes the decision


def decide(payload, policy):
    event = payload.get("hook_event_name") or os.environ.get("EH_HOOK_EVENT", "")
    if event in ("stop", "subagentStop", "afterAgentResponse", "postToolUse"):
        return event, "observe", [], None
    if policy is None:
        return event, "deny", [], "model policy file missing (fail closed)"
    if event == "subagentStart":
        child = child_models(payload)
        if not child:
            return event, "deny", [], "subagent model not reported (fail closed, deny-not-substitute)"
        bad = [m for m in child if not allowed(m, policy)]
        return event, ("deny" if bad else "allow"), child, (f"subagent model {bad} is not approved" if bad else None)
    if event == "preToolUse":
        # Parent's own model (legitimately the root model_id, else legacy model) + any model the tool call names.
        own = [v for k, v in model_values({k: payload.get(k) for k in ("model_id", "model")})]
        tool = [v for k, v in model_values({"tool_input": payload.get("tool_input")})]
        checked = own[:1] + tool
        bad = [m for m in checked if not allowed(m, policy)]
        return event, ("deny" if bad else "allow"), checked, (f"model {bad} is not approved" if bad else None)
    if event == "beforeSubmitPrompt":
        own = [v for k, v in model_values({k: payload.get(k) for k in ("model_id", "model")})]
        if not own:
            return event, "allow", [], None  # nothing to check; monitoring records it
        bad = [m for m in own[:1] if not allowed(m, policy)]
        return event, ("deny" if bad else "allow"), own[:1], (f"model {bad} is not approved" if bad else None)
    return event, "allow", [], None


def main():
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw) if raw.strip() else {}
    except ValueError:
        payload = {}
    if len(sys.argv) > 1 and not payload.get("hook_event_name"):
        payload["hook_event_name"] = sys.argv[1]
    event, decision, models, reason = decide(payload, load_policy())
    audit(event, decision, models, payload)
    msg = (f"EH-MODEL-DENIED: {reason}. Policy: Grok 4.7 default, Composer 2.5 trivial-only (explicit). "
           "No fallback was attempted. Re-run on grok-4.7, or ask Thomas for an explicit exception.") if decision == "deny" else None
    if event == "beforeSubmitPrompt":
        out = {"continue": decision != "deny"}
        if msg:
            out["user_message"] = msg
    elif event in ("subagentStart", "preToolUse"):
        out = {"permission": "deny" if decision == "deny" else "allow"}
        if msg:
            out["user_message"] = msg
            out["agent_message"] = msg
    else:
        out = {}
    sys.stdout.write(json.dumps(out) + "\n")
    return 2 if decision == "deny" else 0


if __name__ == "__main__":
    sys.exit(main())
