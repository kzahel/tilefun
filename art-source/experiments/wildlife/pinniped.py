"""Editable harbor seal, sea lion and walrus rigs for shore and water motion."""
import math

from wildlife_build import CatSurface, V, aimed, euler, transform

# Body span and mass, resting head, eye/muzzle color, land gait.
PROFILES = {
    "harbor-seal": ("Harbor Seal", 1.62, .48, .45, .56,
                    "3e4946 65716a 889388 495953 a6ad99 cac9af 243531 151e1d b7b59d",
                    "haul"),
    "sea-lion": ("California Sea Lion", 1.42, .49, .59, 1.18,
                 "4c3d2e 796144 a8865b 5b4836 a18b67 d2b889 342c24 191c1b ccb693",
                 "walk"),
    "walrus": ("Walrus", 1.54, .65, .71, .94,
               "504337 796557 9a8470 635648 b1a18a d0bc9f 4f4034 211f19 e7dfc0",
               "walk"),
}

SIDES = (("L", -1), ("R", 1))
SUN = V((-.42, .32, .83)).normalized()
NAME = PALETTE = DURATIONS = SPECIES = GAIT = None
SPAN = WIDTH = MASS = None
HIP_CENTER = CHEST = HEAD = None
FORE = HIND = None


def configure(species):
    global NAME, PALETTE, DURATIONS, SPECIES, GAIT, SPAN, WIDTH, MASS
    global HIP_CENTER, CHEST, HEAD, FORE, HIND
    SPECIES = species
    NAME, SPAN, WIDTH, MASS, head_z, colors, GAIT = PROFILES[species]
    PALETTE = dict(zip(("dark", "coat", "key", "spot", "belly", "muzzle", "fin", "eye", "ivory"),
                       colors.split()))
    DURATIONS = {"idle": 48, GAIT: 31, "swim": 31, "action": 25, "flee": 16, "flee-swim": 16}
    HIP_CENTER = V((0, -.29 * SPAN, MASS * .89))
    CHEST = V((0, .21 * SPAN, MASS * 1.11))
    HEAD = V((0, .66 * SPAN, head_z))
    FORE = {}
    HIND = {}
    for suffix, sign in SIDES:
        FORE[suffix] = (
            V((sign * WIDTH * .67, CHEST.y + .14, MASS * .73)),
            V((sign * (WIDTH + .23), CHEST.y + .37, .105)),
        )
        hip = V((sign * WIDTH * .45, -.78 * SPAN, MASS * .48))
        # The true seal's rear limbs stay behind it ashore. Sea lions and
        # walruses can turn their feet under their hindquarters.
        HIND[suffix] = (
            hip,
            V((sign * (WIDTH + .04), hip.y + (-.49 if species == "harbor-seal" else .24), .105)),
        )


def joints():
    bones = [
        ("body", HIP_CENTER, HIP_CENTER + V((0, .55, 0)), None),
        ("chest", CHEST, HEAD, "body"),
        ("head", HEAD, HEAD + V((0, .39, .06)), "chest"),
    ]
    for suffix, _ in SIDES:
        bones.extend((
            (f"fore.{suffix}", *FORE[suffix], "chest"),
            (f"hind.{suffix}", *HIND[suffix], "body"),
        ))
    return bones


def paint(point, normal):
    side = normal.x * point.x
    low = point.z < MASS * .63
    if low and point.y > -.91 * SPAN:
        return "belly" if side > WIDTH * .18 or normal.z < -.22 else "coat"
    if SPECIES == "harbor-seal":
        # Broken pairs of small spots along the flank and dorsal line.
        u = ((point.y * 4.8) % 1) - .5
        v = ((point.z * 7.6 + point.x * 5.7 + math.floor(point.y * 4.8) * .63) % 1) - .5
        if 0.18 < point.z and u*u + v*v < .062:
            return "spot"
    light = normal.dot(SUN)
    return "key" if light > .52 else "dark" if light < -.45 else "coat"


