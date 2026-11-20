"""Summarize exact local candidate evidence and verified reviews for tactical 255."""
import argparse
from collections import Counter
from html import escape
import json
from pathlib import Path
import re

from wildlife_3d_review import completed_feedback

ROOT = Path(__file__).resolve().parents[2]
ROSTER = ROOT / "docs/tactical/255-wildlife-3d-model-campaign/roster.md"
DATA = ROOT / "data/wildlife-3d-campaign"


def read_optional(path):
    return json.loads(path.read_text()) if path.is_file() else {}


def verified_verdict(candidate):
    return completed_feedback(read_optional(candidate / "review-status.json"))[0]


def status_for(root, runtime_type):
    folder = root / runtime_type
    first, second = folder / "v1", folder / "v2"
    candidate = second if (second / "packet.json").is_file() else first
    packet = read_optional(candidate / "packet.json")
    if not packet:
        if any((first / f).is_file() for f in ("model.glb", "cat.glb")):
            return {"status": "capture pending"}
        return {"status": "queued"}
    verdict = verified_verdict(candidate)
    stage = (
        "meets bar" if verdict == "meets-bar" else
        "capped, open" if verdict and candidate == second else
        "revision due" if verdict else
        "review pending" if (candidate / "review.json").is_file() else
        "dispatch pending"
    )
    return {"status":stage, "verdict":verdict, "version":packet["version"], "path":candidate,
            "firstVerdict":verified_verdict(first), "evidence":packet["evidence"]}


