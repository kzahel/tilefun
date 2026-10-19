from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).resolve().parents[2]/"_families/amphibious-mammals-147/finish.py"),init_globals={"SPECIES":"sea-lion"})
