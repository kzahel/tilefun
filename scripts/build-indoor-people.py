"""Extract source-only indoor role sheets. Normal builds consume the committed PNGs."""
import hashlib
import json
from pathlib import Path
from PIL import Image

source = Path("assets/interiors/2_Characters/Old/Single_Characters_Legacy/16x16")
output = Path("public/assets/sprites/indoor")
output.mkdir(parents=True, exist_ok=True)
roles = {
    "reader": ("Molly", "Molly_reading_16x16.png", 16, 32, 18),
    "diner": ("Alex", "Alex_sit3_16x16.png", 16, 32, 6),
    "cleaner": ("Cleaner_girl", "Cleaner_girl_clean_16x16.png", 16, 48, 17),
    "chef": ("Chef_Lucy", "Chef_Lucy_idle_anim_16x16.png", 16, 32, 6),
}
manifest = {}
for role, (person, action_file, fw, fh, count) in roles.items():
    walk_file = source / f"{person}_16x16.png"
    walk = Image.open(walk_file).convert("RGBA")
    action_path = source / action_file
    action = Image.open(action_path).convert("RGBA")
    # A fixed transparent frame allows a mop to extend below the feet. The
    # runtime's +16px draw offset keeps every person's feet on its ground anchor.
    sheet = Image.new("RGBA", ((6 + count) * 32, 4 * 64))
    for direction, group in enumerate([3, 1, 2, 0]):
        for frame in range(6):
            sx = (group * 6 + frame) * 16
            sheet.paste(walk.crop((sx, 32, sx + 16, 64)), (frame * 32 + 8, direction * 64 + 16))
        for frame in range(count):
            group = [0, 0, 1, 0][direction] if role == "diner" else ([3, 1, 2, 0][direction] if role == "chef" else 0)
            sx = (group * count + frame) * fw
            sheet.paste(action.crop((sx, 0, sx + fw, fh)), ((6 + frame) * 32 + 8, direction * 64 + 16))
    path = output / f"{role}.png"
    sheet.save(path)
    manifest[role] = {
        "walk": str(walk_file), "action": str(action_path), "actionFrames": count,
        "sourceHashes": [hashlib.sha256(p.read_bytes()).hexdigest() for p in [walk_file, action_path]],
        "outputHash": hashlib.sha256(path.read_bytes()).hexdigest(),
    }
(output / "sources.json").write_text(json.dumps(manifest, indent=2) + "\n")
