<img width="1731" height="909" alt="exec-24c72637-15e4-433f-993e-802e6ecef72f" src="https://github.com/user-attachments/assets/aad7ef1d-bb72-47e5-ada9-525c85bd8c5d" />


# Sensory Skin Lab

Sensory Skin Lab is an experimental browser instrument for studying thin microcoils embedded in flexible robotic skin. It generates controlled audio-band excitation, acquires a receive coil through an audio interface, extracts response features, and supports empirical calibration for proximity and material-response experiments.

The application is a research demonstrator. It does **not** prove that a coil can identify a material, guarantee a 15 cm range, or provide certified safe human contact. Those capabilities must be established experimentally for each sensor, geometry, analogue front end, environment, and target population.

## What it does

- Passive RX, continuous VLF, and gated burst/PI-like excitation modes
- Identical mono excitation on left and right audio outputs
- Real-time amplitude, phase, transient-decay, noise, clipping, and combined-response metrics
- Empty-field baseline acquisition
- Empirical three-class reference model: human/biological, metallic, and non-conductive
- Five-point proximity calibration at 15, 10, 5, 2, and 0 cm
- Five-sample-per-second research logging and CSV export
- Local-only audio processing using AudioWorklet
- Responsive, low-overhead interface for laptops and mobile devices

## Scientific interpretation

The classifier is intentionally simple and transparent. It computes a feature vector from absolute amplitude change, phase displacement, transient change, and combined response, then compares the live vector with user-recorded centroids. Confidence is a relative separation score between the nearest and second-nearest references; it is not a probability.

The distance display interpolates response strength between captured anchors. It is target-specific and may not be monotonic. Recalibrate whenever the coil, cable position, drive, gain, target, or environment changes.

## Hardware concept

The intended sensor element is a fine copper microcoil embedded in a flexible substrate such as cast silicone or a validated flexible printed structure. A complete system should include:

1. Current-limited and galvanically isolated excitation.
2. A low-noise differential receive front end near the coil.
3. Input protection, band limiting, and measured thermal limits.
4. Mechanical strain relief and repeatable coil geometry.
5. Independent contact or force sensing for robot safety.

See [docs/HARDWARE.md](docs/HARDWARE.md) and [docs/EXPERIMENTAL_PROTOCOL.md](docs/EXPERIMENTAL_PROTOCOL.md).

## Run locally

Requirements: Node.js 22.13 or newer and a recent Chromium-based browser.

~~~bash
npm install
npm run dev
~~~

Open the displayed local URL, select the audio input/output, start acquisition, and capture a baseline before collecting references.

## Production build

~~~bash
npm run build
~~~

## Privacy

Audio samples are processed in the browser and are not uploaded by this application. Exported CSV files remain on the user's device.

## Safety and scope

- Never connect a power-amplifier output directly to a microphone input.
- Do not test on people until electrical isolation, surface voltage, temperature, and failure modes have been independently verified.
- Do not use this demonstrator as the sole collision-avoidance or contact-safety system.
- The audio burst mode is a low-voltage, audio-interface approximation; it is not a conventional high-current pulse-induction driver.

## License

MIT. See [LICENSE](LICENSE).
