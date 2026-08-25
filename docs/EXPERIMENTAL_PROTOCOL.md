# Experimental Protocol

## Objective

Determine whether the sensor response contains repeatable information that separates target class and distance under controlled conditions.

## Controlled variables

Fix the coil, cable, interface, USB port, sample rate, gain, drive, frequency, operator position, target orientation, approach path, room, and grounding. Move targets with a non-conductive fixture so the operator's body is not the dominant variable.

## Procedure

1. Warm the electronics for five minutes.
2. Record 30 seconds of empty-field noise.
3. Capture a fresh baseline.
4. Present each target at randomized distances and in randomized order.
5. Record at least ten independent approaches per target and distance.
6. Include negative controls: wood, plastic, an empty fixture, and operator movement without a target.
7. Train reference centroids on one subset of trials.
8. Report performance only on held-out trials.

## Recommended analysis

- Plot each feature versus distance with confidence intervals.
- Calculate confusion matrices for human, metallic, and non-conductive classes.
- Report false-positive and false-negative rates.
- Repeat on another day and after sensor bending.
- Test whether performance remains above chance when the operator is hidden from the labels.

## Acceptance criteria

Define criteria before collecting the final dataset. A useful prototype should show monotonic or modelable distance response, class separation on held-out objects, stable noise margins, and no saturation across the claimed operating range.
