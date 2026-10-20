from pathlib import Path
import runpy,sys
sys.argv += ["--", "piglet"]
runpy.run_path(str(Path(__file__).resolve().parents[4]/"scripts/wildlife/pasture-build.py"),run_name="__main__")
