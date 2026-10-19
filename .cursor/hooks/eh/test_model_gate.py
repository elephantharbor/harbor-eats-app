#!/usr/bin/env python3
"""Offline tests for model_gate.py. No model is called; payloads mirror https://cursor.com/docs/agent/hooks."""
import json, os, subprocess, sys, tempfile
from pathlib import Path
_H = Path(__file__).resolve().parent
GATE = _H / "model_gate.py" if (_H / "model_gate.py").is_file() else _H.parent / "model_gate.py"
ROOT = {"conversation_id":"c1","generation_id":"g1","model":"grok-4.7","model_id":"grok-4.7","model_params":[{"id":"effort","value":"high"}],
        "cursor_version":"2.x","workspace_roots":["/repo"],"user_email":None,"transcript_path":None}  # docs "Common schema": the PARENT's model
def cur(event, **kw):
    return {**ROOT, "hook_event_name": event, **kw}
CASES = [
  # --- Cursor-shaped: root model = parent grok-4.7, child named separately (B1 regression guards) ---
  ("cursor-shaped: subagentStart child claude",   cur("subagentStart", subagent_id="s1", subagent_type="generalPurpose", task="t", parent_conversation_id="c1", tool_call_id="tc1", subagent_model="claude-4.5-sonnet", is_parallel_worker=False), 2),
  ("cursor-shaped: subagentStart computerUse claude (bc-5a937259 case)", cur("subagentStart", subagent_type="computerUse", subagent_model="claude-4.5-sonnet"), 2),
  ("cursor-shaped: subagentStart child missing, root grok", cur("subagentStart", subagent_type="generalPurpose", task="t"), 2),
  ("cursor-shaped: subagentStart child grok-4.7", cur("subagentStart", subagent_type="generalPurpose", subagent_model="grok-4.7"), 0),
  ("cursor-shaped: preToolUse Task child claude", cur("preToolUse", tool_name="Task", tool_use_id="u1", cwd="/repo", tool_input={"subagent_type":"generalPurpose","model":"claude-4.5-sonnet","prompt":"x"}), 2),
  ("cursor-shaped: preToolUse task_v2 string child claude", cur("preToolUse", tool_name="task_v2", tool_input=json.dumps({"subagent_type":"computerUse","model":"claude-4.5-sonnet"})), 2),
  ("cursor-shaped: preToolUse Task child grok-4.7", cur("preToolUse", tool_name="Task", tool_input={"subagent_type":"generalPurpose","model":"grok-4.7"}), 0),
  ("cursor-shaped: preToolUse Shell on grok parent", cur("preToolUse", tool_name="Shell", tool_input={"command":"ls"}), 0),
  # --- exact slugs from live test bc-bb2dd80a (2026-10-17); no prefix/regex matching ---
  ("grok-4.7 exact",              {"hook_event_name":"subagentStart","subagent_model":"grok-4.7"}, 0),
  ("GROK-4.7 case/space",         {"hook_event_name":"subagentStart","subagent_model":" GROK-4.7 "}, 0),
] + [(f"{m} allowed", {"hook_event_name":"subagentStart","subagent_model":m}, 0) for m in
     [f"grok-4.7-{e}{f}" for e in ("low","medium","high","xhigh") for f in ("","-fast")]] + [
  ("cursor-shaped: Explore on grok-4.7-high", cur("subagentStart", subagent_type="explore", subagent_model="grok-4.7-high"), 0),
  ("cursor-shaped: Explore on cursor-grok-4.6-low (live-test case)", cur("subagentStart", subagent_type="explore", subagent_model="cursor-grok-4.6-low"), 2),
  ("grok-4.7-fast denied (not a live slug)", {"hook_event_name":"subagentStart","subagent_model":"grok-4.7-fast"}, 2),
  ("grok-4.7-max denied",         {"hook_event_name":"subagentStart","subagent_model":"grok-4.7-max"}, 2),
  ("grok-4.7-high-fast-x denied", {"hook_event_name":"subagentStart","subagent_model":"grok-4.7-high-fast-x"}, 2),
  ("cursor-grok-4.7-high-fast denied", {"hook_event_name":"subagentStart","subagent_model":"cursor-grok-4.7-high-fast"}, 2),
  ("grok-4.70 denied",            {"hook_event_name":"subagentStart","subagent_model":"grok-4.70"}, 2),
  ("composer-2.5 exact",          {"hook_event_name":"subagentStart","subagent_model":"composer-2.5"}, 0),
  ("composer-2.5-fast allowed",   {"hook_event_name":"subagentStart","subagent_model":"composer-2.5-fast"}, 0),
  ("composer-2-5 normalized",     {"hook_event_name":"subagentStart","subagent_model":"composer-2-5"}, 0),
  ("composer-2.5-fast-x denied",  {"hook_event_name":"subagentStart","subagent_model":"composer-2.5-fast-x"}, 2),
  ("composer (floats) denied",    {"hook_event_name":"subagentStart","subagent_model":"composer"}, 2),
  ("composer-latest denied",      {"hook_event_name":"subagentStart","subagent_model":"composer-latest"}, 2),
  ("composer-2 denied",           {"hook_event_name":"subagentStart","subagent_model":"composer-2"}, 2),
] + [(f"live slug {m} denied", {"hook_event_name":"subagentStart","subagent_model":m}, 2) for m in
     ["cursor-grok-4.6-low","cursor-grok-4.6-high-fast","cursor-grok-4.6-xhigh","grok-4.6",
      "claude-fable-5-1-thinking-high","claude-opus-5-5-max","claude-sonnet-5-5-medium","gemini-4-argon-high",
      "gpt-5.6-sol-none","gpt-5.6-sol-xhigh-fast","muse-wonder-1.0-minimal"]] + [
  ("old grok 4.5 denied",         {"hook_event_name":"subagentStart","subagent_model":"grok-4.5"}, 2),
] + [(f"{m} denied", {"hook_event_name":"subagentStart","subagent_model":m}, 2) for m in
     ["auto","default","opus","sonnet","haiku","gpt","codex","fable","muse-1","kimi-k3","glm-5","gemini-3-pro","claude-opus-5-5","gpt-5.6-sol"]] + [
  ("missing model denied",        {"hook_event_name":"subagentStart","subagent_type":"generalPurpose"}, 2),
  ("tool on opus parent",         {"hook_event_name":"preToolUse","model":"claude-opus-4-7-thinking-max","model_id":"claude-opus-4-7","tool_name":"Shell","tool_input":{"command":"ls"}}, 2),
  ("prompt on opus blocked",      {"hook_event_name":"beforeSubmitPrompt","model_id":"claude-opus-4-7","prompt":"reply OK"}, 2),
  ("prompt on grok ok",           cur("beforeSubmitPrompt", prompt="reply OK"), 0),
  ("stop is monitoring only",     {"hook_event_name":"stop","model_id":"claude-opus-4-7","status":"completed"}, 0),
]
def run(payload, env=None):
    p = subprocess.run([sys.executable, str(GATE)], input=json.dumps(payload), capture_output=True, text=True, env=env)
    return p.returncode, p.stdout.strip()
