"""Exercise immutable reference registration and reject provenance tampering."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from PIL import Image
from reference import digest, name

script = Path(__file__).with_name("reference.py")
with tempfile.TemporaryDirectory() as temporary:
    bundle = Path(temporary)
    image = Image.new("RGBA", (32, 32))
    image.paste((50, 130, 30, 255), (8, 8, 24, 24))
    image.save(bundle / "source.png")
    image.save(bundle / "generated.png")
    (bundle / "prompt.txt").write_text("Solid tree hypothesis")
    entry = {"id": "oak-tree", "input": "source.png", "cropSha256": digest(bundle / "source.png"), "cropRgbaSha256": "test-only"}
    (bundle / "inputs.json").write_text(json.dumps({"inputs": [entry]}))

    def run(*arguments, succeeds=True):
        result = subprocess.run([sys.executable, str(script), "--bundle", str(bundle), *arguments], capture_output=True, text=True)
        assert (result.returncode == 0) == succeeds, result.stderr

    run("prepare", "--asset", "oak-tree", "--id", "test", "--prompt", str(bundle / "prompt.txt"))
    saved_prompt = bundle / "references/test/prompt.txt"
    saved_prompt.write_text("tampered")
    run("register", "--id", "test", "--image", str(bundle / "generated.png"), succeeds=False)
    assert not (bundle / "references/test/reference.json").exists()
    saved_prompt.write_text("Solid tree hypothesis")
    run("register", "--id", "test", "--image", str(bundle / "generated.png"))
    run("register", "--id", "test", "--image", str(bundle / "generated.png"), succeeds=False)
    run("downsample", "--parent", "test", "--id", "small", "--max-side", "16")
    assert Image.open(bundle / "references/small/reference.png").size == (16, 16)
    image.paste((255, 0, 0, 255), (0, 0, 2, 2))
    image.save(bundle / "references/test/reference.png")
    run("downsample", "--parent", "test", "--id", "tampered", "--max-side", "16", succeeds=False)
for invalid in ["", "..", "a/b", "a\\b"]:
    try:
        name(invalid)
    except Exception:
        pass
    else:
        raise AssertionError("Unsafe reference ID accepted")
print("Reference request/image tampering and duplicate registration rejected; derived output provenance passes")
