"""Ignored synthetic contact patches only. Not a bike, art asset or production clearance proof."""

from pathlib import Path
import bpy, json, hashlib, math

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
S = Path(__file__).parent
C = json.loads((S / "rider.json").read_text())
P = json.loads((S / C["contactProfile"]["ownCopy"]).read_text())
D = R / "data/vehicle-riders/classic-upright"
D.mkdir(parents=True, exist_ok=True)
assert (
    hashlib.sha256((S / C["contactProfile"]["ownCopy"]).read_bytes()).hexdigest()
    == C["contactProfile"]["sha256"]
)
bpy.ops.wm.read_factory_settings(use_empty=True)
mat = bpy.data.materials.new("Synthetic neutral contact fixture NOT ART")
mat.use_nodes = True
nodes = mat.node_tree.nodes
nodes.clear()
out = nodes.new("ShaderNodeOutputMaterial")
rgb = nodes.new("ShaderNodeRGB")
rgb.outputs[0].default_value = (0.27, 0.29, 0.33, 1)
mat.node_tree.links.new(rgb.outputs[0], out.inputs["Surface"])
for name, p in P["contacts"].items():
    if name.startswith("hand"):
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=12,
            radius=C["fixture"]["gripRadiusWorld"],
            depth=C["fixture"]["gripLengthWorld"],
            location=p,
            rotation=(math.pi / 2, 0, 0),
        )
    else:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(p[0], p[1], p[2] - 0.30))
        bpy.context.object.scale = (
            (4.0, 3.0, 0.60) if name.startswith("hip") else (3.6, 2.3, 0.60)
        )
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o = bpy.context.object
    o.name = "FIXTURE_" + name
    o.data.materials.append(mat)
    o["synthetic_contact_fixture_not_art"] = True
    o["contact_landmark_world"] = p
bpy.ops.export_scene.gltf(
    filepath=str(D / "synthetic-contact-fixture.glb"),
    export_format="GLB",
    export_extras=True,
    export_yup=True,
    export_materials="EXPORT",
)
(D / "fixture-recipe.json").write_text(
    json.dumps(
        {
            "status": "synthetic-contact-fixture-not-bike-not-art",
            "profileSha256": C["contactProfile"]["sha256"],
            "sourceProfile": P,
            "gripRadiusWorld": C["fixture"]["gripRadiusWorld"],
            "gripAxis": "Blender Y",
            "gripLengthWorld": C["fixture"]["gripLengthWorld"],
            "soleSupportTopIsExactLandmark": True,
            "saddleTopIsExactLandmark": True,
            "outputsStayIgnored": True,
            "glbSha256": hashlib.sha256(
                (D / "synthetic-contact-fixture.glb").read_bytes()
            ).hexdigest(),
        },
        indent=2,
    )
    + "\n"
)
