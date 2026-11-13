# GuardCell: AI Can Observe. Only Policy Can Act.

**Subtitle:** A fail-closed, offline-first industrial robot handoff architecture with local Gemma Vision integration, auditable behavior-tree decisions, and adversarial fault injection.

## Problem and industrial value

Industrial cells have two difficult requirements. Their safety and actuator logic must be deterministic, while visual inspection and unexpected workpiece defects demand flexible perception. Sending raw vision-language-model output to robot motion control blurs these responsibilities and creates failure modes ranging from hallucinated coordinates to delayed sensor feedback. GuardCell demonstrates an inspectable boundary between *model suggestions* and *controller authority* for a bracket-sorting workcell. Scratched brackets are diverted to a rework bin; unaffected brackets go to a good-parts bin. People, open gates, failed interlocks, stale images and uncertain predictions interrupt the task.

## What we built

GuardCell provides five components:

1. **Perception input:** deterministic synthetic RGB workcell frames, a simulated color-encoded exclusion-zone intrusion sentinel and independent synthetic proximity, gate, camera-health, actuator-health and emergency-stop inputs.
2. **Optional real local VLM:** a Gemma 3 vision-capable model accessed through an Ollama API bound to localhost; it returns an image classification, confidence, bounded coordinates and explanation. The shipped default tests use clearly marked *synthetic model fixtures* so they are reproducible without downloading any weights.
3. **Strict handoff contract:** the controller accepts only enumerated classes, finite confidence over a configured threshold, valid latency and integer bounding boxes inside a pre-approved virtual work envelope. Model text is never interpreted as an actuator command.
4. **Deterministic priority controller:** independent interlocks take precedence, urgent events latch an emergency stop, stale frames or invalid VLM output produce HOLD, and only validated proposals can trigger pre-defined simulated routing actions. Reset requires explicit authorization and safe sensor readings.
5. **Evidence and demonstration:** Python unit tests, randomized fault-injection benchmark, replayable JSON logs, synthetic scene PNGs and an offline HTML visual audit gallery.

## Architecture and handoffs

The behavior-tree-style priority sequence is `IndependentSafetyInterlocks > LatchedStop > FrameFreshness > PerceptionContract > DeterministicRouting`. The model can recommend `good`, `defective`, or `unknown` with grounded coordinates. It cannot change safety margins, disable stops, select arbitrary robot motions, or authorize a reset. Under model delay, loss of model availability or malformed output, the system holds its simulated task rather than continuing with an unverified proposal. These explicit handoffs are inspectable in each audit trace.

## Deployment design

The entire default simulator, tests and reporting pipeline run offline with Python's standard library on a single workstation. The separate Ollama adapter supports an independently installed, locally hosted Gemma 3 vision model without sending frames to the cloud. The demo's synthetic test fixture is available even when no model exists, but this mode must **not** be described as actual VLM inference. For a real factory, proximity and stop loops would need independent certified safety hardware; the Python program is not certified or deployable as a physical robot safety controller.

## Experiments and observed results

We exercised **27 automated tests** covering routing, emergency stops, manual reset, missing and delayed model data, prompt-injection text, invalid coordinates, malformed sensor values and independent visual intrusion checks. All passed in the packaged validation run.

A seeded **1,000-case** synthetic policy benchmark (`seed=2601113`) produced **0 prohibited simulated routing actions in modeled hazard scenarios**, with zero false holds for its two unambiguous safe fixtures. The simulator reported a local **policy-only** CPU tick p50 of **0.666 ms** and p95 of **0.888 ms** in the packaging environment; results vary by machine. This is not full end-to-end vision latency. These are software invariants under controlled synthetic assumptions, **not** estimates of factory safety, detection accuracy, real robot speed or physical-world reliability. The real local Gemma adapter is implemented but its predictive performance has not been benchmarked in this package.

## Novelty and engineering trade-offs

Unlike prompt-only automation, GuardCell specifies a narrow, auditable perception-to-control contract and makes the deterministic policy the sole source of simulated actions. A model may describe a scratched bracket, but an injected instruction in its explanation never changes the controller's action policy. Every escalation is explainable using a short behavior-tree path. A synthetic, standard-library-only mode makes faults easy to reproduce without robotics equipment or Internet access. The trade-off is explicit: the supplied simulator evaluates software control properties, not real-world human detection, certified separation distances or robot kinematics.

## Reproduction and project files

Run `python -m unittest discover -s tests -v`, `python benchmark.py --samples 1000 --seed 2601113`, and `python demo.py`; then open `output/demo/index.html`. Optional Gemma 3 local inference: install Ollama, pull `gemma3:4b`, and run `python demo.py --vlm ollama`. Audit decisions appear in `output/demo/audit.json`; reproducible benchmark results in `output/benchmark.json`. The repository contains an executable Kaggle notebook, complete Python source, MIT licence and a short demonstration script.

## Author and affiliations

Francisco Angulo de Lafuente, independent AI research and development. ORCID: 0009-0001-1634-7063. Related non-certified sensor research: Sensory Skin Lab.

## Safety and model transparency

This is a virtual workcell research demonstration, not an industrial safety certification. No robot is connected. The synthetic camera colors are deliberately simplified. We do not claim measured CO₂, energy, water savings, human-detection accuracy or tested physical collision avoidance. The architecture is designed to preserve independent safety checks rather than substitute for them.

## References

- GDG Windsor / DataRealm. *Build with AI — Smart Automation, Robotics, and Vision* (2026), official Kaggle challenge and judging rubric.
- Google. *Gemma 3* model documentation and applicable model terms.
- Ollama. Local model server and API documentation.
- BehaviorTree.CPP and py_trees documentation for industrial robot controller design patterns.
