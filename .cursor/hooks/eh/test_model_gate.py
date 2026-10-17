#!/usr/bin/env python3
"""Offline tests for model_gate.py. No model is called; payloads mirror https://cursor.com/docs/agent/hooks."""
import json, os, subprocess, sys, tempfile
from pathlib import Path
GATE = Path(__file__).resolve().parents[1] / "model_gate.py"
CASES = [
  ("grok parent subagent grok",  {"hook_event_name":"subagentStart","model_id":"grok-4.7","subagent_type":"generalPurpose","subagent_model":"grok-4.7"}, 0),
  ("slug variant allowed",       {"hook_event_name":"subagentStart","subagent_model":"cursor-grok-4.7-high-fast"}, 0),
  ("composer 2.5 allowed",       {"hook_event_name":"subagentStart","subagent_model":"composer-2.5-fast"}, 0),
  ("observed bc-5a937259 case",  {"hook_event_name":"subagentStart","model_id":"grok-4.7","subagent_type":"computerUse","subagent_model":"claude-4.5-sonnet"}, 2),
  ("opus denied",                {"hook_event_name":"subagentStart","subagent_model":"claude-opus-5-5"}, 2),
  ("gpt denied",                 {"hook_event_name":"subagentStart","subagent_model":"gpt-5.6-sol"}, 2),
  ("gemini denied",              {"hook_event_name":"subagentStart","subagent_model":"gemini-3-pro"}, 2),
  ("kimi denied",                {"hook_event_name":"subagentStart","subagent_model":"kimi-k3"}, 2),
  ("glm denied",                 {"hook_event_name":"subagentStart","subagent_model":"glm-5"}, 2),
  ("auto denied",                {"hook_event_name":"subagentStart","subagent_model":"auto"}, 2),
  ("old grok 4.5 denied",        {"hook_event_name":"subagentStart","subagent_model":"grok-4.5"}, 2),
  ("composer-2 denied",          {"hook_event_name":"subagentStart","subagent_model":"composer-2"}, 2),
  ("missing model denied",       {"hook_event_name":"subagentStart","subagent_type":"generalPurpose"}, 2),
  ("task tool explicit claude",  {"hook_event_name":"preToolUse","model_id":"grok-4.7","tool_name":"Task","tool_input":{"subagent_type":"computerUse","model":"claude-4.5-sonnet"}}, 2),
  ("task_v2 string input",       {"hook_event_name":"preToolUse","model_id":"grok-4.7","tool_name":"task_v2","tool_input":json.dumps({"model":"gpt-6.1-sol"})}, 2),
  ("shell on grok parent",       {"hook_event_name":"preToolUse","model_id":"grok-4.7","tool_name":"Shell","tool_input":{"command":"ls"}}, 0),
  ("tool on opus parent",        {"hook_event_name":"preToolUse","model":"claude-opus-4-7-thinking-max","model_id":"claude-opus-4-7","tool_name":"Shell","tool_input":{"command":"ls"}}, 2),
  ("prompt on opus blocked",     {"hook_event_name":"beforeSubmitPrompt","model_id":"claude-opus-4-7","prompt":"reply OK"}, 2),
  ("prompt on grok ok",          {"hook_event_name":"beforeSubmitPrompt","model_id":"grok-4.7","prompt":"reply OK"}, 0),
  ("stop is monitoring only",    {"hook_event_name":"stop","model_id":"claude-opus-4-7","status":"completed"}, 0),
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
