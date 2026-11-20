"""Sprite-matched eels with a continuous ribbon fin and independent jaws."""
import math

from wildlife_build import CatSurface, V, aimed, euler, transform

SEGMENTS = 14
LIGHT = V((-.41, .24, .88)).normalized()
DURATIONS = {"idle": 48, "swim": 32, "feed": 24, "display": 24, "chase": 20}
NAME = PALETTE = POINTS = JAW = None
MORAY = False


def configure(species):
    global NAME, PALETTE, POINTS, JAW, MORAY
    MORAY = species == "moray-eel"
    NAME = "Moray eel" if MORAY else "Electric eel"
    colors = (
        "514238 8b8d58 bba475 d1bd8e 9b5154 171c18 d6c8a4" if MORAY
        else "514238 675d48 bba475 d1bd8e 9b5154 171c18 d6c8a4"
    )
    PALETTE = dict(zip(("dark", "back", "flank", "belly", "edge", "ink", "teeth"),
                       colors.split()))
    length = 3.03 if MORAY else 3.24
    POINTS = [V((.043 * math.sin(i * math.tau / SEGMENTS),
                 length * (.46-i/SEGMENTS), .255)) for i in range(SEGMENTS+1)]
    JAW = POINTS[0] + V((0, .036, -.075))


def section(index):
    return f"body.{index:02}"


def joints():
    return [(section(i), a, b, section(i-1) if i else None)
            for i, (a, b) in enumerate(zip(POINTS, POINTS[1:]))] + [
        ("jaw", JAW, JAW + V((0, .23, -.02)), section(0)),
    ]


def shape(p, n):
    if n.z < -.44:
        return "belly" if n.dot(LIGHT) > -.62 else "dark"
    if MORAY and p.z > .16 and n.z < .61:
        stripe = math.sin(17 * p.y + 15 * p.z + 7 * abs(p.x))
        if stripe < -.44:
            return "dark"
    if n.z > .50:
        return "back" if n.dot(LIGHT) > .35 else "dark"
    return "flank" if n.dot(LIGHT) > -.26 else "dark"


def flesh(progress):
    width = (.128 if MORAY else .111) * (1-progress**2.7)**.70
    return max(.013, width), max(.018, width * (1.11 if MORAY else .89))


def body_sections():
    for i, (a, b) in enumerate(zip(POINTS, POINTS[1:])):
        for share in (0, .44, .76):
            progress = (i + share) / SEGMENTS
            weights = {section(i-1): .50, section(i): .50} if i and not share else {section(i): 1}
            yield a.lerp(b, share), *flesh(progress), weights
    yield POINTS[-1], *flesh(1), {section(SEGMENTS-1): 1}


def fin(sections):
    """Build the fin as one skinned surface along the animal, including the taper."""
    result = []
    for index, (p, radius, height, weights) in enumerate(sections):
        progress = index / (len(sections)-1)
        if progress < (.13 if MORAY else .33):
            continue
        span = math.sin(math.pi * progress) * (.118 if MORAY else .088)
        anchor_z = p.z + height * .58 if MORAY else p.z - height * .61
        ridge_z = anchor_z + span if MORAY else anchor_z - span
        result.append(([V((p.x-radius*.20, p.y, anchor_z)),
                        V((p.x+radius*.20, p.y, anchor_z)),
                        V((p.x+radius*.12, p.y, ridge_z)),
                        V((p.x-radius*.12, p.y, ridge_z))], weights))
    return result


def surface():
    s = CatSurface()
    s.start("Continuous narrow body")
    sections = list(body_sections())
    s.tube(sections, shape, sides=14)
    s.start("Dorsal ribbon" if MORAY else "Anal ribbon")
    s.rings(fin(sections), lambda p, n: "edge" if MORAY or p.y < -.69 else "back")

    s.start("Head and jaw")
    head = POINTS[0] + V((0, .095, .018))
    s.ellipsoid(head, (.157 if MORAY else .142, .214, .130 if MORAY else .113),
                section(0), shape, sides=18, steps=11)
    mouth = head + V((0, .139, -.065))
    s.ellipsoid(mouth, (.105, .096, .031), section(0), lambda p, n: "ink", sides=14, steps=8)
    s.ellipsoid(JAW + V((0, .145, -.027)), (.127, .158, .046), "jaw",
                lambda p, n: "belly" if n.z < .3 else "flank", sides=15, steps=8)
    for side in (-1, 1):
        eye = head + V((side*.111, .086, .052))
        s.ellipsoid(eye, (.047, .049, .044), section(0),
                    lambda p, n: "teeth" if n.z > .61 else "ink", sides=11, steps=6)
        if MORAY:
            for i in range(3):
                tooth = mouth + V((side*(.073-.015*i), .006+.022*i, -.010))
                s.tube([(tooth, .015, .015, {section(0): 1}),
                        (tooth + V((0, .008, -.046)), .003, .003, {section(0): 1})],
                       lambda p, n: "teeth", sides=6)
    return s


def pose(_, rest, clip, t):
    wave = math.tau*t
    effort = math.sin(math.pi*t)**2
    feed = math.sin(wave)**2 if clip == "feed" else 0
    display = effort if clip == "display" else 0
    chase = clip == "chase"
    swim = clip == "swim"
    node = POINTS[0] + V((.020*math.sin(wave), .058*feed+.045*chase*math.cos(wave),
                          .086*display+.031*feed+.012*math.cos(wave)))
    matrices = {}
    for i, (a, b) in enumerate(zip(POINTS, POINTS[1:])):
        progress = i / (SEGMENTS-1)
        if chase:
            yaw = (.15+.55*progress) * math.sin(wave-9.4*progress)
        elif swim:
            yaw = (.10+.31*progress) * math.sin(wave-7.4*progress)
        else:
            yaw = (.045+.050*progress) * math.sin(wave-6.3*progress)
            yaw += display * .40 * math.sin(progress*4)
            if not MORAY:
                yaw += display * .13 * math.sin(3*wave-7*progress)
        pitch = (-.34*display-.13*feed)*(1-progress)**5
        pitch += .11*chase*progress*math.sin(wave-5*progress)
        end = node + euler(pitch, 0, yaw) @ (b-a)
        name = section(i)
        matrices[name] = aimed(rest[name], node, end)
        node = end
    head = matrices[section(0)] @ rest[section(0)].inverted()
    opening = (.05+.065*math.sin(wave) if MORAY else .027) + .39*feed + .63*display
    rotation = head.to_quaternion() @ euler(-opening)
    matrices["jaw"] = transform(rotation, JAW, head @ JAW) @ rest["jaw"]
    return matrices
