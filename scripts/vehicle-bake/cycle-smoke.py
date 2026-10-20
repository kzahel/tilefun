"""Static motorcycle-v1 controls on true synthetic two/three-wheel GLBs, ignored outputs only.

No browser is launched by default. Actual shared CarMeshAsset qualification is
pending parent loader release; no raw GLTF render substitutes for that branch.
Synthetic controls are not production art, rider qualification or catalog entries.
"""

import argparse
import copy
import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]


def module(name, filename):
    spec = importlib.util.spec_from_file_location(
        name, Path(__file__).with_name(filename)
    )
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def replace_json(raw, gltf):
    size = struct.unpack_from("<I", raw, 12)[0]
    chunks = raw[20 + size :]
    data = json.dumps(gltf, separators=(",", ":")).encode()
    data += b" " * ((-len(data)) % 4)
    return (
        struct.pack("<III", 0x46546C67, 2, 20 + len(data) + len(chunks))
        + struct.pack("<II", len(data), 0x4E4F534A)
        + data
        + chunks
    )


def generate(folder):
    import bpy, math

    for ids in [["F", "R"], ["F", "R", "SC"]]:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        label = "two" if len(ids) == 2 else "three"
        out = folder / label
        out.mkdir(parents=True)
        image = bpy.data.images.new(
            "Opaque512_control_atlas", width=512, height=512, alpha=True
        )
        image.pixels = [0.34, 0.64, 0.45, 1.0] * (512 * 512)
        image.filepath_raw = str(out / "atlas.png")
        image.file_format = "PNG"
        image.save()
        image.pack()
        mat = bpy.data.materials.new("Synthetic_unlit_nearest")
        mat.use_nodes = True
        mat.node_tree.nodes.clear()
        tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = image
        tex.interpolation = "Closest"
        output = mat.node_tree.nodes.new("ShaderNodeOutputMaterial")
        mat.node_tree.links.new(tex.outputs["Color"], output.inputs["Surface"])
        root = bpy.data.objects.new("Motorcycle_Root", None)
        bpy.context.scene.collection.objects.link(root)
        root["tilefun_motorcycle"] = 1

        def cube(name, location, scale):
            bpy.ops.mesh.primitive_cube_add(size=1, location=location)
            o = bpy.context.object
            o.name = name
            o.scale = scale
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            o.data.materials.append(mat)
            o.parent = root

        cube("Body_static", (0, 0, 1.25), (2.2, 0.55, 0.3))
        if "SC" in ids:
            cube("Sidecar_fixed_body", (0.1, 1.2, 0.95), (0.8, 0.55, 0.25))
        for wid in ids:
            x, y, r = (
                (-1.2, 0, 0.35)
                if wid == "F"
                else (1.1, 0, 0.45) if wid == "R" else (0.1, 1.2, 0.30)
            )
            steer = bpy.data.objects.new("Wheel_" + wid + "_Steer", None)
            bpy.context.scene.collection.objects.link(steer)
            steer.parent = root
            steer.location = (x, y, r)
            steer["steering_enabled"] = wid == "F"
            roll = bpy.data.objects.new("Wheel_" + wid + "_Roll", None)
            bpy.context.scene.collection.objects.link(roll)
            roll.parent = steer
            roll["wheel_radius"] = r * 80 / 4.6
            roll["roll_axis_gltf"] = [0, 0, -1]
            bpy.ops.mesh.primitive_cylinder_add(
                vertices=32, radius=r, depth=0.2, rotation=(math.pi / 2, 0, 0)
            )
            o = bpy.context.object
            o.name = "Actual_cycle_tire_" + wid
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
            o.parent = roll
            o.location = (0, 0, 0)
            o.data.materials.append(mat)
        root.scale = (80 / 4.6,) * 3
        bpy.ops.object.select_all(action="SELECT")
        model = out / "model.glb"
        bpy.ops.export_scene.gltf(
            filepath=str(model),
            export_format="GLB",
            use_selection=True,
            export_extras=True,
            export_yup=True,
        )
        # glTF JSON has an actual string-array declaration. Blender custom props
        # cannot portably retain string arrays across supported exporter versions.
        raw = model.read_bytes()
        size = struct.unpack_from("<I", raw, 12)[0]
        g = json.loads(raw[20 : 20 + size])
        roots = [n for n in g["nodes"] if n.get("name") == "Motorcycle_Root"]
        assert len(roots) == 1
        roots[0].setdefault("extras", {})["wheel_ids"] = ids
        model.write_bytes(replace_json(raw, g))
        write(
            out / "report.json",
            {
                "status": "complete",
                "method": "Synthetic actual two/three-wheel tooling control only; not production art or human approval.",
            },
        )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--blender", required=True)
    parser.add_argument("--name")
    args = parser.parse_args()
    run = json.loads((ROOT / "data/vehicle-bake/autonomous-153/run.json").read_text())
    assert not run["stopRequested"] and datetime.datetime.now(
        datetime.timezone.utc
    ) < datetime.datetime.fromisoformat(
        run["deadline"].replace("Z", "+00:00")
    ), "Run stopped/deadline"
    name = args.name or "static-" + str(time.time_ns())
    assert Path(name).name == name
    folder = ROOT / "data/vehicle-bake/cycle-tooling" / name
    assert not folder.exists(), "Fresh output name required"
    folder.mkdir(parents=True)
    command = [
        args.blender,
        "--background",
        "--factory-startup",
        "--threads",
        "4",
        "--python-exit-code",
        "1",
        "--python",
        str(Path(__file__).resolve()),
        "--",
        "--generate",
        str(folder),
    ]
    with (folder / "generate.log").open("w", encoding="utf-8") as log:
        subprocess.run(
            command,
            cwd=ROOT,
            stdout=log,
            stderr=subprocess.STDOUT,
            check=True,
            timeout=60,
        )
    audit = module("cycle_smoke_catalog", "catalog-cycle.py")
    package = module("cycle_smoke_package", "family-package-cycle.py")
    outcomes = []
    negative_rows = []
    base_hashes = {}
    for label, ids in [("two", ["F", "R"]), ("three", ["F", "R", "SC"])]:
        model = folder / label / "model.glb"
        raw = model.read_bytes()
        base_hashes[label] = sha(model)
        good = audit.audit_glb(model, ids)
        write(folder / label / "audit.json", good)
        assert list(good["wheels"]) == ids and good["meshes"] == len(ids) + (
            2 if label == "three" else 1
        )
        manifest = folder / label / "clearance-input.json"
        proof = folder / label / "clearance.json"
        write(
            manifest,
            {
                "candidates": [
                    {
                        "id": label,
                        "toolchain": "motorcycle-v1",
                        "wheelIds": ids,
                        "input": model.relative_to(ROOT).as_posix(),
                    }
                ]
            },
        )
        cmd = command[: command.index("--python") + 1] + [
            str(Path(__file__).with_name("clearance-cycle.py")),
            "--",
            str(manifest),
            str(proof),
        ]
        with (folder / label / "clearance.log").open("w", encoding="utf-8") as log:
            subprocess.run(
                cmd,
                cwd=ROOT,
                stdout=log,
                stderr=subprocess.STDOUT,
                check=True,
                timeout=60,
            )
        clear = json.loads(proof.read_text())[0]
        assert (
            clear["status"] == "passed"
            and len(clear["clearance"]) == len(ids)
            and len(clear["perWheelCollisionControls"]) == len(ids)
        )
        assert all(
            c["collidingBodyRejected"] and c["baselineRestored"]
            for c in clear["perWheelCollisionControls"]
        )
        outcomes.append({"inventory": ids, "audit": good, "clearance": clear})
        # Exercise old package injection in a miniature public/ repo wholly under
        # ignored data. Nothing is prepared in the real public/source trees.
        stage = folder / label / "package-stage"
        (stage / "public/demos/vehicle-bake/control").mkdir(parents=True)
        for n in ["model.glb", "atlas.png", "report.json"]:
            shutil.copyfile(
                folder / label / n, stage / "public/demos/vehicle-bake/control" / n
            )
        for n in ["family-review.html", "family-review.css"]:
            dst = stage / "scripts/vehicle-bake" / n
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(Path(__file__).with_name(n), dst)
        cfg = {
            "id": label,
            "clearanceId": label,
            "name": "Synthetic true cycle " + label,
            "title": "Control only",
            "toolchain": "motorcycle-v1",
            "wheelIds": ids,
            "source": "public/demos/vehicle-bake/control",
            "output": "public/demos/original-vehicles/control",
            "qa": "data/qa",
            "offline": "data/review.html",
            "nativeSize": 224,
        }
        pkg = package.load_package(cfg)
        pkg.ROOT = stage
        pkg.prepare(cfg)
        prepared = json.loads((stage / cfg["qa"] / "clearance-input.json").read_text())[
            "candidates"
        ][0]
        assert prepared["wheelIds"] == ids and prepared["toolchain"] == "motorcycle-v1"
        failed = False
        try:
            pkg.freeze(cfg)
        except (AssertionError, FileNotFoundError):
            failed = True
        assert (
            failed and not (stage / cfg["output"] / "review-manifest.json").exists()
        ), "Pending capture cannot freeze"
        capture_cfg = folder / label / "pending-config.json"
        write(
            capture_cfg,
            {**cfg, "qa": (folder / label / "pending-qa").relative_to(ROOT).as_posix()},
        )
        with (folder / label / "pending-capture.log").open(
            "w", encoding="utf-8"
        ) as log:
            pending = subprocess.run(
                [
                    "node",
                    str(Path(__file__).with_name("family-capture-cycle.mjs")),
                    str(capture_cfg),
                ],
                cwd=ROOT,
                stdout=log,
                stderr=subprocess.STDOUT,
                timeout=30,
            )
        assert pending.returncode == 2
        pending_receipt = json.loads(
            (
                ROOT
                / json.loads(capture_cfg.read_text())["qa"]
                / "cycle-capture-pending.json"
            ).read_text()
        )
        assert pending_receipt["status"] == "pending-shared-loader"
        assert not (
            ROOT / json.loads(capture_cfg.read_text())["qa"] / "browser-qa.json"
        ).exists()
        # Each mutation starts with the actual independent synthetic GLB.
        _, g = audit.read_glb(model)

        def index(g, name):
            return next(i for i, n in enumerate(g["nodes"]) if n.get("name") == name)

        def detach(g, i):
            for n in g["nodes"]:
                if i in n.get("children", []):
                    n["children"].remove(i)

        def add_clone(g, i):
            n = copy.deepcopy(g["nodes"][i])
            n["children"] = [add_clone(g, c) for c in n.get("children", [])]
            new = len(g["nodes"])
            g["nodes"].append(n)
            return new

        mutations = {}
        for value in [None, 0, 2, True, "1"]:

            def f(g, value=value):
                g["nodes"][index(g, "Motorcycle_Root")].setdefault("extras", {})[
                    "tilefun_motorcycle"
                ] = value

            mutations["marker-" + str(value)] = f
        for value in [0, -1, True, "1", float("inf"), float("nan")]:

            def f(g, value=value):
                g["nodes"][index(g, "Wheel_F_Roll")]["extras"]["wheel_radius"] = value

            mutations["radius-" + str(value)] = f
        for value in [[0, 0, 0], [0, 1, 0], [0, 0], [0, 0, float("nan")], "wrong"]:

            def f(g, value=value):
                g["nodes"][index(g, "Wheel_F_Roll")]["extras"]["roll_axis_gltf"] = value

            mutations["axis-" + str(value)] = f
        mutations["missing-marker"] = lambda g: g["nodes"][index(g, "Motorcycle_Root")][
            "extras"
        ].pop("tilefun_motorcycle")
        mutations["misnamed-root"] = lambda g: g["nodes"][
            index(g, "Motorcycle_Root")
        ].update(name="WrongRoot")
        mutations["missing-inventory"] = lambda g: g["nodes"][
            index(g, "Motorcycle_Root")
        ]["extras"].pop("wheel_ids")
        mutations["wrong-root-inventory"] = lambda g: g["nodes"][
            index(g, "Motorcycle_Root")
        ]["extras"].update(wheel_ids=["FL", "FR", "RL", "RR"])
        mutations["duplicate-root-inventory"] = lambda g: g["nodes"][
            index(g, "Motorcycle_Root")
        ]["extras"].update(wheel_ids=["F", "R", "R"])
        mutations["missing-wheel"] = lambda g: detach(g, index(g, "Wheel_R_Steer"))
        mutations["empty-wheel"] = lambda g: g["nodes"][
            index(g, "Wheel_F_Roll")
        ].update(children=[])
        mutations["misnamed-steer"] = lambda g: g["nodes"][
            index(g, "Wheel_F_Steer")
        ].update(name="WrongSteer")

        def wrong_parent(g):
            i = index(g, "Wheel_F_Roll")
            detach(g, i)
            g["nodes"][index(g, "Motorcycle_Root")]["children"].append(i)

        mutations["wrong-parent"] = wrong_parent

        def outside(g):
            i = index(g, "Wheel_F_Steer")
            detach(g, i)
            g["scenes"][g.get("scene", 0)]["nodes"].append(i)

        mutations["outside-root"] = outside

        def duplicate_roll(g):
            g["nodes"][index(g, "Wheel_F_Steer")]["children"].append(
                add_clone(g, index(g, "Wheel_F_Roll"))
            )

        mutations["duplicate-roll"] = duplicate_roll

        def duplicate_steer(g):
            g["nodes"][index(g, "Motorcycle_Root")]["children"].append(
                add_clone(g, index(g, "Wheel_F_Steer"))
            )

        mutations["duplicate-steer"] = duplicate_steer

        def duplicate_root(g):
            g["scenes"][g.get("scene", 0)]["nodes"].append(
                add_clone(g, index(g, "Motorcycle_Root"))
            )

        mutations["duplicate-root"] = duplicate_root

        def boat(g):
            g["nodes"][index(g, "Motorcycle_Root")]["extras"]["tilefun_watercraft"] = 1

        mutations["boat-cycle-ambiguity"] = boat

        def extra(g):
            i = add_clone(g, index(g, "Wheel_F_Steer"))
            g["nodes"][i]["name"] = "Wheel_EXTRA_Steer"
            roll = g["nodes"][i]["children"][0]
            g["nodes"][roll]["name"] = "Wheel_EXTRA_Roll"
            g["nodes"][index(g, "Motorcycle_Root")]["children"].append(i)

        mutations["extra-wheel"] = extra
        for key, mutate in mutations.items():
            bad = copy.deepcopy(g)
            mutate(bad)
            path = folder / label / "negative" / f"{len(negative_rows):03d}.glb"
            path.parent.mkdir(exist_ok=True)
            path.write_bytes(replace_json(raw, bad))
            rejected = False
            try:
                audit.audit_glb(path, ids)
            except (AssertionError, KeyError, ValueError, IndexError):
                rejected = True
            assert rejected, "Accepted " + key
            negative_rows.append(
                {
                    "fixture": label,
                    "case": key,
                    "rejected": True,
                    "input": path.relative_to(ROOT).as_posix(),
                }
            )
        for wrong in [
            [],
            ["F"],
            ["F", "R", "R"],
            ["R", "F"],
            ["FL", "FR", "RL", "RR"],
            ["F", "R", "SC"] if len(ids) == 2 else ["F", "R"],
        ]:
            rejected = False
            try:
                audit.audit_glb(model, wrong)
            except AssertionError:
                rejected = True
            assert rejected
            negative_rows.append(
                {
                    "fixture": label,
                    "case": "config-inventory",
                    "declared": wrong,
                    "rejected": True,
                }
            )
        # A positive but geometrically wrong radius passes structural audit and
        # MUST fail the independent actual decoded-cylinder measurement.
        bad = copy.deepcopy(g)
        bad["nodes"][index(bad, "Wheel_F_Roll")]["extras"]["wheel_radius"] *= 1.1
        badpath = folder / label / "wrong-positive-radius.glb"
        badpath.write_bytes(replace_json(raw, bad))
        audit.audit_glb(badpath, ids)
        negative_manifest = folder / label / "wrong-radius-input.json"
        write(
            negative_manifest,
            {
                "candidates": [
                    {
                        "id": label + "-bad-radius",
                        "toolchain": "motorcycle-v1",
                        "wheelIds": ids,
                        "input": badpath.relative_to(ROOT).as_posix(),
                    }
                ]
            },
        )
        wrong_proof = folder / label / "wrong-radius-proof.json"
        cmd[-2:] = [str(negative_manifest), str(wrong_proof)]
        with (folder / label / "wrong-radius.log").open("w", encoding="utf-8") as log:
            result = subprocess.run(
                cmd, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, timeout=60
            )
        assert (
            result.returncode != 0
            and json.loads(wrong_proof.read_text())[0]["status"] == "failed"
        )
        assert sha(model) == base_hashes[label]
    write(folder / "negative-controls.json", negative_rows)
    receipt = {
        "status": "static-ready-browser-pending",
        "syntheticControlsOnly": True,
        "actualFixtures": outcomes,
        "negativeAuditControlsRejected": len(negative_rows),
        "positiveButWrongRadiusRejectedByDecodedGeometry": 2,
        "packageAuditInjectionAndPendingFreezeRejection": True,
        "capturePendingExit2NoBrowserReceipts": True,
        "actualSharedLoaderQualification": "pending-parent-release",
        "browserLaunched": False,
        "normalCatalogActivated": False,
        "noFakeFourCornerStubs": True,
        "outputs": folder.relative_to(ROOT).as_posix(),
    }
    write(folder / "receipt.json", receipt)
    write(
        ROOT / "data/vehicle-bake/cycle-tooling/latest.json",
        {
            "status": receipt["status"],
            "receipt": (folder / "receipt.json").relative_to(ROOT).as_posix(),
        },
    )
    print(
        json.dumps(
            {
                "status": receipt["status"],
                "auditNegatives": len(negative_rows),
                "actualInventories": [["F", "R"], ["F", "R", "SC"]],
                "receipt": (folder / "receipt.json").relative_to(ROOT).as_posix(),
            }
        )
    )


if __name__ == "__main__":
    if "--generate" in sys.argv:
        generate(Path(sys.argv[sys.argv.index("--generate") + 1]))
    else:
        main()