def flipper_paint(_, normal):
    return "coat" if normal.dot(SUN) > .36 else "fin"


def surface():
    s = CatSurface()
    s.start("Weighted barrel and raised chest")
    rings = []
    for y, rx, rz in (
        (-1.01,.08,.12),(-.92,.32,.37),(-.76,.63,.64),(-.55,.89,.88),
        (-.29,1.,1.),(0,1.,1.02),(.23,.92,1.),(.44,.80,.89),
        (.61,.64,.73),(.79,.51,.53),(.93,.12,.18),
    ):
        chest = max(0, min(1, (y - .03) / .58))
        raise_z = max(0, HEAD.z - MASS * .97) * chest
        if SPECIES == "walrus" and -.32 < y < .48:
            rz *= 1.08
        center_z = MASS * .91 + raise_z
        ring = [V((WIDTH * rx * math.cos(a), SPAN * y,
                   center_z + MASS * .83 * rz * math.sin(a)))
                for a in (math.tau * i / 24 for i in range(24))]
        rings.append((ring, {"body": 1 - chest, "chest": chest}))
    s.rings(rings, paint)

    s.start("Round head and muzzle")
    bulky = SPECIES == "walrus"
    wide = .47 if bulky else .34 if SPECIES == "harbor-seal" else .33
    height = .40 if bulky else .33 if SPECIES == "harbor-seal" else .37
    s.ellipsoid(HEAD, (wide, .48, height), "head", paint, sides=20, steps=10)
    snout = HEAD + V((0, .35, -.115))
    s.ellipsoid(snout, (wide*.84, .235, height*.59), "head",
                lambda p,n: "muzzle" if n.z > -.38 else "belly", sides=18, steps=8)
    s.ellipsoid(snout + V((0, .187, .077)), (wide*.39, .078, .07), "head",
                lambda p,n: "eye", sides=12, steps=6)
    for suffix, sign in SIDES:
        s.start("Face " + suffix)
        eye = HEAD + V((sign * wide * .75, .265, .126))
        s.ellipsoid(eye, (.087,.084,.075), "head", lambda p,n: "eye", sides=12, steps=6)
        s.ellipsoid(eye + V((sign*.065,.025,.037)), (.017,.023,.019), "head",
                    lambda p,n: "muzzle", sides=8, steps=4)
        if SPECIES == "sea-lion":
            ear = HEAD + V((sign*wide*.84,-.11,.16))
            s.tube([(ear,.073,.071,{"head":1}),
                    (ear+V((sign*.085,-.14,.08)),.015,.012,{"head":1})],
                   flipper_paint, sides=8)
        for offset, rise in ((.035,.030), (0,0), (-.028,-.028)):
            start = snout + V((sign*wide*.59,.135+offset,-.06+rise))
            end = start + V((sign*(.26 if bulky else .20),.07+offset,rise*1.9))
            s.tube([(start,.011,.012,{"head":1}),(end,.004,.004,{"head":1})],
                   lambda p,n: "ivory" if bulky else "dark", sides=5)
        if bulky:
            base = snout + V((sign*.234,.089,-.06))
            s.tube([(base,.091,.089,{"head":1}),
                    (base+V((sign*.025,.029,-.29)),.073,.069,{"head":1}),
                    (base+V((sign*.015,.073,-.53)),.043,.045,{"head":1}),
                    (base+V((-sign*.015,.12,-.66)),.012,.012,{"head":1})],
                   lambda p,n:"ivory" if n.dot(SUN)>.12 else "muzzle", sides=10)

    for suffix, sign in SIDES:
        for limb, pivots in (("fore", FORE), ("hind", HIND)):
            label = f"{limb}.{suffix}"
            s.start(label)
            root, toe = pivots[suffix]
            span = toe - root
            s.tube([
                (root,.18,.135,{label:1}),
                (root + .37*span,.15,.11,{label:1}),
                (root + .77*span,.23 if limb=="hind" else .20,.074,{label:1}),
                (toe,.18 if limb=="hind" else .145,.048,{label:1}),
                (toe + V((sign*.021,.030 if limb=="fore" else -.026,-.008)),.069,.031,{label:1}),
            ], flipper_paint, sides=12)
    return s


