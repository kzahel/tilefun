from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).resolve().parents[2]/"_families/patterned-grazers-140/audit.py"),init_globals={"SPECIES":"okapi"})
