# GuardCell — Deterministic Safety, Local Visual Reasoning

> **Build with AI — Smart Automation, Robotics, and Vision (GDG Windsor / DataRealm, 2026)**
>
> Research demonstrator: **AI may observe and describe; only a deterministic, inspectable controller may authorize simulated workcell actions.**

GuardCell explores the *trust gap* in humanoid and industrial robotics by combining a behavior-tree-inspired priority supervisor, independent sensor interlocks, strict typed model outputs, a local Gemma Vision adapter, and replayable fault injection. The repository contains a **working simulator**, 27 automated tests, a 1,000-case reproducible policy benchmark, a browser-viewable demo, and a notebook for judges. The default simulation does **not** claim to have executed a learned VLM: it labels its model results explicitly as synthetic fixtures.

## Why this matters

Robots need to cope with scratched components, human proximity and unexpected obstructions without treating free-form model text as motor commands. A probabilistic classifier can propose **good** or **defective** for a grounded workpiece. The separate safety supervisor has the final say on whether the simulated workcell should move or stop.

## Architecture

```text
RGB sensor -> visual intrusion sentinel (simulated) -------------------+
Proximity / guard gate / emergency stop / actuator telemetry ---------+---> POLICY TREE
Camera freshness -----------------------------------------------------+       |
                                                                            v
RGB PNG -> optional LOCAL Gemma 3 via Ollama -> strict typed JSON ----> CONTRACT GATE
                                                                            |
                                                                            v
                   EMERGENCY_STOP | HOLD | ROUTE_GOOD | ROUTE_REWORK (simulation)
```

Priority order: independent interlocks and latching stop -> stop latch -> sensor freshness -> VLM typed contract / confidence / bounding-box validation -> **hard-coded** simulated workpiece routing. There is no direct VLM-to-actuator path and no command parser that accepts free-form instructions.

## Fully working default demo (Python 3.10+, no dependencies)

```bash
python -m unittest discover -s tests -v
python benchmark.py --samples 1000 --seed 2601113
python demo.py
```

Open `output/demo/index.html` in a browser. Inspect per-scenario audit trails and `output/demo/audit.json`. The demo draws synthetic frames locally; no cameras, accounts, data downloads, cloud endpoints or robot hardware are required.

## Optional **real** offline vision-language model

Install [Ollama](https://ollama.com/) on the same machine and download the Gemma 3 visual model once while online:

```bash
ollama pull gemma3:4b
ollama serve
```

In another terminal:

```bash
python demo.py --vlm ollama --output-dir output/real-vlm
```

This sends PNG images only to `http://127.0.0.1:11434/api/generate`. The adapter rejects remote/non-local endpoints and enforces JSON validation. If the model is missing, unresponsive, outputs invalid coordinates, times out, or returns uncertain predictions, **the controller chooses HOLD**. No real Gemma measurements are claimed in the supplied benchmark. Gemma may not correctly interpret the synthetic visual encoding; this failure is itself visible in the logs.

## Test matrix

- Independent e-stop, gate, proximity, actuator and sensor-health checks
- Camera freshness and out-of-order timestamps
- Latched stop: explicit, authorized, safe manual reset required
- Low confidence, timeout, absent model, NaN and out-of-bounds model outputs
- Prompt-injection text in a VLM explanation has **no route to motion control**
- Allowed simulated sorting to GOOD and REWORK bins
- Synthetic RGB intrusion detection (a **research fixture**, not a person detector)
- Strict local-only VLM endpoint and JSON-ready audit trails

## Experimental evidence

Reproduce all numbers rather than trusting screenshots:

```bash
python benchmark.py --samples 1000 --seed 2601113 --output output/benchmark.json
```

The benchmark records decision counts, prohibited motion in ten synthetic hazard categories and CPU latency of **policy evaluation only**. It does not measure VLM inference, motor behavior, injury probability, CO₂ emissions, energy consumption or water usage. Test conditions and negative cases are transparent. See `docs/WRITEUP.md` and `docs/SUBMISSION_CHECKLIST.md`.

## Scope and limitations

**NOT A SAFETY-CERTIFIED SYSTEM. NOT FOR CONTROLLING A REAL INDUSTRIAL ROBOT.** This is a simulation of deterministic interlocks; the colored-red intrusion sentinel is not an independently validated person detector. Production deployment would require applicable safety engineering, certified hardware, redundant sensing, physical emergency-stop circuits, protective separation distance analysis, risk assessment, validated real-time control and regulatory compliance. Never connect this demonstrator directly to robot actuators.

The [Sensory Skin Lab](https://github.com/Agnuxo1/sensory-skin-lab) is related independent research into experimental microcoil skins. No physical sensory-skin measurement or safety performance is claimed here.

## Reproducibility

- Python: 3.10+ (standard library for simulator, tests, benchmark, HTML generation)
- Fixed scenario names, random seed and policy thresholds
- Offline default run; local-only optional Ollama/Gemma 3 image inference
- Automated tests: `tests/test_guardcell.py`
- Judge-ready portable notebook: `notebooks/GuardCell_2026.ipynb`
- Video/storyboard: `docs/DEMO_SCRIPT.md`

## Author and license

Francisco Angulo de Lafuente — [ORCID 0009-0001-1634-7063](https://orcid.org/0009-0001-1634-7063). Original code MIT-licensed; see `LICENSE`. Google Gemma 3 and Ollama retain their respective model/software terms and are not redistributed here.

## Public Kaggle verification and demo media

- [Executed Kaggle Notebook (27 tests, 1,000 synthetic scenarios)](https://www.kaggle.com/code/franciscoangulo/guardcell-safe-vlm-robot-handoffs-2026)
- [Submission cover image](assets/cover.png)
- [34-second H.264 simulation video](assets/guardcell_simulation_demo.mp4)
- [Reproducibility and Kaggle result log](docs/VERIFICATION.md)

**Media integrity:** All visuals depict an explicitly synthetic workcell and synthetic VLM fixtures. The clip is not footage of a real robot or proof that the optional Gemma 3 adapter was exercised.

The **public notebook is published**, but an official Kaggle hackathon entry additionally requires submitting the Writeup, attaching the public video/notebook/project link and completing the Media Gallery before the competition deadline.
