from pathlib import Path
root=Path(__file__).resolve().parents[4]
path=root/"scripts/wildlife/threat-build.py"
exec(compile(path.read_text(encoding="utf8"), str(path), "exec"), {**globals(), "__file__": str(path)})
