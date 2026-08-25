# Paper source

This directory contains the arXiv-oriented LaTeX source for the Sensory Skin Lab methods paper.

## Build

```bash
pdflatex main.tex
bibtex main
pdflatex main.tex
pdflatex main.tex
```

The manuscript distinguishes qualitative pilot observations from planned confirmatory experiments. It includes a proposed uncertainty-aware multitask system for target-response classification, 0--15 cm proximity, contact detection, normal force, contact area, and average pressure, together with an instrumented calibration protocol. No quantitative performance claim is made without a traceable dataset.

## Submission note

Before arXiv submission, the author should confirm affiliation, contact details, license, category, and replace the prospective validation section with results only after the described controlled study is completed.
