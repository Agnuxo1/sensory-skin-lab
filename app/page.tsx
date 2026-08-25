"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Device = { deviceId: string; label: string };
type Mode = "passive" | "vlf" | "burst";
type Material = "human" | "metal" | "nonConductive";
type Metrics = {
  amplitudeDb: number; amplitudeDelta: number; phaseDeg: number; phaseDelta: number;
  transientDb: number; transientDelta: number; noiseDb: number; signal: number;
  clipping: boolean; baselineReady: boolean;
};
type Profile = { material: Material; vector: number[]; samples: number; createdAt: string };
type DistanceAnchor = { distance: number; strength: number };
type LogRow = Metrics & { timestamp: string; elapsed: number; classification: string; confidence: number; distance: number | null };

const EMPTY: Metrics = { amplitudeDb: -120, amplitudeDelta: 0, phaseDeg: 0, phaseDelta: 0, transientDb: -120, transientDelta: 0, noiseDb: -120, signal: 0, clipping: false, baselineReady: false };
const MATERIALS: { id: Material; label: string; short: string }[] = [
  { id: "human", label: "Human / biological", short: "HUMAN" },
  { id: "metal", label: "Metallic", short: "METAL" },
  { id: "nonConductive", label: "Non-conductive", short: "NON-CONDUCTIVE" },
];
const DISTANCES = [15, 10, 5, 2, 0];
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const featureVector = (m: Metrics) => [Math.abs(m.amplitudeDelta), Math.abs(m.phaseDelta) / 12, Math.abs(m.transientDelta), m.signal / 25];
const strengthOf = (m: Metrics) => Math.abs(m.amplitudeDelta) + Math.abs(m.phaseDelta) / 18 + Math.abs(m.transientDelta) * .75;
const average = (vectors: number[][]) => vectors[0]?.map((_, i) => vectors.reduce((sum, v) => sum + v[i], 0) / vectors.length) ?? [];
function inferMaterial(m: Metrics, profiles: Profile[], threshold: number) {
  if (!m.baselineReady || profiles.length < 2 || m.signal < threshold) return { label: "UNCLASSIFIED", confidence: 0 };
  const vector = featureVector(m);
  const ranked = profiles.map(p => ({ p, d: Math.sqrt(p.vector.reduce((sum, x, i) => sum + (x - vector[i]) ** 2, 0)) })).sort((a, b) => a.d - b.d);
  const nearest = ranked[0], second = ranked[1];
  return { label: MATERIALS.find(x => x.id === nearest.p.material)?.short ?? "UNCLASSIFIED", confidence: second ? clamp((1 - nearest.d / Math.max(second.d, .001)) * 100, 0, 99) : 0 };
}
function interpolateDistance(m: Metrics, anchors: DistanceAnchor[]) {
  if (anchors.length < 3 || !m.baselineReady) return null;
  const s = strengthOf(m), sorted = [...anchors].sort((a, b) => a.strength - b.strength);
  if (s <= sorted[0].strength) return sorted[0].distance;
  if (s >= sorted.at(-1)!.strength) return sorted.at(-1)!.distance;
  for (let i = 1; i < sorted.length; i++) {
    if (s <= sorted[i].strength) { const a = sorted[i - 1], b = sorted[i]; const t = (s - a.strength) / Math.max(.0001, b.strength - a.strength); return a.distance + (b.distance - a.distance) * t; }
  }
  return null;
}

