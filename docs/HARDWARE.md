# Hardware Research Notes

## Sensor element

A thin multi-turn copper coil can be embedded in a flexible polymer, but fabrication must preserve conductor insulation, turn spacing, strain tolerance, and stable geometry. Ordinary fused-filament printers cannot generally print medical-grade silicone and bare copper wire as one certified structure. Practical prototypes may use a printed flexible carrier, wound enamelled copper, and a separately cast silicone encapsulant.

Record the conductor, insulation, diameter, turn count, DC resistance, coil dimensions, inductance, self-resonant frequency, encapsulant, bend radius, strain cycles, and temperature rise.

## Recommended signal chain

~~~text
isolated TX DAC -> current limiter -> TX coil
RX coil -> protection -> differential low-noise preamplifier -> anti-alias filter -> ADC
~~~

Shared TX/RX hardware is possible only with a designed transmit/receive switch, receiver blanking, clamping, and recovery-time characterization. Do not tie an amplifier and microphone input together.

## Array development

Start with one element and characterize repeatability before building an array. Measure mutual coupling and scan channels sequentially or use synchronized multi-channel acquisition. Store per-element calibration because silicone deformation, routing, and adjacent coils will change the response.

## Robot integration

Microcoil inference should complement, not replace, contact-force, joint-torque, vision, and certified safety functions. Human-contact validation requires conservative electrical and thermal limits plus independent emergency-stop behavior.
