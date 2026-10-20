"""Family-only formatting and syntax receipts. No global checks or Git."""

from pathlib import Path
import hashlib
import json
import py_compile
import subprocess

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
S = Path(__file__).parent
D = ROOT / "data/vehicle-bake/retro-scooter"
cache = D / "py-cache"
cache.mkdir(exist_ok=True)
files = sorted(p for p in S.iterdir() if p.is_file())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
before = {p.relative_to(ROOT).as_posix(): sha(p) for p in files}
for p in files:
    if p.suffix == ".py":
        py_compile.compile(str(p), cfile=str(cache / (p.name + "c")), doraise=True)
commands = [["python", "-m", "black", "--check", str(S)]]
mjs = [p for p in files if p.suffix == ".mjs"]
commands += [["node", "--check", str(p)] for p in mjs]
commands += [
    [
        str(ROOT / "node_modules/.bin/biome.cmd"),
        "check",
        *[str(p) for p in files if p.suffix in [".mjs", ".json"]],
    ]
]
rows = []
for command in commands:
    run = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    rows.append(
        {
            "command": command,
            "exitCode": run.returncode,
            "output": run.stdout + run.stderr,
        }
    )
    assert run.returncode == 0, rows[-1]
assert before == {p.relative_to(ROOT).as_posix(): sha(p) for p in files}
(D / "scoped-checks.json").write_text(
    json.dumps(
        {
            "status": "passed",
            "scope": "own family sources only",
            "commands": rows,
            "sourceHashes": before,
            "pythonSyntaxCompiledOnlyIntoOwnIgnoredScratch": True,
            "globalChecksRun": False,
            "gitUsed": False,
        },
        indent=2,
    )
    + "\n"
)
print(
    json.dumps(
        {
            "status": "passed",
            "files": len(files),
            "scope": "retro-scooter only",
        }
    )
)