function formatHz(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)} kHz` : `${Math.round(value)} Hz`;
}

export default function Home() {
  const [running, setRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState("Instrument ready");
  const [mode, setMode] = useState<Mode>("burst");
  const [frequency, setFrequency] = useState(500);
  const [power, setPower] = useState(4);
  const [gain, setGain] = useState(42);
  const [threshold, setThreshold] = useState(18);
  const [pulseRate, setPulseRate] = useState(120);
  const [pulseWidth, setPulseWidth] = useState(.9);
  const [listenDelay, setListenDelay] = useState(3);
  const [metrics, setMetrics] = useState<Metrics>(EMPTY);
  const [inputDevices, setInputDevices] = useState<Device[]>([]);
  const [outputDevices, setOutputDevices] = useState<Device[]>([]);
  const [inputId, setInputId] = useState("");
  const [outputId, setOutputId] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [captureLabel, setCaptureLabel] = useState("");
  const [distanceAnchors, setDistanceAnchors] = useState<DistanceAnchor[]>([]);
  const [distanceStep, setDistanceStep] = useState(0);
  const [logCount, setLogCount] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<AudioWorkletNode | null>(null);
  const historyRef = useRef<number[]>(Array(180).fill(0));
  const captureRef = useRef<{ type: "material" | "distance"; id: Material | number; samples: number[][] } | null>(null);
  const logRef = useRef<LogRow[]>([]);
  const sessionStartRef = useRef(0);
  const lastLogRef = useRef(0);
  const recordingRef = useRef(false);
  const profilesRef = useRef<Profile[]>([]);
  const anchorsRef = useRef<DistanceAnchor[]>([]);
  const thresholdRef = useRef(threshold);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const all = await navigator.mediaDevices.enumerateDevices();
    const inputs = all.filter(d => d.kind === "audioinput").map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Input ${i + 1}` }));
    const outputs = all.filter(d => d.kind === "audiooutput").map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Output ${i + 1}` }));
    setInputDevices(inputs); setOutputDevices(outputs);
    if (!inputId && inputs[0]) setInputId(inputs[0].deviceId);
    if (!outputId && outputs[0]) setOutputId(outputs[0].deviceId);
  }, [inputId, outputId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refreshDevices(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshDevices]);
  useEffect(() => { recordingRef.current = recording; }, [recording]);
  useEffect(() => { profilesRef.current = profiles; }, [profiles]);
  useEffect(() => { anchorsRef.current = distanceAnchors; }, [distanceAnchors]);
  useEffect(() => { thresholdRef.current = threshold; }, [threshold]);

  const config = useMemo(() => ({ mode, frequency, power, gain, threshold, pulseRate, pulseWidth, listenDelay }), [mode, frequency, power, gain, threshold, pulseRate, pulseWidth, listenDelay]);
  useEffect(() => { processorRef.current?.port.postMessage({ type: "config", config }); }, [config]);

  const classify = useCallback((m: Metrics) => {
    return inferMaterial(m, profiles, threshold);
  }, [profiles, threshold]);

  const estimateDistance = useCallback((m: Metrics) => {
    return interpolateDistance(m, distanceAnchors);
  }, [distanceAnchors]);

  const classification = classify(metrics);
  const distance = estimateDistance(metrics);

  const draw = useCallback((m: Metrics) => {
    historyRef.current = [...historyRef.current.slice(1), clamp(m.signal / 100, 0, 1)];
    const canvas = canvasRef.current; if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2), w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) { canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio); }
    const c = canvas.getContext("2d"); if (!c) return;
    c.setTransform(ratio, 0, 0, ratio, 0, 0); c.fillStyle = "#071013"; c.fillRect(0, 0, w, h);
    c.strokeStyle = "rgba(105,202,210,.10)"; c.lineWidth = 1;
    for (let x = 0; x <= w; x += w / 10) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let y = 0; y <= h; y += h / 4) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.beginPath(); c.strokeStyle = m.clipping ? "#ff6b5f" : "#78e6d5"; c.lineWidth = 2;
    historyRef.current.forEach((v, i) => {
      const x = i / (historyRef.current.length - 1) * w; const y = h - 14 - v * (h - 28);
      if (i) c.lineTo(x, y); else c.moveTo(x, y);
    }); c.stroke();
  }, []);

  const stop = useCallback(async () => {
    processorRef.current?.port.postMessage({ type: "config", config: { power: 0 } });
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (contextRef.current && contextRef.current.state !== "closed") await contextRef.current.close();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.srcObject = null; }
    contextRef.current = null; streamRef.current = null; processorRef.current = null;
    setRunning(false); setRecording(false); setMetrics(EMPTY); setStatus("Instrument stopped — drive output is zero");
  }, []);

  useEffect(() => () => { void stop(); }, [stop]);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) { setStatus("A recent Chromium browser and HTTPS or localhost are required"); return; }
    try {
      setStatus("Requesting raw audio access…");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: inputId ? { exact: inputId } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
      const context = new AudioContext({ latencyHint: "interactive" }); await context.resume();
      await context.audioWorklet.addModule("/skin-sensor-processor.js?v=1");
      const processor = new AudioWorkletNode(context, "skin-sensor-processor", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
      const source = context.createMediaStreamSource(stream); const destination = context.createMediaStreamDestination(); source.connect(processor).connect(destination);
      processor.port.onmessage = (event: MessageEvent) => {
        if (event.data?.type === "metrics") {
          const next = event.data as Metrics; setMetrics(next); draw(next);
          const capture = captureRef.current;
          if (capture && next.baselineReady && !next.clipping) {
            capture.samples.push(capture.type === "material" ? featureVector(next) : [strengthOf(next)]);
            if (capture.samples.length >= 40) {
              if (capture.type === "material") {
                const id = capture.id as Material; const profile: Profile = { material: id, vector: average(capture.samples), samples: capture.samples.length, createdAt: new Date().toISOString() };
                setProfiles(current => [...current.filter(p => p.material !== id), profile]); setStatus(`${MATERIALS.find(x => x.id === id)?.label} reference captured`);
              } else {
                const d = capture.id as number; const value = average(capture.samples)[0];
                setDistanceAnchors(current => [...current.filter(a => a.distance !== d), { distance: d, strength: value }]); setDistanceStep(current => Math.min(DISTANCES.length, current + 1)); setStatus(`${d} cm distance anchor captured`);
              }
              captureRef.current = null; setCaptureLabel("");
            }
          }
          if (recordingRef.current && performance.now() - lastLogRef.current > 200) {
            lastLogRef.current = performance.now(); const result = inferMaterial(next, profilesRef.current, thresholdRef.current); const range = interpolateDistance(next, anchorsRef.current);
            logRef.current.push({ ...next, timestamp: new Date().toISOString(), elapsed: (performance.now() - sessionStartRef.current) / 1000, classification: result.label, confidence: result.confidence, distance: range }); setLogCount(logRef.current.length);
          }
        }
        if (event.data?.type === "calibrated") setStatus("Baseline established — introduce one controlled target");
      };
      if (audioRef.current) {
        audioRef.current.srcObject = destination.stream; const media = audioRef.current as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
        if (outputId && media.setSinkId) await media.setSinkId(outputId); await media.play();
      }
      contextRef.current = context; streamRef.current = stream; processorRef.current = processor;
      processor.port.postMessage({ type: "config", config }); setRunning(true); setStatus(`Live · ${context.sampleRate / 1000} kHz DSP · baseline required`); await refreshDevices();
    } catch (error) { await stop(); setStatus(`Start failed: ${error instanceof Error ? error.message : "audio permission denied"}`); }
  };

  const calibrate = () => {
    if (!running) { setStatus("Start the instrument before calibration"); return; }
    captureRef.current = null; setCaptureLabel(""); processorRef.current?.port.postMessage({ type: "calibrate" }); setStatus("Acquiring baseline for 2 seconds — keep the sensor and cables still");
  };
  const captureMaterial = (material: Material) => {
    if (!metrics.baselineReady) { setStatus("Establish a baseline first"); return; }
    captureRef.current = { type: "material", id: material, samples: [] }; const label = MATERIALS.find(x => x.id === material)?.label ?? material; setCaptureLabel(label); setStatus(`Sampling ${label} — hold geometry and distance constant`);
  };
  const captureDistance = () => {
    if (!metrics.baselineReady) { setStatus("Establish a baseline first"); return; }
    if (distanceStep >= DISTANCES.length) { setDistanceAnchors([]); setDistanceStep(0); setStatus("Distance calibration cleared"); return; }
    const d = DISTANCES[distanceStep]; captureRef.current = { type: "distance", id: d, samples: [] }; setCaptureLabel(`${d} cm`); setStatus(`Hold the reference target at ${d} cm`);
  };
  const toggleRecording = () => {
    if (!recording) { logRef.current = []; setLogCount(0); sessionStartRef.current = performance.now(); lastLogRef.current = 0; setRecording(true); setStatus("Research session recording at 5 samples/second"); }
    else { setRecording(false); setStatus(`Session paused · ${logRef.current.length} samples retained`); }
  };
  const exportCsv = () => {
    if (!logRef.current.length) { setStatus("No session samples to export"); return; }
    const keys = Object.keys(logRef.current[0]) as (keyof LogRow)[]; const csv = [keys.join(","), ...logRef.current.map(row => keys.map(k => String(row[k] ?? "")).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); const a = document.createElement("a"); a.href = url; a.download = `sensory-skin-session-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const signalState = metrics.clipping ? "SATURATED" : !metrics.baselineReady ? "UNCALIBRATED" : metrics.signal < threshold ? "BACKGROUND" : "TARGET RESPONSE";

  return <main className="app-shell">
    <audio ref={audioRef} playsInline aria-hidden="true" />
    <header className="app-header"><div className="identity"><div className="coil-mark" aria-hidden="true">◎</div><div><p>MICROCOIL RESEARCH INSTRUMENT</p><h1>SENSORY <span>SKIN</span> LAB</h1></div></div><div className={`system-state ${running ? "live" : ""}`}><i />{running ? "ACQUISITION LIVE" : "SYSTEM STANDBY"}<small>BUILD 01 · EXPERIMENTAL</small></div></header>
    <section className="research-notice"><strong>RESEARCH DEMONSTRATOR</strong><span>Inductive and capacitive responses are environment-dependent. Classification and distance values are calibrated estimates, not verified material identification or safety certification.</span></section>
    <div className="workspace">
      <aside className="control-column">
        <section className="panel setup-panel"><PanelTitle index="01" title="Signal chain" meta="I/O" />
          <label className="select-label">SENSOR INPUT<select value={inputId} onChange={e => setInputId(e.target.value)} disabled={running}><option value="">System default input</option>{inputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}</select></label>
          <label className="select-label">EXCITATION OUTPUT<select value={outputId} onChange={e => setOutputId(e.target.value)} disabled={running}><option value="">System default output</option>{outputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}</select></label>
          <div className="mode-grid">{(["passive", "vlf", "burst"] as Mode[]).map(item => <button key={item} className={mode === item ? "active" : ""} onClick={() => { setMode(item); processorRef.current?.port.postMessage({ type: "clear-baseline" }); }}><span>{item === "passive" ? "RX" : item.toUpperCase()}</span><small>{item === "passive" ? "PASSIVE" : item === "vlf" ? "CONTINUOUS" : "PI-LIKE"}</small></button>)}</div>
          <div className="primary-actions"><button className={running ? "stop" : "start"} onClick={() => void (running ? stop() : start())}>{running ? "STOP ACQUISITION" : "START ACQUISITION"}</button><button onClick={calibrate} disabled={!running}>ZERO / BASELINE</button></div>
        </section>
        <section className="panel controls-panel"><PanelTitle index="02" title="Excitation & gain" meta="CONTROL" />
          <Slider label="CARRIER FREQUENCY" value={frequency} min={30} max={12000} step={10} display={formatHz(frequency)} onChange={setFrequency} />
          <Slider label="DRIVE LEVEL" value={power} min={0} max={30} step={1} display={`${power}%`} onChange={setPower} danger={power > 15} disabled={mode === "passive"} />
          <Slider label="RECEIVER GAIN" value={gain} min={1} max={100} step={1} display={`${gain}%`} onChange={setGain} />
          <Slider label="DETECTION THRESHOLD" value={threshold} min={1} max={80} step={1} display={`${threshold}%`} onChange={setThreshold} />
          {mode === "burst" && <div className="subcontrols"><Slider label="PULSE RATE" value={pulseRate} min={10} max={250} step={1} display={`${pulseRate} pps`} onChange={setPulseRate} /><Slider label="BURST WIDTH" value={pulseWidth} min={.2} max={5} step={.1} display={`${pulseWidth.toFixed(1)} ms`} onChange={setPulseWidth} /><Slider label="LISTEN DELAY" value={listenDelay} min={.2} max={8} step={.1} display={`${listenDelay.toFixed(1)} ms`} onChange={setListenDelay} /></div>}
        </section>
      </aside>
      <section className="instrument-column">
        <section className="panel scope-panel"><PanelTitle index="03" title="Live response" meta="20 FPS" />
          <div className="scope"><canvas ref={canvasRef} aria-label="Live normalized sensor response"/><div className="scope-readout"><span>RESPONSE</span><strong>{Math.round(metrics.signal).toString().padStart(3, "0")}</strong><small>% FS</small></div><div className={`scope-state ${metrics.clipping ? "bad" : ""}`}>{signalState}</div></div>
          <div className="feature-grid"><Metric label="AMPLITUDE Δ" value={`${metrics.amplitudeDelta >= 0 ? "+" : ""}${metrics.amplitudeDelta.toFixed(2)} dB`} level={Math.abs(metrics.amplitudeDelta) * 12} /><Metric label="PHASE SHIFT" value={`${metrics.phaseDelta >= 0 ? "+" : ""}${metrics.phaseDelta.toFixed(1)}°`} level={Math.abs(metrics.phaseDelta) * 2} /><Metric label="TRANSIENT Δ" value={`${metrics.transientDelta >= 0 ? "+" : ""}${metrics.transientDelta.toFixed(2)} dB`} level={Math.abs(metrics.transientDelta) * 12} /><Metric label="NOISE FLOOR" value={`${metrics.noiseDb.toFixed(1)} dBFS`} level={clamp(120 + metrics.noiseDb, 0, 100)} /></div>
        </section>
        <div className="result-grid">
          <section className="panel result-card classification"><PanelTitle index="04" title="Material inference" meta={`${profiles.length}/3 REFERENCES`} /><div className="classification-result"><span>CURRENT CLASS</span><strong>{classification.label}</strong><div className="confidence"><i style={{ width: `${classification.confidence}%` }} /><span>{classification.confidence.toFixed(0)}% RELATIVE CONFIDENCE</span></div></div><p className="method-note">Nearest-reference comparison of amplitude, phase, transient decay and combined response. Train with identical geometry and distance.</p><div className="capture-grid">{MATERIALS.map(m => <button key={m.id} className={profiles.some(p => p.material === m.id) ? "captured" : ""} onClick={() => captureMaterial(m.id)} disabled={!metrics.baselineReady || Boolean(captureLabel)}><i />{captureLabel === m.label ? "SAMPLING…" : `CAPTURE ${m.short}`}</button>)}</div></section>
          <section className="panel result-card proximity"><PanelTitle index="05" title="Proximity estimate" meta={`${distanceAnchors.length}/5 ANCHORS`} /><div className="distance-dial"><div><strong>{distance === null ? "—" : distance.toFixed(1)}</strong><span>cm</span></div><div className="distance-track"><i style={{ width: `${distance === null ? 0 : clamp((15 - distance) / 15 * 100, 0, 100)}%` }} /></div><small>15 CM <b>CALIBRATED RANGE</b> CONTACT</small></div><p className="method-note">Empirical interpolation against one fixed reference target. Recalibrate after changing sensor, gain, drive or environment.</p><button className="anchor-button" onClick={captureDistance} disabled={!metrics.baselineReady || Boolean(captureLabel)}>{distanceStep >= DISTANCES.length ? "RESET DISTANCE MODEL" : captureLabel ? `SAMPLING ${captureLabel}…` : `CAPTURE ${DISTANCES[distanceStep]} CM ANCHOR`}</button></section>
        </div>
      </section>
      <aside className="research-column">
        <section className="panel protocol"><PanelTitle index="06" title="Experimental protocol" meta="REQUIRED" /><ol><li><b>Stabilize.</b> Fix coil, cable and operator position.</li><li><b>Zero.</b> Capture an empty-field baseline.</li><li><b>Reference.</b> Use the same target pose and distance.</li><li><b>Replicate.</b> Repeat ≥10 trials and rotate test order.</li><li><b>Validate.</b> Test unknown objects not used for training.</li></ol><div className="quality-checks"><span className={metrics.baselineReady ? "ok" : ""}><i />BASELINE</span><span className={!metrics.clipping ? "ok" : "bad"}><i />NO CLIPPING</span><span className={profiles.length >= 2 ? "ok" : ""}><i />REFERENCES</span></div></section>
        <section className="panel session"><PanelTitle index="07" title="Research session" meta="CSV" /><div className="session-count"><strong>{logCount.toLocaleString()}</strong><span>SAMPLES IN MEMORY</span></div><button className={recording ? "recording" : ""} onClick={toggleRecording} disabled={!running}>{recording ? "PAUSE RECORDING" : "RECORD SESSION"}</button><button onClick={exportCsv} disabled={!logCount}>EXPORT DATASET (.CSV)</button><button className="quiet" onClick={() => { logRef.current = []; setLogCount(0); }} disabled={!logCount}>CLEAR SESSION</button></section>
        <section className="panel safety-panel"><PanelTitle index="08" title="Engineering limits" meta="SAFETY" /><ul><li>Use galvanically isolated, current-limited hardware.</li><li>Measure coil temperature and surface voltage before human contact.</li><li>Do not connect amplifier outputs to microphone inputs.</li><li>Not a medical device or certified robot safety sensor.</li></ul></section>
      </aside>
    </div>
    <footer><span>{status}</span><span>LOCAL PROCESSING · NO AUDIO UPLOAD · WEB AUDIO API</span></footer>
  </main>;
}

function PanelTitle({ index, title, meta }: { index: string; title: string; meta: string }) { return <div className="panel-title"><span>{index}</span><h2>{title}</h2><small>{meta}</small></div>; }
function Slider({ label, value, min, max, step, display, onChange, danger, disabled }: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (value: number) => void; danger?: boolean; disabled?: boolean }) { return <label className={`slider ${danger ? "danger" : ""} ${disabled ? "disabled" : ""}`}><span>{label}<output>{display}</output></span><input type="range" value={value} min={min} max={max} step={step} disabled={disabled} onChange={e => onChange(Number(e.target.value))} /></label>; }
function Metric({ label, value, level }: { label: string; value: string; level: number }) { return <div className="metric"><span>{label}</span><strong>{value}</strong><div><i style={{ width: `${clamp(level, 0, 100)}%` }} /></div></div>; }
