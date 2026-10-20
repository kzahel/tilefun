"""Actual decoded control connections and fuel-tank clearance, with negative/reset."""

from pathlib import Path
import json

SCRIPTS = Path(__file__).parent
text = (SCRIPTS / "prove-contact-pairs.py").read_text()
exec(
    compile(
        text[: text.index("baseline = diagnose")],
        str(SCRIPTS / "prove-contact-pairs.py"),
        "exec",
    )
)

tank = bp["Rounded teal tank actual cream side UV panels"]
tt = tree(tank)
names = ["Headstock to actual grip riser"] + [
    f"Swept control riser segment {i}" for i in range(1, 5)
]
route = [Vector(p) * S for p in CFG["controlVariant"]["riserPolylineSource"]]


def overlap(a, b):
    at, bt = tree(a), tree(b)
    hits = sum(bool(intersections(a[i], b[j])) for i, j in at.overlap(bt))
    containment = sum(inside(p, bt) for p in unique(a)) + sum(
        inside(p, at) for p in unique(b)
    )
    return {"surfaceTrianglePairs": hits, "containedVertices": containment}


connections = []
for i, name in enumerate(names):
    own = tree(bp[name])
    gaps = [own.find_nearest(p)[3] for p in route[i : i + 2]]
    assert max(gaps) < 0.0001, (name, gaps)
    connections.append({"component": name, "endpointSurfaceGapsWorld": gaps})
fork = tree(bp["Twin front fork stanchion 1"])
assert fork.find_nearest(route[0])[3] < 0.0001
bar = tree(bp["Actual connected handlebar centerline"])
assert inside(route[-1], bar) or bar.find_nearest(route[-1])[3] < 0.0001
brackets = []
for side, sign in [("left", -1), ("right", 1)]:
    target = TARGETS[f"foot_{side}_support"]
    start = Vector(CFG["controlVariant"]["pegBracketStartSource"]) * S
    start.y *= sign
    end = Vector(
        (
            target.x,
            sign * CFG["controlVariant"]["pegInnerY"] * S,
            target.z - CFG["controlVariant"]["pegRadius"] * S,
        )
    )
    owner = "Connected high peg bracket " + side
    bracket = tree(bp[owner])
    assert max(bracket.find_nearest(p)[3] for p in [start, end]) < 0.0001
    engine = tree(bp["Exposed dark gray crankcase rounded block"])
    assert inside(start, engine) or engine.find_nearest(start)[3] < 0.0001
    peg = tree(bp["Actual sole tangent foot peg " + side])
    assert peg.find_nearest(end)[3] < 0.0001
    hand = TARGETS[f"hand_{side}_grip"]
    join = Vector(
        (
            hand.x,
            sign * (abs(hand.y) - CFG["controlVariant"]["gripHalfLength"] * S),
            hand.z,
        )
    )
    grip = tree(bp["Actual palm wrapped grip " + side])
    assert max(bar.find_nearest(join)[3], grip.find_nearest(join)[3]) < 0.0001
    brackets.append(
        {
            "side": side,
            "bracketCrankcaseConnected": True,
            "bracketPegConnected": True,
            "barGripConnected": True,
        }
    )
controls = names + [
    "Actual connected handlebar centerline",
    "Connected high peg bracket left",
    "Connected high peg bracket right",
]
baseline = {n: overlap(bp[n], tank) for n in controls}
assert all(not any(row.values()) for row in baseline.values()), baseline
negative = [[p + Vector((0, -0.19 * S, -0.18 * S)) for p in t] for t in bp[names[1]]]
failed = overlap(negative, tank)
assert any(failed.values()), failed
assert baseline == {n: overlap(bp[n], tank) for n in controls}
receipt = {
    "status": "passed",
    "glbSha256": sha(A / "model.glb"),
    "riderSha256": CFG["rider"]["glbSha256"],
    "actualDecodedSourceOwnerMapping": True,
    "riserEndpointConnections": connections,
    "forkCrownStemConnected": True,
    "stemCrossbarConnected": True,
    "bracketGripConnections": brackets,
    "actualTankClearance": baseline,
    "loweredRiserTankNegative": {
        "translationSource": [0, -0.19, -0.18],
        **failed,
        "rejected": True,
        "resetExact": True,
    },
    "limits": "Static mechanical source fit only; no operating steering or road qualification",
}
(D / "mechanics-proof.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps(receipt))
