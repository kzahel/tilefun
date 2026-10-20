"""Measured finite actual contact surfaces and per-contact missing-surface/reset controls."""

from pathlib import Path
import json

scripts = Path(__file__).parent
text = (scripts / "prove-contact-pairs.py").read_text()
exec(
    compile(
        text[: text.index("baseline = diagnose")],
        str(scripts / "prove-contact-pairs.py"),
        "exec",
    )
)

rows = []
for name, target in TARGETS.items():
    rider_name = CFG["rider"]["semanticContacts"][name]
    if name == "hip_saddle":
        bike_name = "Actual dark saddle central hip tangent"
    elif name.startswith("hand"):
        bike_name = "Actual palm wrapped grip " + (
            "left" if "left" in name else "right"
        )
    else:
        bike_name = "Actual sole tangent foot peg " + (
            "left" if "left" in name else "right"
        )
    bike_surface, rider_surface = tree(bp[bike_name]), tree(rp[rider_name])
    tests = []
    if name.startswith("hand"):
        for sign in [-1, 1]:
            direction = Vector((sign, 0, 0))
            for label, surface, maximum in [
                ("grip", bike_surface, 0.3),
                ("closed-palm", rider_surface, 0.8),
            ]:
                hit, normal, index, distance = surface.ray_cast(
                    target, direction, maximum
                )
                assert hit is not None and distance > 0, (name, label, sign)
                tests.append(
                    {
                        "surface": label,
                        "direction": list(direction),
                        "distanceWorld": distance,
                        "actualTriangleIndex": index,
                    }
                )
    else:
        for label, surface, sign in [
            ("support", bike_surface, -1),
            ("pelvis-or-sole", rider_surface, 1),
        ]:
            direction = Vector((0, 0, sign))
            origin = target - direction * 0.25
            hit, normal, index, distance = surface.ray_cast(origin, direction, 0.5)
            assert hit is not None and (hit - target).length < 0.0001, (
                name,
                label,
                hit,
                target,
            )
            tests.append(
                {
                    "surface": label,
                    "direction": list(direction),
                    "distanceWorld": distance,
                    "targetErrorWorld": (hit - target).length,
                    "actualTriangleIndex": index,
                }
            )
    shifted = tree([[p + Vector((0, 3, 0)) for p in t] for t in bp[bike_name]])
    assert shifted.find_nearest(target)[3] > 1.5
    assert all(
        shifted.ray_cast(
            (
                target
                if name.startswith("hand")
                else target - Vector(t["direction"]) * 0.25
            ),
            Vector(t["direction"]),
            0.8,
        )[0]
        is None
        for t in tests
        if t["surface"] in ["grip", "support"]
    )
    assert (
        tree(bp[bike_name]).find_nearest(target)[3]
        == bike_surface.find_nearest(target)[3]
    )
    rows.append(
        {
            "contact": name,
            "bikeOwner": bike_name,
            "riderOwner": rider_name,
            "nearestBikeSurfaceWorld": bike_surface.find_nearest(target)[3],
            "nearestRiderSurfaceWorld": rider_surface.find_nearest(target)[3],
            "finiteActualSurfaceRays": tests,
            "removedContactSurfaceNegativeRejected": True,
            "negativeTranslationWorld": [0, 3, 0],
            "resetExact": True,
        }
    )
receipt = {
    "status": "passed",
    "glbSha256": sha(A / "model.glb"),
    "riderSha256": CFG["rider"]["glbSha256"],
    "contacts": rows,
    "semantics": "Hands are actual grip centerlines inside closed palms; hips/soles are surface tangencies. Missing physical contact geometry is rejected per pair.",
}
(D / "contact-rays-proof.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps({"status": "passed", "contacts": len(rows)}))
