"""Author coats on evaluated moving anatomy and export immutable draft artifacts."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
pet_id = sys.argv[1]
batch = json.loads((ROOT / "art-source/wildlife-v2/pet-batch.json").read_text())
pet = next(p for p in batch["pets"] if p["id"] == pet_id)
species, revision = pet["species"], batch["revision"]
source = ROOT / f"art-source/wildlife-v2/{pet_id}/{revision}"
output = ROOT / f"public/demos/wildlife-v2/{pet_id}/{revision}"
original = ROOT / f"art-source/wildlife-v2/{species}/draft-v1"
code = (original / "author-masters.py").read_text(encoding="utf-8")
code = code.replace("S=Path(__file__).parent", f"S=Path({str(source)!r})")
start, end = code.index("P={"), code.index(";keys=list(P)")
palettes = {
    "cat-ginger": {"k": "#5c382a", "s": "#be7843", "c": "#deaa68", "h": "#efc88b", "w": "#f3ead6", "g": "#c8b493", "e": "#a8c76a", "p": "#d78e88", "t": "#965632"},
    "cat-black": {"k": "#171e28", "s": "#2b3341", "c": "#454e5e", "h": "#677083", "w": "#3b4352", "g": "#303849", "e": "#dfc36d", "p": "#bc828d"},
    "dog-golden": {"k": "#463328", "s": "#a67845", "b": "#cda063", "l": "#e4c28b", "w": "#dfbd84", "g": "#b3905f", "e": "#342820"},
    "dog-shepherd": {"k": "#242832", "s": "#806046", "b": "#b59160", "l": "#d1b581", "w": "#c7ad82", "g": "#967c58", "e": "#24232b"},
}
code = code[:start] + "P=" + repr(palettes[pet_id]) + code[end:]
if pet_id == "cat-ginger":
    code = code.replace("'kcsssck'", "'kctstck'").replace("'kcsssck'", "'kctstck'")
    # Stripes follow the evaluated body mask and torso landmark, not animation time.
    marker = " # Connected projected tail axis"
    stripes = """ # Stable coat stripes anchored to the torso's projected volume.
 torso=r['volumes']['torso']['bbox'];tx=round((torso[0]+torso[2])/2);ty=round(torso[1])
 if r['facing'] in ['left','right']:
  for xx in [tx-3,tx,tx+3]:
   for yy in range(ty+2,ty+5):
    if 0<=xx<48 and 0<=yy<48 and bodymask.getpixel((xx,yy)) and im.getpixel((xx,yy)) in [keys.index('s')+1,keys.index('c')+1]:im.putpixel((xx,yy),keys.index('t')+1)
 else:
  for yy in [ty+2,ty+5]:
   for xx in range(tx-2,tx+3):
    if 0<=xx<48 and 0<=yy<48 and bodymask.getpixel((xx,yy)) and im.getpixel((xx,yy)) in [keys.index('s')+1,keys.index('c')+1]:im.putpixel((xx,yy),keys.index('t')+1)
"""
    assert marker in code
    code = code.replace(marker, stripes + marker)
elif pet_id == "dog-golden":
    code = code.replace("else 'k' if n=='black-saddle'", "else 'b' if n=='black-saddle'")
elif pet_id == "dog-shepherd":
    # Keep the black saddle and darken the rear of the skull; pointed geometry
    # supplies the actual upright ears, rather than repainting drooping ears.
    code = code.replace("'bbbsssbbb'", "'bbbkkkbbb'").replace("'.bbsssbb.'", "'.bbkkkbb.'")
    code = code.replace("pendent-ear", "upright-ear")
code = code.replace(f"{species}-draft-v1-pixels-01", f"{pet_id}-{revision}-pixels-01")
code = code.replace(f"{species}-draft-v1-pixels-02", f"{pet_id}-{revision}-pixels-01")
exec(compile(code, str(original / "author-masters.py"), "exec"), {"__file__": str(source / "author.py")})
masters = json.loads((source / "masters.json").read_text())
masters["stylization"] = [
    "Natural quadruped using retained anatomy and the fixed 40-degree wildlife camera.",
    "Source-driven body rise and shoulder/pelvis weight transfer; constant-length leg solves with grounded soles.",
    "Rigid skull stabilized against torso pitch; fixed head drawing follows evaluated head translation.",
    f"Authored {pet['name']} palette/markings; all facings and idle/walk/action frames. Human review pending.",
]
(source / "masters.json").write_text(json.dumps(masters, indent=1) + "\n", encoding="utf-8")
code = (original / "finish.py").read_text(encoding="utf-8")
code = code.replace("S=Path(__file__).parent", f"S=Path({str(source)!r})")
code = code.replace(f"wildlife-v2/{species}/draft-v1", f"wildlife-v2/{pet_id}/{revision}")
code = code.replace("Natural tuxedo cat", pet["name"]).replace("Natural tricolor dog", pet["name"])
code = code.replace("duration=160,loop=0", "duration=([80]*len(fs) if 'travel' in str(p) else [80 if c=='walk' else 160 for c,i in seq]),loop=0")
exec(compile(code, str(original / "finish.py"), "exec"), {"__file__": str(source / "finish.py")})
# Generated descriptor explicitly owns timing; previews and gameplay agree.
descriptor = json.loads((output / "sprite.json").read_text())
for name, clip in descriptor["clips"].items():
    clip["frameDuration"] = 80 if name == "walk" else 160
descriptor["rootTravelPixelsPerCycle"] = 4 if species == "cat" else 6
(output / "sprite.json").write_text(json.dumps(descriptor, indent=1) + "\n", encoding="utf-8")
templates = ROOT / "art-source/wildlife-v2/pets"
(output / "playback.js").write_bytes((templates / "playback.js").read_bytes())
html = (templates / "index.html").read_text(encoding="utf-8")
html = html.replace("PET_NAME", pet["name"]).replace("REVIEW_URL", f"../../../../workshop.html#/review/pattern%3Awildlife-v2-{pet_id}-{revision}")
(output / "index.html").write_text(html, encoding="utf-8")