def gallery(root, rows, counts):
    cards=[]
    for name, runtime_type, row in rows:
        if "evidence" not in row:
            continue
        name=name.split(" · Existing",1)[0].strip()
        key=escape(runtime_type)
        status=escape(row["status"])
        path=row["path"]
        relative=escape(path.relative_to(root).as_posix())
        camera=read_optional(path / "game-camera" / "packet.json")
        evidence=camera.get("evidence", row["evidence"])
        media_path=f"{relative}/game-camera" if camera else relative
        still=next((p for k,p in evidence.items() if "close-up" in k),None)
        video=next((p for p in evidence.values() if p.endswith(".mp4")),None)
        model=next((p for p in row["evidence"].values() if p.endswith(".glb")),None)
        source=next((p.name for p in path.glob("*.blend")),None)
        media=[(label,file) for label,file in evidence.items() if file.endswith(".png") and file!=still]
        links=[]
        if model:
            links.append(f'<a href="{relative}/{escape(model)}">GLB</a>')
        if source:
            links.append(f'<a href="{relative}/{escape(source)}">Blender source</a>')
        # The first pass remains directly accessible beside the revision.
        if row["version"]==2:
            old=root/runtime_type/"v1"
            old_image=next((name for name in ("appearance.png","cat-appearance.png") if (old/name).is_file()),None)
            if old_image:
                links.append(f'<a href="{key}/v1/{old_image}">First pass</a>')
        if video:
            links.append(f'<a href="{media_path}/{escape(video)}">Video file</a>')
        links.extend(f'<a href="{media_path}/{escape(file)}">{escape(label)}</a>' for label,file in media)
        if camera:
            old_still=next((p for k,p in row["evidence"].items() if "close-up" in k),None)
            old_video=next((p for p in row["evidence"].values() if p.endswith(".mp4")),None)
            if old_still:
                links.append(f'<a href="{relative}/{escape(old_still)}">Still sent to Opus</a>')
            if old_video:
                links.append(f'<a href="{relative}/{escape(old_video)}">Video sent to Opus</a>')
        cards.append(f'''
        <article data-status="{status}" data-search="{escape((name+" "+runtime_type).lower())}">
          <div class="card-head"><h2>{escape(name)}</h2><span>{status} · v{row["version"]}</span></div>
          {f'<a href="{media_path}/{escape(still)}"><img loading="lazy" src="{media_path}/{escape(still)}" alt="{escape(name)} sprite and 3D model"></a>' if still else ''}
          <details><summary>Motion and files</summary>
          {f'<video controls preload="none" data-src="{media_path}/{escape(video)}" aria-label="{escape(name)} side-by-side motion"></video>' if video else ''}
          <p class="links">{' '.join(links)}</p></details>
          {feedback_panel(root / runtime_type)}
        </article>''')
    listing="\n".join(cards)
    options="".join(f'<option value="{escape(stage)}">{escape(stage.title())} ({count})</option>'
                    for stage,count in counts.most_common() if stage not in ("queued","capture pending"))
    document=f'''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Tilefun animal models</title>
<style>
html {{color-scheme:dark}} body {{margin:0;background:#131b1e;color:#f6edda;font:16px system-ui,sans-serif}}
main {{width:min(1440px,100% - 42px);margin:44px auto}} h1 {{font-size:clamp(32px,5vw,56px);margin:0 0 6px}}
p {{color:#bdcdc4;margin:7px 0 16px}} .controls {{display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin:24px 0}}
label {{display:grid;gap:5px}} input,select {{padding:9px 11px;color:inherit;border:1px solid #516961;border-radius:6px;background:#1a292a;font:inherit}}
.cards {{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(360px,100%),1fr));gap:16px}}
article {{min-width:0;border:1px solid #40514b;background:#1b2627;border-radius:10px;overflow:hidden}}
.card-head {{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:13px 14px}}
h2 {{font-size:18px;margin:0}} .card-head span {{font-size:12px;color:#c6d8c9;text-align:right}}
img,video {{display:block;width:100%;background:#192121}} details {{padding:10px 14px}}
summary {{cursor:pointer;color:#ead9ad}} details video {{margin:10px 0}} .links {{display:flex;gap:10px;flex-wrap:wrap}}
.feedback {{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere;color:#c6d8c9}}
a {{color:#d9d0a8}} [hidden] {{display:none!important}} :focus-visible {{outline:2px solid #f1d891;outline-offset:3px}}
</style><main>
<h1>Tilefun animal models</h1><p>{len(cards)} of {len(rows)} animals have a model comparison.</p>
<div class="controls"><label>Animal<input type="search" id="query" autocomplete="off"></label>
<label>Review state<select id="status"><option value="">All reviewed and pending</option>{options}</select></label>
<p id="total" aria-live="polite"></p></div><section class="cards">{listing}</section></main>
<script>
const cards=[...document.querySelectorAll("article")];
const query=document.querySelector("#query"), status=document.querySelector("#status"), total=document.querySelector("#total");
function filter() {{
  let count=0;
  for (const card of cards) {{
    card.hidden=!(card.dataset.search.includes(query.value.trim().toLowerCase()) && (!status.value || card.dataset.status===status.value));
    if (!card.hidden) count++;
  }}
  total.textContent=`${{count}} shown`;
}}
for (const control of [query,status]) control.addEventListener("input",filter);
for (const panel of document.querySelectorAll("details")) panel.addEventListener("toggle",()=>{{
  const video=panel.querySelector("video[data-src]");
  if (panel.open && video && !video.hasAttribute("src")) video.src=video.dataset.src;
  if (!panel.open && video) video.pause();
}});
filter();</script></html>'''
    (root/"index.html").write_text(document,encoding="utf-8")


def feedback_panel(directory):
    reviews = []
    for version in ("v1", "v2"):
        verdict, notes = completed_feedback(read_optional(directory / version / "review-status.json"))
        if verdict:
            reviews.append(f"<h3>{version} · {escape(verdict)}</h3>"
                           f'<pre class="feedback">{escape(notes)}</pre>')
    if not reviews:
        return ""
    return "<details><summary>Opus review</summary>" + "".join(reviews) + "</details>"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=DATA)
    parser.add_argument("--rows", action="store_true")
    parser.add_argument("--gallery", action="store_true")
    args = parser.parse_args()
    roster = re.findall(r"^\| ([^|]+) \| `([^\x60]+)` \| \[", ROSTER.read_text(), re.M)
    assert len(roster) == len({runtime_type for _, runtime_type in roster}) == 219
    rows = [(name, runtime_type, status_for(args.data, runtime_type)) for name, runtime_type in roster]
    counts = Counter(row["status"] for _, _, row in rows)
    if args.gallery:
        gallery(args.data,rows,counts)
    print(f"{len(rows)-counts['queued']-counts['capture pending']}/{len(rows)} animal comparison packets")
    for stage, count in counts.most_common():
        print(f"{stage:<19} {count}")
    if args.rows:
        for name, runtime_type, row in rows:
            if row["status"] != "queued":
                print(f"{row['status']:<19} {runtime_type:43} {name}")


if __name__ == "__main__":
    main()
