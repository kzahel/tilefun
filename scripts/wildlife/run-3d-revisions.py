"""Build, capture and submit queued second candidates once each."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[2]
DATA=ROOT/"data/wildlife-3d-campaign"
MAC_BLENDER=Path("/Applications/Blender.app/Contents/MacOS/Blender")


def execute(command,log,timeout):
    with log.open("a",encoding="utf-8") as file:
        return subprocess.run(command,cwd=ROOT,stdout=file,stderr=subprocess.STDOUT,
                              timeout=timeout,check=True)


def process(blender,dest):
    if (dest/"review.json").exists():
        return "already submitted"
    first=dest.parent/"v1"
    log=dest/"pipeline.log"
    source=next((p for p in sorted(first.glob("*.blend")) if p.is_file()),None)
    if source is None:
        return "ERROR: first candidate Blender source unavailable"
    asset=dest/"model.glb"
    if not (dest/"packet.json").exists():
        execute([blender,"--background","--factory-startup","--python-exit-code","1",
                 "--python","art-source/experiments/wildlife/revise.py",
                 "--",str(source),str(dest)],log,120)
        first_art=next(iter(first.glob("*.glb")))
        if hashlib.sha256(first_art.read_bytes()).digest()==hashlib.sha256(asset.read_bytes()).digest():
            return "ERROR: model bytes match the first candidate"
        execute(["node","--import","tsx","scripts/wildlife/capture-3d-candidate.mjs",
                 str(dest/"config.json"),str(dest)],log,140)
    execute([sys.executable,"scripts/wildlife/review-3d-candidate.py","submit",str(dest)],log,90)
    return "submitted"


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workers",type=int,default=2)
    parser.add_argument("--except",dest="excluded",nargs="*",default=[])
    args=parser.parse_args()
    blender = os.environ.get("TILEFUN_BLENDER") or shutil.which("blender") or str(MAC_BLENDER)
    dests=[p.parent for p in DATA.glob("*/v2/revision.json")
           if p.parent.parent.name not in args.excluded and not (p.parent/"review.json").exists()]
    print(f"{len(dests)} second candidates eligible for Blender and review.",flush=True)
    failures=0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        lookup={pool.submit(process,blender,p):p for p in dests}
        for result in as_completed(lookup):
            dest=lookup[result]
            try:
                value=result.result()
            except (OSError, subprocess.SubprocessError) as error:
                value=f"ERROR: {error}"
            failures+=int(value.startswith("ERROR"))
            print(dest.parent.name,value,flush=True)
    if failures:
        raise SystemExit(1)


if __name__=="__main__":
    main()
