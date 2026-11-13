"""Reproducibly generate an honest visual summary of the synthetic simulator.

The generated media are not footage of physical robots or real Gemma inference.
"""

from __future__ import annotations

from pathlib import Path
import json
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from guardcell import Action, GuardCellController, SCENARIOS, encode_png, synthetic_frame, synthetic_inspection

C = {"bg": "#0B1525", "panel": "#14263B", "line": "#2C4660", "text": "#EDF3F9",
     "muted": "#A6BDD0", "mint": "#7FE2C5", "orange": "#EDC06A", "red": "#FA8F98"}


def font(size: int, bold: bool = False):
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for path in paths:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def cover() -> None:
    image = Image.new("RGB", (1600, 900), C["bg"])
    d = ImageDraw.Draw(image)
    for y in range(900):
        d.line((0, y, 1600, y), fill=(11, 21 + y // 70, 37 + y // 40))
    d.rounded_rectangle((55, 52, 385, 112), radius=18, fill="#1D3C52")
    d.text((80, 66), "GDG WINDSOR  /  2026", font=font(25, True), fill=C["mint"])
    d.text((58, 145), "GuardCell", font=font(126, True), fill=C["text"])
    d.text((64, 320), "AI CAN OBSERVE.", font=font(54, True), fill=C["mint"])
    d.text((64, 385), "ONLY POLICY CAN ACT.", font=font(54, True), fill=C["text"])
    d.text((65, 490), "An auditable boundary between local visual reasoning", font=font(29), fill=C["muted"])
    d.text((65, 537), "and deterministic industrial workcell decisions.", font=font(29), fill=C["muted"])
    labels = [(60, "SENSORS"), (425, "LOCAL VLM"), (790, "CONTRACT GATE"), (1155, "POLICY TREE")]
    for x, text in labels:
        d.rounded_rectangle((x, 675, x + 320, 770), radius=16,
                            fill=C["panel"], outline=C["line"], width=3)
        d.text((x + 26, 706), text, font=font(25, True), fill=C["text"])
        if x < 1155:
            d.line((x + 325, 722, x + 357, 722), fill=C["mint"], width=5)
            d.polygon(((x + 357, 722), (x + 347, 712), (x + 347, 732)), fill=C["mint"])
    d.text((62, 814), "OFFLINE   •   INSPECTABLE   •   FAIL-CLOSED", font=font(27, True), fill=C["mint"])
    d.text((1125, 824), "SIMULATED WORKCELL", font=font(18), fill=C["orange"])
    image.save(ROOT / "assets" / "cover.png", optimize=True)


def demo_video() -> None:
    """Produce an MP4 using OpenCV (optional media generation dependency)."""
    import cv2
    import numpy as np

    width, height, fps = 1280, 720, 15
    raw_file = ROOT / "assets" / "guardcell_simulation_demo_raw.mp4"
    writer = cv2.VideoWriter(str(raw_file), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
    if not writer.isOpened():
        raise RuntimeError("OpenCV MP4 encoder is unavailable")

    def slide(title: str, subtitle: str, body: list[str], scenario: str | None = None,
              action: str | None = None, cause: str = "") -> Image.Image:
        im = Image.new("RGB", (width, height), C["bg"])
        draw = ImageDraw.Draw(im)
        draw.rounded_rectangle((40, 33, 435, 75), radius=15, fill="#1D3C52")
        draw.text((60, 45), "GUARDCELL  /  2026   |   SIMULATION", font=font(16, True), fill=C["mint"])
        draw.text((40, 102), title, font=font(47, True), fill=C["text"])
        draw.text((42, 176), subtitle, font=font(24), fill=C["muted"])
        if scenario:
            source = synthetic_frame(scenario)
            sim_im = Image.frombytes("RGB", (source.width, source.height), source.rgb)
            sim_im = sim_im.resize((640, 480), Image.Resampling.NEAREST)
            im.paste(sim_im, (42, 220))
            draw = ImageDraw.Draw(im)
            draw.rounded_rectangle((716, 240, 1220, 620), radius=20, fill=C["panel"])
            shade = C["red"] if action == "EMERGENCY_STOP" else C["orange"] if action == "HOLD" else C["mint"]
            draw.text((755, 273), "POLICY DECISION", font=font(20, True), fill=C["muted"])
            draw.text((754, 332), action or "", font=font(29, True), fill=shade)
            for i, line in enumerate([cause[i:i + 38] for i in range(0, len(cause), 38)][:4]):
                draw.text((756, 400 + 37 * i), line, font=font(22), fill=C["text"])
            draw.text((755, 582), "No physical robot connected", font=font(16), fill=C["muted"])
        else:
            for i, line in enumerate(body):
                draw.text((60, 254 + i * 56), line, font=font(28), fill=C["mint"] if i % 2 == 0 else C["text"])
        return im

    try:
        scenes = [
            (slide("AI sees. Policy decides.", "An offline-first industrial control experiment",
                   ["Deterministic safety interlocks always run first.",
                    "VLM suggestions are inspected and validated.",
                    "No model text can command actuators."]), 4),
        ]
        for name in SCENARIOS:
            ctrl = GuardCellController()
            out = ctrl.tick(synthetic_frame(name), synthetic_inspection(name))
            subtitle = "Synthetic VLM fixture — not learned model inference"
            scenes.append((slide(name.replace("_", " ").title(), subtitle, [],
                                 name, out.action.value, out.cause), 2))
        scenes.append((slide("27 tests passed • 1,000 policy scenarios", "Reproducible simulation, NOT a safety certification",
                             ["0 prohibited simulated actions under test assumptions.",
                              "Gemma 3 local vision interface supplied separately.",
                              "Run the full benchmark and examine JSON traces."]), 4))
        for pil_image, seconds in scenes:
            frame_bgr = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
            for _ in range(fps * seconds):
                writer.write(frame_bgr)
    finally:
        writer.release()
    # Keep one machine-playable file; H264 re-encoding is optional.
    print(f"Generated {raw_file} ({raw_file.stat().st_size:,} bytes)")


if __name__ == "__main__":
    cover()
    demo_video()
