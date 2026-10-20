from pathlib import Path
import runpy,sys
sys.argv += ['--','robin']
runpy.run_path(str(Path(__file__).resolve().parents[4]/'scripts/wildlife/meadow-build.py'),run_name='__main__')
