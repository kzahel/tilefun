from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).resolve().parents[2]/"_families/reptile-hunters-147/build.py"),init_globals={"SPECIES":"alligator"})
