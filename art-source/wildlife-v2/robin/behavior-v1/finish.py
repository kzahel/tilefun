from pathlib import Path
import runpy,sys
sys.argv = [sys.argv[0],'robin']
runpy.run_path(str(Path(__file__).resolve().parents[4]/'scripts/wildlife/meadow-finish.py'),run_name='__main__')
