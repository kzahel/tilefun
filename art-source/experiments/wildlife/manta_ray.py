"""The manta's continuous fin surface, paired feeding lobes and tail."""
import math

from wildlife_build import CatSurface, V, aimed, euler, transform

NAME = "Manta Ray"
DURATIONS = {"idle": 48, "swim": 31, "action": 19, "flee": 16}
PALETTE = {
    "ink": "142a31", "edge": "1b3841", "back": "244650", "highlight": "355862",
    "flank": "486773", "belly": "bfcebd", "cream": "e3dfc2", "eye": "0c1b20",
}
BODY = V((0, 0, .39))
TAIL = V((0, -.75, .35))
SIDES = (("L", -1), ("R", 1))


def wing_joints(sign):
    return [V((sign*x,y,z)) for x,y,z in ((.27,.06,.39),(.94,-.07,.355),(1.92,-.245,.32))]


def lobe_points(sign):
    return [V((sign*x,y,z)) for x,y,z in ((.245,.62,.36),(.252,.915,.35),(.175,1.126,.419))]


def joints():
    bones = [("body",BODY,BODY+V((0,.44,0)),None),
             ("tail",TAIL,TAIL+V((0,-1.18,.03)),"body")]
    for name, sign in SIDES:
        root, elbow, tip = wing_joints(sign)
        base, _, lobe_tip = lobe_points(sign)
        wing = "wing." + name
        bones.extend(((wing,root,elbow,"body"),("tip."+name,elbow,tip,wing),
                      ("lobe."+name,base,lobe_tip,"body")))
    return bones


def skin(p, n):
    if n.z < -.31:
        return "belly"
    if p.y > .32 and .14 < abs(p.x) < .32 and n.z > .40:
        return "cream" if p.y > .48 else "flank"
    if abs(p.x) > 1.55 or n.z < .12:
        return "edge"
    return "highlight" if n.dot(V((-.34,.30,.85))) > .89 else "back"


def surface():
    s = CatSurface()
    s.start("Continuous swept diamond")
    # Each section crosses both faces and tapers toward the trailing edge.
    sections = [
        (0,.70,-.94,.225),(.21,.696,-.88,.211),(.32,.664,-.77,.164),
        (.49,.603,-.66,.125),(.71,.49,-.60,.087),(.96,.37,-.53,.063),
        (1.24,.224,-.48,.042),(1.49,.053,-.43,.031),(1.72,-.084,-.39,.023),
        (1.89,-.184,-.334,.012),(1.95,-.23,-.285,.005),
    ]
    span = [(-x,lead,trail,camber) for x,lead,trail,camber in reversed(sections[1:])] + sections
    rings = []
    for x, lead, trail, camber in span:
        middle = (lead+trail)/2
        chord = (lead-trail)/2
        eased = abs(x)
        suffix = "L" if x < 0 else "R"
        wing = "wing." + suffix
        tip = "tip." + suffix
        wing_weight = min(1,max(0,(eased-.22)/.35))
        tip_weight = min(1,max(0,(eased-.71)/.51))
        weights = {"body":1-wing_weight,wing:wing_weight*(1-tip_weight),tip:wing_weight*tip_weight}
        ring = []
        for i in range(24):
            theta = math.tau*i/24
            y = middle - chord*math.cos(theta)
            z = .375 - eased*.039 + camber*math.sin(theta)*(1+.32*math.cos(theta))
            ring.append(V((x,y,z)))
        rings.append((ring,weights))
    s.rings(rings,skin)

    s.start("Wide mouth")
    s.ellipsoid(V((0,.681,.314)),(.200,.058,.054),"body",lambda p,n:"ink",sides=16,steps=8)
    s.ellipsoid(V((0,.664,.266)),(.202,.054,.029),"body",lambda p,n:"belly",sides=16,steps=6)
    for suffix, sign in SIDES:
        s.start("Feeding lobe "+suffix)
        base, curve, tip = lobe_points(sign)
        name = "lobe." + suffix
        s.tube([(base,.098,.085,{name:1}),(curve,.087,.064,{name:1}),
                (tip,.039,.040,{name:1})],
               lambda p,n:"cream" if n.z>.33 else "edge",sides=12)
        eye = V((sign*.323,.585,.432))
        s.ellipsoid(eye,(.068,.071,.058),"body",lambda p,n:"eye",sides=11,steps=7)
        s.ellipsoid(eye+V((sign*.038,.033,.021)),(.023,.024,.022),"body",
                    lambda p,n:"cream",sides=9,steps=5)
    s.start("Long tapered whip tail")
    s.tube([(TAIL,.079,.058,{"tail":1}),
            (TAIL+V((0,-.39,-.012)),.050,.041,{"tail":1}),
            (TAIL+V((0,-.93,.037)),.029,.025,{"tail":1}),
            (TAIL+V((.038,-1.33,.072)),.012,.013,{"tail":1})],
           lambda p,n:"flank" if n.z>.61 else "edge",sides=9)
    return s


def pose(_, rest, clip, t):
    phase = math.tau*t
    active = clip in ("swim", "flee")
    panic = clip == "flee"
    feeding = math.sin(math.pi*t)**2 if clip == "action" else 0
    bob = math.sin(phase)*(.090 if panic else .049 if active else .020)
    pitch = .080*math.sin(phase) - .23*feeding - .09*panic
    roll = math.sin(phase)*(.14 if panic else .046 if active else .021)
    q = euler(pitch,roll,0)
    body = transform(q,BODY,BODY+V((0,.061*feeding,bob)))
    out = {"body":body @ rest["body"]}
    amplitude = .57 if panic else .39 if active else .095
    for suffix, sign in SIDES:
        shoulder, elbow, tip = wing_joints(sign)
        offset = sign*(.37 if panic else .10)
        stroke = math.sin(phase+offset) + .20*math.sin(phase*2-.64)*panic
        distal = math.sin(phase+offset-.71)
        shoulder_q = q @ euler(0,-sign*(amplitude*stroke+.15*feeding),.021*sign*stroke)
        tip_q = q @ euler(0,-sign*(amplitude*1.24*distal+.28*feeding),.043*sign*distal)
        start = body @ shoulder
        middle = start + shoulder_q @ (elbow-shoulder)
        end = middle + tip_q @ (tip-elbow)
        wing = "wing."+suffix
        end_name = "tip."+suffix
        out[wing] = aimed(rest[wing],start,middle)
        out[end_name] = aimed(rest[end_name],middle,end)
        lobe, _, _ = lobe_points(sign)
        name = "lobe."+suffix
        lobe_q = q @ euler(-.37*feeding,.038*sign*math.cos(phase),-sign*.24*feeding)
        out[name] = transform(lobe_q,lobe,body @ lobe) @ rest[name]
    tail_q = q @ euler(.12*math.sin(phase-.9),0,(.22 if panic else .086)*math.sin(phase-.81))
    out["tail"] = transform(tail_q,TAIL,body @ TAIL) @ rest["tail"]
    return out
