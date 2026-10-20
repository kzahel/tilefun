"""Package reviewed paint atlases and exact cardinal fallbacks; no Blender/build regeneration.

python scripts/vehicle-bake/export-paints.py [--check] [--output-root data/...]
"""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
STUDY = ROOT / "public/demos/original-vehicles/paint-study-v1"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--output-root", type=Path, default=ROOT)
    args = parser.parse_args()
    output = args.output_root.resolve()
    assert output == ROOT or output.is_relative_to(ROOT / "data")
    study = json.loads((STUDY / "study.json").read_bytes())
    catalog = {"version": 1, "families": {}}
    inputs, outputs = {}, {}

    def source(path):
        data = path.read_bytes()
        inputs[path.relative_to(ROOT).as_posix()] = sha(data)
        return data

    def emit(path, data):
        target = output / path
        if args.check:
            assert target.read_bytes() == data, f"Paint asset drift: {path}"
        elif target.exists():
            assert target.read_bytes() == data, f"Immutable runtime asset exists: {path}"
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        outputs[path] = sha(data)

    source(Path(__file__))
    source_config = json.loads(source(ROOT / "scripts/vehicle-bake/paint-variants-v1.json"))
    source(STUDY / "study.json")
    for row in study["candidates"]:
        directory = STUDY / row["id"]
        frozen = json.loads(source(directory / "review-manifest.json"))["candidates"][0]
        pins = {f["url"]: f["sha256"] for f in frozen["files"]}

        def reviewed(path):
            data = source(path)
            assert sha(data) == pins[path.relative_to(ROOT / "public").as_posix()]
            return data

        atlas = reviewed(directory / "atlas.png")
        assert sha(reviewed(directory / "model.glb")) == row["glbSha256"]
        image = Image.new("RGBA", (192, 224 * 4))
        n = row["nativeSize"]
        for frame_row, heading in enumerate([4, 12, 8, 0]):
            path = directory / f"captures/engine-{heading}.png"
            reviewed(path)
            with Image.open(path) as frame:
                assert frame.size == (n, n)
                box = frame.getbbox()
                assert box
                x, y = 96 - n // 2 + box[0], 144 - n // 2 + box[1]
                assert 0 <= x and x + box[2] - box[0] <= 192
                assert 0 <= y and y + box[3] - box[1] <= 224
                image.paste(frame.crop(box), (x, frame_row * 224 + y))
        import io
        buffer = io.BytesIO()
        image.save(buffer, format="PNG", compress_level=9)
        stem = f"assets/vehicles/paint-v1/{row['family']}-{row['scheme']['id']}"
        emit("public/" + stem + "-atlas.png", atlas)
        emit("public/" + stem + ".png", buffer.getvalue())
        scheme = {"id": row["scheme"]["id"], "name": row["scheme"]["name"],
                  "atlas": stem + "-atlas.png", "sprite": stem + ".png",
                  "swatches": row["scheme"]["swatches"], "weight": {
                      "beetle": {"butter": 3, "forest": 1},
                      "pickup": {"teal": 3, "cherry": 3},
                      "rosso-coupe": {"cherry": 4, "navy-stripes": 1},
                  }[row["family"]].get(row["scheme"]["id"], 2),
                  "reviewId": row["id"]}
        catalog["families"].setdefault(row["family"], {
            "defaultWeight": 4 if row["family"] == "rosso-coupe" else 2,
            "defaultSwatches": [source_config["families"][row["family"]]["paintColors"][3]],
            "schemes": []})["schemes"].append(scheme)
    content = (json.dumps(catalog, indent=2) + "\n").encode()
    emit("src/traffic/vehicle-paints-v1.json", content)
    receipt = {"schema": "tilefun-vehicle-paint-runtime-v1", "inputs": inputs, "outputs": outputs,
               "frames": ["south=90", "north=270", "west=180", "east=0"],
               "registration": "192x224 frames at ground (96,144); transparent padding only; no resampling",
               "geometry": "Existing runtime GLBs retained; runtime swaps one cached atlas per draw",
               "authorization": "2026-10-20 owner: great make them work in game! proceed. commit. push when done."}
    path = output / "art-source/vehicle-bake/paint-runtime/v1/receipt.json"
    data = (json.dumps(receipt, indent=2) + "\n").encode()
    if args.check:
        assert path.read_bytes() == data
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    print("14 reviewed paint atlases + 14 exact cardinal fallbacks: " + ("verified" if args.check else "packaged"))


if __name__ == "__main__":
    main()
