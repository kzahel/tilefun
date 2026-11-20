"""Turn a verified first review into a bounded, per-animal Blender revision brief."""
import argparse
from collections import Counter
import json
from pathlib import Path
import re

from PIL import Image
from wildlife_3d_review import completed_feedback

ROOT=Path(__file__).resolve().parents[2]
CAMPAIGN=ROOT/"data/wildlife-3d-campaign"


def feedback(path):
    verdict, notes = completed_feedback(json.loads(path.read_text()))
    return notes if verdict == "revise" else None


def current_palette(packet, config):
    image=Image.open(ROOT/packet["sprite"]).convert("RGBA")
    sprite=Path(packet["sprite"])
    meta=ROOT/sprite.with_name("sprite.json")
    if sprite.name=="sheet.png" and meta.is_file():
        data=json.loads(meta.read_text())
        w=data.get("frameWidth",48)
        h=data.get("frameHeight",48)
    else:
        count=(packet.get("runtimeClips") or [{},{}])[1].get("count",4)
        w=image.width//count
        h=image.height if config.get("classicTravel") in ("swim",) or sprite.stem.startswith("pigeon") else (
            image.height//2 if sprite.stem in ("chicken","cow") else image.height//4)
    row=3 if image.height>=h*4 else 0
    crop=image.crop((0,row*h,w,(row+1)*h))
    colors=Counter((r,g,b) for r,g,b,a in crop.get_flattened_data() if a>222)
    return [list(rgb) for rgb,hits in colors.most_common(10) if hits>1]


def brief_for(raw, packet, config):
    priority=re.split(r"(?i)highest[- ]impact fix[^\n]*?:",raw,maxsplit=1)[-1].strip().lstrip("* ")
    target=(priority if len(priority)<2400 else raw)[:2600]
    lower=target.lower()
    shape={}
    notes=[]
    def flag(*terms):
        return any(term in lower for term in terms)
    def add(key,value,summary):
        shape[key]=value
        notes.append(summary)

    if flag("widen the body","broader body","rounder","make the torso wider","widen the torso",
            "widen the shell","broaden the body","more compact","skinny","narrow body","thin body"):
        add("width",1.13,"widen the body cross-section")
    if flag("flatter","lower profile","lower the back","lower the body","less tall","shorter and broader"):
        add("height",.89,"lower the whole silhouette")
    elif flag("taller","raise the body","lift the body","higher shoulders","lengthen the legs","longer legs"):
        add("height",1.12,"raise the upper silhouette above standing contact")
    if flag("shorten the body","shorter body","shorten the torso","less elongated","shorten the body plan","shorter"):
        add("length",.91,"reduce front-to-back length")
    elif flag("lengthen the body","longer body","lengthen the torso","longer torso","lengthen the back","longer silhouette"):
        add("length",1.12,"extend the body length")
    if flag("longer legs","lengthen the legs","raise the body","more clearance","belly clearance","daylight"):
        add("trunkDepth",.84,"open space under the belly")
    if flag("bigger head","enlarge the head","larger head","widen the head","broader head","thicker head","more head mass","clearer head","head a distinct","wider block"):
        add("head",1.17,"strengthen head mass")
    elif flag("smaller head","shrink the head","smaller eyes","lower-profile head","less rounded head"):
        add("head",.89,"reduce the head volume")
    if flag("longer snout","lengthen the muzzle","longer muzzle","longer bill","extend the bill","bigger beak","longer beak","tapered snout","taper the muzzle","heavier dark bill","heavier bill"):
        add("front",1.15,"extend the muzzle or bill")
    if re.search(r"\b(?:ears?|crest|comb|tufts?|crown|horns?|antlers?)\b",lower):
        ear= .82 if flag("shorten the ears","smaller ears","less pink","shrink the ear","shorter ear") else 1.14
        add("ear",ear,"adjust the profile of the ears, crest or crown")
    if flag("thicken the legs","thicker legs","paws","feet","foot contact","thicker limbs","splay the legs","splay the feet"):
        add("limbs",1.18,"make the feet and limb edges easier to read")
    if flag("darken the paws","darker feet","dark feet","dark legs","legs and feet darker","dark-tipped feet"):
        add("extremities","dark","separate the dark feet from the body")
    elif flag("lighter hooves","lighter feet","white paws","white feet"):
        add("extremities","light","pick out the feet in the lighter sprite tone")
    if flag("tail","fluke","fork"):
        tail=.83 if flag("shorter tail","shorten the tail","reduce the tail","shorten the fluke","tail a short") else 1.19
        add("tail",tail,"give the tail its requested silhouette")
    if flag("shorten the pectoral","smaller fins","reduce the fins","tuck the fins","shorter flippers"):
        add("wings",.84,"tuck the fins against the body")
    elif flag("larger wings","wider wings","broader wings","wing area","wing span","broad wings","large fins","larger fins","bigger flippers"):
        add("wings",1.23,"increase the visible wing or fin surface")
    if flag("more pronounced","exaggerate","slower","make the motion","ground contact","move more","movement","steps","head dip","stride","pounce","flap","gait","stroke","pulse"):
        add("motion",1.28,"clarify the existing keyed travel and action")
    if flag("darken the body","darken the coat","darker body","darker coat","less pale","too pale"):
        add("tone",-.073,"deepen coat values")
    elif flag("lighten the body","lighter body","too dark","less dark","more cream","cream/pale yellow"):
        add("tone",.048,"lift coat values")
    if flag("outline","dark edge","dark rim","heavier rim","value contrast","contrast","dark markings"):
        add("contrast",1.20,"separate coat and contour values")
    if flag("dark outline","darker outline","black outline","rim only","stronger outline"):
        add("outline",.031,"restore the sprite’s narrow dark contour")
    if flag("white band behind","white collar","pale collar","pale neck band","white neck ring"):
        add("paintRegion","collar","paint the light neck band from the sprite")
    elif flag("white bib","pale breast","white chest","pale chin","lighter muzzle","cream chest"):
        add("paintRegion","bib","strengthen the chest or muzzle patch")
    elif flag("make the back and wings cream","dark cap","darker back","dark close to the sprite"):
        add("paintRegion","pale-back" if flag("cream") else "dark-back","raise the back marking into the game camera")
    elif flag("larger brown/tan patches","larger spots","dark side bars","wider bands","clearer stripes","larger black spots"):
        add("paintRegion","patches","group the larger coat markings on the flanks")
    if not shape:
        add("motion",1.19,"increase the readable pose change")
        add("contrast",1.14,"match the reference’s palette contrast")
    shape["palette"]=current_palette(packet,config)
    return {"feedback":target,"changes":notes,"shape":shape}


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--limit",type=int)
    ap.add_argument("--update-unsubmitted",action="store_true")
    args=ap.parse_args()
    count=0
    for original in sorted(CAMPAIGN.glob("*/v1")):
        v2=original.parent/"v2"
        if (not (original/"review-status.json").is_file() or
            v2.exists() and (not args.update_unsubmitted or (v2/"review.json").exists() or
                             not (v2/"revision.json").exists())):
            continue
        raw=feedback(original/"review-status.json")
        if not raw:
            continue
        config=json.loads((original/"config.json").read_text())
        packet=json.loads((original/"packet.json").read_text())
        brief=brief_for(raw,packet,config)
        v2.mkdir(exist_ok=args.update_unsubmitted)
        with (v2/"revision.json").open("w" if args.update_unsubmitted else "x") as handle:
            json.dump(brief,handle,indent=2,ensure_ascii=False)
        config["version"]=2
        config["model"]="model.glb"
        config["fit"]=packet.get("fit") or config.get("fit")
        config["autoFit"]=False
        config["reviewContext"]=(
            "Final planned candidate. V1's highest-impact note is preserved in the local revision brief. "
            "This pass targeted "+", ".join(brief["changes"])+
            ". Compare this exact candidate against the active sprite and report any remaining quality gap. "
            "The first candidate images and completed review remain retained in the adjacent v1 folder."
        )
        (v2/"config.json").write_text(json.dumps(config,indent=2,ensure_ascii=False)+"\n")
        print(v2)
        count+=1
        if args.limit is not None and count>=args.limit:
            break


if __name__=="__main__":
    main()
