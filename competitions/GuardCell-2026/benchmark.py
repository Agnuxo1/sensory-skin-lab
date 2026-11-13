"""Reproducible safety-invariant stress test on SYNTHETIC workcell frames.

This benchmark does not claim certification, human detection accuracy, or real
VLM speed. Its latency is the deterministic supervisor's local CPU tick only.
"""

import argparse
import json
from pathlib import Path
import random
import statistics
import time

from guardcell import (Action, GuardCellController, SCENARIOS,
                       synthetic_frame, synthetic_inspection)


UNSAFE = {"intrusion", "human_near", "estop", "gate", "sensor_fault",
          "actuator_fault", "stale", "low_confidence", "model_timeout",
          "out_of_bounds"}
MOVING = {Action.ROUTE_GOOD, Action.ROUTE_REWORK}


def run_benchmark(samples: int = 1000, seed: int = 2601113) -> dict:
    """Randomized scenario sequencing and independent-latch reset tests."""
    if samples < 1:
        raise ValueError("samples must be >= 1")
    rng = random.Random(seed)
    timings_ms = []
    counts = {a.value: 0 for a in Action}
    unsafe_motion_count = 0
    false_stop_count = 0
    for index in range(samples):
        name = rng.choice(SCENARIOS)
        frame = synthetic_frame(name, index=index)
        model = synthetic_inspection(name)
        controller = GuardCellController()
        t0 = time.perf_counter_ns()
        decision = controller.tick(frame, model)
        latency_ms = (time.perf_counter_ns() - t0) / 1e6
        timings_ms.append(latency_ms)
        counts[decision.action.value] += 1
        if name in UNSAFE and decision.action in MOVING:
            unsafe_motion_count += 1
        if name in ("good", "defective") and decision.action not in MOVING:
            false_stop_count += 1
        # Re-check a latched stop against a nominal safe frame. No automatic reset.
        if controller.stop_latched:
            assert controller.tick(synthetic_frame("good"),
                                   synthetic_inspection("good")).action == Action.EMERGENCY_STOP
    timings_ms.sort()
    p95 = timings_ms[min(samples - 1, int(0.95 * samples))]
    return {"benchmark": "GuardCell deterministic policy (synthetic simulation)",
            "seed": seed, "samples": samples,
            "unsafe_motion_count": unsafe_motion_count,
            "false_stop_count_for_unambiguous_safe_frames": false_stop_count,
            "simulated_actions": counts,
            "policy_cpu_tick_p50_ms": round(statistics.median(timings_ms), 4),
            "policy_cpu_tick_p95_ms": round(p95, 4),
            "what_was_not_measured": [
                "Vision-language model latency or accuracy",
                "Physical robot actuation latency or reliability",
                "Human detection under real-world lighting or occlusion",
                "Safety certification or injury-risk reduction",
                "Energy, CO2 emissions or water consumption"],
            "result": "PASS" if unsafe_motion_count == false_stop_count == 0 else "FAIL"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", type=int, default=1000)
    parser.add_argument("--seed", type=int, default=2601113)
    parser.add_argument("--output", type=Path,
                        default=Path("output/benchmark.json"))
    args = parser.parse_args()
    report = run_benchmark(args.samples, args.seed)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if report["result"] != "PASS":
        raise SystemExit(1)