def main():
    fails = 0
    with tempfile.TemporaryDirectory() as td:
        env = dict(os.environ, EH_MODEL_AUDIT_LOG=str(Path(td)/"audit.jsonl"))
        for name, payload, want in CASES:
            code, out = run(payload, env)
            ok = code == want and json.loads(out) is not None
            if want == 2 and "deny" not in out and '"continue": false' not in out: ok = False
            print(("OK  " if ok else "FAIL"), name, code, out[:110]); fails += (not ok)
        # policy missing -> fail closed
        env2 = dict(env, EH_MODEL_POLICY=str(Path(td)/"nope.json"))
        os.rename(GATE.parent/"allowed-models.json", GATE.parent/"allowed-models.json.bak")
        try:
            code, out = run({"hook_event_name":"subagentStart","subagent_model":"grok-4.7"}, env2)
        finally:
            os.rename(GATE.parent/"allowed-models.json.bak", GATE.parent/"allowed-models.json")
        ok = code == 2; print(("OK  " if ok else "FAIL"), "policy missing fails closed", code); fails += (not ok)
        lines = (Path(td)/"audit.jsonl").read_text().splitlines()
        print("audit records:", len(lines))
    print("RESULT:", "PASS" if not fails else f"FAIL ({fails})")
    return 1 if fails else 0
if __name__ == "__main__": sys.exit(main())
