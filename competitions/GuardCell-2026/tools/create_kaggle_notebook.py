"""Build a standalone Kaggle notebook from the exact GuardCell source files.

The generated notebook is fully self-contained, offline, standard-library only,
and recreates both fault-injection tests and the HTML scenario demonstration.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KERNEL_ID = 'franciscoangulo/guardcell-safe-vlm-robot-handoffs-2026'

def markdown(text: str) -> dict:
    return {'cell_type':'markdown','metadata':{},'source':text.splitlines(True)}

def code(text: str) -> dict:
    return {'cell_type':'code','execution_count':None,'metadata':{},'outputs':[],'source':text.splitlines(True)}

def generate() -> Path:
    cells=[markdown('''# GuardCell | Deterministic Safety, Local Vision Handoffs

**Entry to Build with AI — Smart Automation, Robotics, and Vision (GDG Windsor / DataRealm).**

Industrial automation prototype built for reproducibility. **This notebook executes synthetic visual scenarios and synthetic model fixtures, not a real Gemma 3 model or physical robot.** It implements a real, optional localhost-only adapter for Gemma 3/Ollama, which requires a separate model installation and is not benchmarked here.

Full source, tests, benchmark and fault-injection audit are generated in the next cells. No internet or external datasets are needed.

Safety notice: This is a simulator, NOT a certified human detector or industrial robot controller.
'''),
      code('from pathlib import Path\nPath("tests").mkdir(exist_ok=True)\nprint("Preparing complete GuardCell source files")\n')]
    for f in ('guardcell.py','demo.py','benchmark.py','tests/test_guardcell.py'):
        cells.append(markdown(f'## Source: `{f}`\nFull original code, written to disk by the following cell.\n'))
        cells.append(code(f'%%writefile {f}\n'+(ROOT/f).read_text(encoding='utf-8')))
    cells.extend([
      markdown('## Verification: 27 automated tests\nAll scenarios are synthetic; no physical safety guarantee follows from passing the tests.\n'),
      code('import subprocess,sys\nresult=subprocess.run([sys.executable,"-m","unittest","discover","-s","tests","-v"],capture_output=True,text=True)\nprint(result.stdout);print(result.stderr[-10000:])\nassert result.returncode==0, "Unit tests failed"\n'),
      markdown('## Reproducible benchmark: 1,000 fault-injection cases\nReports **CPU policy tick only**, not model inference or robot actuation.\n'),
      code('from benchmark import run_benchmark\nfrom pathlib import Path\nimport json\nimport subprocess,sys\nr=subprocess.run([sys.executable,"benchmark.py","--samples","1000","--seed","2601113","--output","output/benchmark.json"],capture_output=True,text=True)\nprint(r.stdout or r.stderr)\nassert r.returncode==0, "Benchmark failed"\n'),
      markdown('## Fault-injection visual demo and audit trail\nThe HTML visual replay uses synthetic images and fixtures.\n'),
      code('import subprocess,sys\nr=subprocess.run([sys.executable,"demo.py"],capture_output=True,text=True)\nprint(r.stdout or r.stderr)\nassert r.returncode==0, "Demo failed"\nfrom IPython.display import display,HTML\nfrom pathlib import Path\nprint("Replay gallery: output/demo/index.html")\nprint("Audit log: output/demo/audit.json")\n'),
      markdown('''## What the simulation demonstrates

- **30-point architecture:** independent sensor interlocks / stop latch / freshness guard / strict typed perception / deterministic routing. Model-generated free text is never executed as a motor command.
- **25-point deployment:** stdlib-only offline path; separate optional Gemma 3 vision via localhost Ollama; no cloud dependencies for the demonstrated tests.
- **25-point industrial execution:** simulated defect sorting with explicit GOOD/REWORK action enum, replayable hazards and failure records. Not a real robot.
- **20-point communication:** auditable decision traces, runnable tests, seed-locked benchmark, short simulation video and a plain-English project report in the submission.

**Safety and transparency:** No real person detector, autonomous robot, connected camera, energy savings or certified physical industrial safeguard is claimed. The 1,000 cases are simulations, not field trials.

Author: Francisco Angulo de Lafuente (ORCID 0009-0001-1634-7063). Original source MIT-licensed.
''')
    ])
    for i,c in enumerate(cells):
        c['id']=hashlib.sha1(f'guardcell-kaggle-{i}'.encode()).hexdigest()[:8]
    notebook={'cells':cells,'metadata':{'kernelspec':{'display_name':'Python 3','language':'python','name':'python3'},'language_info':{'name':'python'}},'nbformat':4,'nbformat_minor':5}
    out=ROOT/'GuardCell_Kaggle.ipynb'
    out.write_text(json.dumps(notebook,ensure_ascii=False,indent=1)+'\n',encoding='utf-8')
    meta={'id':KERNEL_ID,'title':'GuardCell | Safe Local Vision and Deterministic Robot Handoffs','code_file':out.name,'language':'python','kernel_type':'notebook','is_private':False,'enable_gpu':False,'enable_internet':False,'dataset_sources':[],'competition_sources':['build-with-ai-smart-automation-robotics-and-vision'],'kernel_sources':[]}
    (ROOT/'kernel-metadata.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8')
    return out

if __name__=='__main__':
    print(generate())
