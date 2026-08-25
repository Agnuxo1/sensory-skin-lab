class SkinSensorProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.config = { mode: "burst", frequency: 500, power: 4, gain: 42, threshold: 18, pulseRate: 120, pulseWidth: .9, listenDelay: 3 };
    this.phase = 0; this.clock = 0; this.reportClock = 0; this.rmsSum = 0; this.rmsCount = 0;
    this.transientSum = 0; this.transientCount = 0; this.lockI = 0; this.lockQ = 0; this.peak = 0;
    this.smoothedPower = 0; this.noise = 1e-6; this.baseline = null; this.calibration = null;
    this.port.onmessage = event => {
      if (event.data?.type === "config") this.config = { ...this.config, ...event.data.config };
      if (event.data?.type === "clear-baseline") this.baseline = null;
      if (event.data?.type === "calibrate") { this.baseline = null; this.calibration = { frames: 0, amplitude: 0, phaseX: 0, phaseY: 0, transient: 0, noise: 0 }; }
    };
  }
  wrapPhase(value) { let phase = value; while (phase > 180) phase -= 360; while (phase < -180) phase += 360; return phase; }
  report() {
    const rms = Math.sqrt(this.rmsSum / Math.max(1, this.rmsCount));
    const transientRms = Math.sqrt(this.transientSum / Math.max(1, this.transientCount));
    const amplitudeDb = 20 * Math.log10(Math.max(rms, 1e-8));
    const transientDb = 20 * Math.log10(Math.max(transientRms, 1e-8));
    const phaseDeg = Math.atan2(this.lockQ, this.lockI) * 180 / Math.PI;
    this.noise += (Math.abs(rms - this.noise) - this.noise) * .015;
    const noiseDb = 20 * Math.log10(Math.max(this.noise, 1e-8));

    if (this.calibration) {
      const c = this.calibration; c.frames += 1; c.amplitude += amplitudeDb;
      c.phaseX += Math.cos(phaseDeg * Math.PI / 180); c.phaseY += Math.sin(phaseDeg * Math.PI / 180);
      c.transient += transientDb; c.noise += noiseDb;
      if (c.frames >= 40) {
        this.baseline = { amplitudeDb: c.amplitude / c.frames, phaseDeg: Math.atan2(c.phaseY, c.phaseX) * 180 / Math.PI, transientDb: c.transient / c.frames, noiseDb: c.noise / c.frames };
        this.calibration = null; this.port.postMessage({ type: "calibrated" });
      }
    }

    const base = this.baseline;
    const amplitudeDelta = base ? amplitudeDb - base.amplitudeDb : 0;
    const phaseDelta = base ? this.wrapPhase(phaseDeg - base.phaseDeg) : 0;
    const transientDelta = base ? transientDb - base.transientDb : 0;
    const gain = .35 + this.config.gain / 100 * 5.5;
    const threshold = .03 + this.config.threshold / 100 * 1.2;
    const combined = Math.abs(amplitudeDelta) * .52 + Math.abs(phaseDelta) / 18 * .26 + Math.abs(transientDelta) * .22;
    const signal = base ? Math.min(100, Math.max(0, combined - threshold) * gain * 18) : 0;
    this.port.postMessage({ type: "metrics", amplitudeDb, amplitudeDelta, phaseDeg, phaseDelta, transientDb, transientDelta, noiseDb, signal, clipping: this.peak > .985, baselineReady: Boolean(base) });
    this.rmsSum = 0; this.rmsCount = 0; this.transientSum = 0; this.transientCount = 0; this.peak = 0;
  }
  process(inputs, outputs) {
    const input = inputs[0]?.[0]; const output = outputs[0]; if (!output?.length) return true;
    const left = output[0], right = output[1] || output[0], cfg = this.config;
    const period = 1 / Math.max(5, cfg.pulseRate);
    const width = Math.min(period * .45, cfg.pulseWidth / 1000);
    const listenStart = width + cfg.listenDelay / 1000;
    const listenEnd = Math.min(period, listenStart + Math.max(.0008, period * .22));
    const lockAlpha = 1 - Math.exp(-2 * Math.PI * 12 / sampleRate);
    const targetPower = cfg.mode === "passive" ? 0 : cfg.power / 100 * .24;
    for (let i = 0; i < left.length; i++) {
      const mic = input?.[i] || 0; const carrier = Math.sin(this.phase);
      const excitation = cfg.mode === "vlf" ? carrier : cfg.mode === "burst" && this.clock < width ? carrier : 0;
      this.smoothedPower += (targetPower - this.smoothedPower) * .003;
      const tx = excitation * this.smoothedPower; left[i] = tx; right[i] = tx;
      this.peak = Math.max(this.peak, Math.abs(mic)); this.rmsSum += mic * mic; this.rmsCount += 1;
      this.lockI += (mic * Math.cos(this.phase) - this.lockI) * lockAlpha;
      this.lockQ += (mic * Math.sin(this.phase) - this.lockQ) * lockAlpha;
      if (cfg.mode !== "burst" || (this.clock >= listenStart && this.clock < listenEnd)) { this.transientSum += mic * mic; this.transientCount += 1; }
      this.phase += Math.PI * 2 * cfg.frequency / sampleRate; if (this.phase >= Math.PI * 2) this.phase %= Math.PI * 2;
      this.clock += 1 / sampleRate; if (this.clock >= period) this.clock %= period;
      this.reportClock += 1; if (this.reportClock >= sampleRate / 20) { this.reportClock = 0; this.report(); }
    }
    return true;
  }
}
registerProcessor("skin-sensor-processor", SkinSensorProcessor);