def pose(_, rest, clip, t):
    phase = math.tau * t
    wave = math.sin(phase)
    aquatic = clip in ("swim", "flee-swim")
    panic = clip in ("flee", "flee-swim")
    hauling = clip in (GAIT, "flee")
    gesture = math.sin(math.pi*t)**2 if clip == "action" else 0
    seal = SPECIES == "harbor-seal"
    walrus = SPECIES == "walrus"
    heave = .038 if seal else .058 if walrus else .068
    stride = math.sin(phase - .64)
    reach = .32 if panic else .19
    bob = (.085 if panic else .039) * wave if aquatic else heave * wave if hauling else .012 * wave
    sway = (.18 if panic else .08) * wave if aquatic else 0
    pitch = -.09 + (.09 if panic else .048) * wave if aquatic else .048 * stride * hauling
    q = euler(pitch, sway, 0)
    body = transform(q, HIP_CENTER, HIP_CENTER + V((0,-.09*wave*hauling,bob)))
    output = {"body": body @ rest["body"]}

    bow = (-.26 if seal else -.70 if walrus else -.81) if aquatic else 0
    if hauling:
        bow += (.19 if panic else .12) * math.sin(phase-.42)
    crank = -.15 if walrus else .25 if seal else .38
    bow += crank * gesture
    chest_q = q @ euler(bow, .033 * wave * hauling, 0)
    chest = transform(chest_q, CHEST, body @ CHEST)
    output["chest"] = chest @ rest["chest"]
    nod = (-.31 * gesture if walrus else .14*gesture) - .33*bow
    yaw = (.31 if walrus else .21) * gesture * wave + (.043*wave if clip=="idle" else 0)
    head_q = chest_q @ euler(nod, 0, yaw)
    head = transform(head_q, HEAD, chest @ HEAD)
    output["head"] = head @ rest["head"]

    for suffix, sign in SIDES:
        front, front_toe = FORE[suffix]
        hind, hind_toe = HIND[suffix]
        start_front, start_hind = chest @ front, body @ hind
        offset = sign * (.31 if seal else 1.3)
        pull = math.sin(phase + offset)
        if aquatic:
            # The fast stroke tucks the foreflippers against the chest. At
            # cruise the sea lion rows with its forelimbs and the seal steers
            # with its hindquarters.
            row = (.105 if seal else .32 if not walrus else .21) * pull
            front_delta = V((sign*(.38 - .085*panic), -.33 - .24*panic + row,
                             -.09 + .15*pull))
            push = (.32 if panic else .17) * math.sin(phase - sign * .39)
            hind_delta = V((sign*(.28 + push), -.61 - .21*panic, .09 + .24*wave))
            end_front = start_front + q @ front_delta
            end_hind = start_hind + q @ hind_delta
        elif hauling:
            plant = max(0,pull)
            end_front = front_toe + V((sign*.025*pull,reach*pull,(.13 if panic else .088)*plant))
            heel = math.sin(phase-offset-1.26)
            end_hind = hind_toe + V((sign*.04*heel,
                                    reach*heel*(.39 if seal else .78),
                                    (.028 if seal else .087)*max(0,heel)))
        else:
            end_front = front_toe + V((sign*.04*gesture,.042*gesture,.084*gesture*max(0,sign*wave)))
            end_hind = hind_toe + V((0,-.054*gesture,0))
        output[f"fore.{suffix}"] = aimed(rest[f"fore.{suffix}"], start_front, end_front)
        output[f"hind.{suffix}"] = aimed(rest[f"hind.{suffix}"], start_hind, end_hind)
    return output
