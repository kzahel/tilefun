from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).resolve().parents[2]/"_families/ground-specialists-147/build.py"),init_globals={"SPECIES":"giant-anteater"})
