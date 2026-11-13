"""Generate an inspectable, self-contained offline HTML demonstration.

With --vlm ollama, the scenarios use the REAL local Gemma vision model.
Without --vlm, all model results are explicitly synthetic test fixtures.
No hardware is actuated; no internet access is required for the default mode.
"""

from __future__ import annotations

import argparse
import base64
import html
import json
from pathlib import Path

from guardcell import (Action, GuardCellController, OllamaVisionInspector,
                       SCENARIOS, encode_png, synthetic_frame, synthetic_inspection)


def create_demo(output_dir: Path, vlm: str = "fixture") -> dict:
    """Run all designed edge cases and save a visual audit of decisions."""
    output_dir.mkdir(parents=True, exist_ok=True)
    model = OllamaVisionInspector() if vlm == "ollama" else None
    rows = []
    for index, scenario in enumerate(SCENARIOS, 1):
        frame = synthetic_frame(scenario, index=index)
        png = encode_png(frame)
        path = output_dir / f"{index:02d}_{scenario}.png"
        path.write_bytes(png)
        if model:
            try:
                inspection = model.inspect(png)
            except (OSError, ValueError, TimeoutError, KeyError, json.JSONDecodeError) as exc:
                inspection = None
                model_error = f"{type(exc).__name__}: {str(exc)[:240]}"
            else:
                model_error = None
        else:
            inspection = synthetic_inspection(scenario)
            model_error = None
        # Fresh controller per scenario ensures independent fault-injection tests.
        controller = GuardCellController()
        decision = controller.tick(frame, inspection)
        rows.append({
            "scenario": scenario, "decision": decision.to_dict(),
            "model_result": None if inspection is None else {
                "classification": inspection.classification,
                "confidence": inspection.confidence,
                "bbox_xyxy": inspection.bbox_xyxy,
                "latency_s": inspection.latency_s,
                "source": inspection.source,
                "explanation": inspection.explanation,
            },
            "model_error": model_error,
            "image": path.name,
            "data_uri": "data:image/png;base64," + base64.b64encode(png).decode(),
        })
    report = {
        "project": "GuardCell — Deterministic Safety, Local Visual Reasoning",
        "mode": "REAL_LOCAL_OLLAMA_VLM" if model else "SYNTHETIC_VLM_FIXTURES",
        "hardware": "No real robot connected; simulated workcell only",
        "results": [{k: v for k, v in row.items() if k != "data_uri"} for row in rows],
    }
    (output_dir / "audit.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    cards = []
    for row in rows:
        d = row["decision"]
        action = d["action"]
        css = "halt" if action == "EMERGENCY_STOP" else (
            "hold" if action == "HOLD" else "run")
        source = row["model_result"]["source"] if row["model_result"] else "none"
        cards.append(f'''<article class="card"><img src="{row["data_uri"]}" alt="Simulated workcell: {html.escape(row["scenario"])}">
<h2>{html.escape(row["scenario"].replace("_", " ").title())}</h2>
<div class="state {css}">{action}</div>
<p>{html.escape(d["cause"])}</p><p class="muted">Model: {html.escape(source)}</p>
<details><summary>Audit trail &amp; policy tree</summary>
<pre>{html.escape(json.dumps({k: v for k, v in row.items() if k != "data_uri"}, indent=2))}</pre></details></article>''')
    notice = ("LIVE local Ollama/Gemma VLM inference was attempted. "
              "Any model errors produce HOLD. Check each audit record."
              if model else
              "SIMULATED VLM RESULTS. No learned vision model runs in this default demo. "
              "The independent color sentinel and fail-closed controller DO run. "
              "Use --vlm ollama with an installed gemma3:4b for real local model inference.")
    content = f'''<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>GuardCell | Offline Safety Handoffs</title>
<style>
:root {{font-family:Inter,system-ui,Arial,sans-serif;color:#e8eef9;background:#0c1420}}
*{{box-sizing:border-box}}body{{margin:0;padding:0 3.5vw 5rem}}
header{{padding:3rem 0 1.6rem;max-width:980px}}
label{{font-size:.8rem;letter-spacing:.17em;text-transform:uppercase;color:#83c4eb}}
h1{{font-size:clamp(2.2rem,5vw,4.7rem);line-height:1.02;letter-spacing:-.045em;margin:.5rem 0 1rem}}
header p{{font-size:1.1rem;line-height:1.7;color:#aabdce}}
.notice{{padding:1rem 1.2rem;border-left:3px solid #eabf58;background:#233043;color:#f7e5bb}}
.flow{{font-family:monospace;overflow-x:auto;padding:1rem 0 1.7rem;color:#82d6b8}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:1rem}}
.card{{border:1px solid #304154;background:#132031;border-radius:14px;padding:1rem}}
.card img{{width:100%;aspect-ratio:4/3;image-rendering:pixelated;border-radius:8px;background:#222}}
h2{{font-size:1.2rem;text-transform:capitalize}}.state{{font-size:.85rem;letter-spacing:.05em;font-weight:700;padding:.5rem .8rem;border-radius:8px;display:inline-block}}
.halt{{background:#482328;color:#ff979a}}.hold{{background:#4a3d1d;color:#ffd581}}.run{{background:#1c4a3b;color:#9fe7c2}}
.card p{{line-height:1.5;color:#c2d0dc}}.muted{{opacity:.75;font-size:.85rem}}details{{margin-top:1rem;border-top:1px solid #35475b;padding-top:1rem}}
summary{{cursor:pointer;color:#91c5ef}}pre{{font-size:.73rem;white-space:pre-wrap;overflow-wrap:anywhere}}
footer{{margin-top:3rem;color:#93a7ba;font-size:.85rem}}
</style></head><body><header><label>GDG Windsor • Build with AI • 2026</label>
<h1>GuardCell: AI can observe.<br>Only policy can act.</h1>
<p>Offline-first industrial workcell demonstrator with an auditable handoff from perception to deterministic behavior-tree control. No direct AI-to-motor pathway. Every action is either explicitly allowed, held, or stopped.</p>
<div class="notice">{html.escape(notice)}</div><div class="flow">CAMERA + INDEPENDENT INTERLOCKS → VLM (INSPECTION ONLY) → TYPE / BBOX / CONFIDENCE GATE → BEHAVIOR TREE → SIMULATED ACTION</div></header>
<main class="grid">{''.join(cards)}</main><footer>Research simulator only. Not validated for occupational safety or physical robot deployment. Tests and JSON audit are included.</footer></body></html>'''
    (output_dir / "index.html").write_text(content, encoding="utf-8")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vlm", choices=("fixture", "ollama"), default="fixture")
    parser.add_argument("--output-dir", type=Path, default=Path("output/demo"))
    args = parser.parse_args()
    results = create_demo(args.output_dir, args.vlm)
    print(json.dumps({"mode": results["mode"],
                      "actions": {row["scenario"]: row["decision"]["action"]
                                  for row in results["results"]},
                      "html": str((args.output_dir / "index.html").resolve())},
                     indent=2))
