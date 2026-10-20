from pathlib import Path
import runpy,sys
sys.argv=[sys.argv[0],"--","chicken"]
runpy.run_path(str(Path(__file__).resolve().parents[4]/"scripts/wildlife/garden-build.py"),run_name="__main__")
