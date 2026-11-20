"""Articulated mantle, shell and bell models for the marine sprite roster."""
import math

from mathutils import Matrix
from wildlife_build import CatSurface, V, aimed, euler, transform

LIGHT = V((-.44, .28, .85)).normalized()
STYLES = {
    "cuttlefish": ("Cuttlefish", "675641 ab7652 9e8d6b d9c8a0 151d19 dac6a1", 8, "swim"),
    "octopus": ("Rust octopus", "63323a b64d3f df8553 f1b879 233b38 edce80", 8, "jet"),
    "nautilus": ("Nautilus", "675641 ab7652 d9c8a0 e5d4ae 151d19 d7c8a1", 10, "swim"),
    "jellyfish": ("Moon jellyfish", "a887c0 bb8fb9 dcc4df eac6df 916caa f3dce4", 8, "pulse"),
}
NAME = STYLE = PALETTE = DURATIONS = BODY = ARMS = FINS = None
ANIMATES_SCALE = False


def configure(style):
    global NAME, STYLE, PALETTE, DURATIONS, BODY, ARMS, FINS, ANIMATES_SCALE
    STYLE = style
    NAME, colors, count, travel = STYLES[style]
    PALETTE = dict(zip(("dark", "accent", "body", "light", "ink", "cream"), colors.split()))
    DURATIONS = {"idle": 48, travel: 33, "action": 22, "flee": 20}
    if style == "cuttlefish":
        DURATIONS = {"idle": 48, "swim": 33, "feed": 23, "display": 24, "chase": 18}
    height = {"cuttlefish": .52, "octopus": .75, "nautilus": .69, "jellyfish": .94}[style]
    BODY = V((0, 0, height))
    ARMS = [arm_points(i, count) for i in range(count)]
    FINS = {
        f"fin.{side}.{end}": (V((side*.41, y, .54)), V((side*.68, y-.16, .51)))
        for side in (-1, 1) for end, y in (("front", .14), ("rear", -.46))
    } if style == "cuttlefish" else {}
    ANIMATES_SCALE = style == "jellyfish"


def arm_points(i, count):
    if STYLE in ("octopus", "jellyfish"):
        angle = math.tau*(i+.08)/count
        x, y = math.sin(angle), math.cos(angle)
        reach = 1 + .10*math.sin(i*2.93)
        if STYLE == "octopus":
            return [V((x*f*reach, y*f*reach, h)) for f, h in
                    ((.24,.52),(.48,.268),(.74,.194),(1.08,.231+.12*(i % 3)/2))]
        return [V((x*f, y*f, h)) for f, h in
                ((.33,.83),(.38,.56),(.42,.31*reach),(.52,.065*reach))]
    across = 2*i/(count-1)-1
    if STYLE == "nautilus":
        return [V((across*f,y,z)) for f,y,z in
                ((.19,.365,.53),(.26,.513,.415),(.33,.598,.366),(.36,.667,.392))]
    long = i in (2, 5)
    return [V((across*f,y,z)) for f,y,z in (
        (.26,.62,.515),(.34,.83,.46),(.43,1.09 if long else .95,.53),
        (.44,1.37 if long else 1.04,.59 if long else .47),
    )]


def arm(i, joint):
    return f"arm.{i:02}.{joint}"


def joints():
    result = [("body", BODY, BODY+V((0,.43,0)), None)]
    if STYLE == "octopus":
        neck = V((0,.13,.61))
        result.append(("mantle", neck, neck+V((0,-.32,.56)), "body"))
    for key, (root, tip) in FINS.items():
        result.append((key, root, tip, "body"))
    for i, points in enumerate(ARMS):
        for joint, (a, b) in enumerate(zip(points, points[1:])):
            result.append((arm(i, joint), a, b, arm(i, joint-1) if joint else "body"))
    return result


def mantle_ink(_, normal):
    light = normal.dot(LIGHT)
    if STYLE == "octopus":
        if light < -.64:
            return "dark"
        if light < -.12:
            return "accent"
        return "light" if light > .80 else "body"
    if STYLE == "nautilus":
        return "accent" if light > .56 else "dark"
    if normal.z < -.38:
        return "cream"
    return "dark" if light < -.37 else "body"


def shell_ink(point, normal):
    dy = point.y+.145
    dz = point.z-.77
    phase = math.atan2(dz,dy)
    radius = math.hypot(dy,dz)
    if radius > .17 and math.sin(phase*4.9+radius*6.5+abs(point.x)*5.7) > .25:
        return "accent" if normal.dot(LIGHT) > .03 else "dark"
    return "light" if normal.dot(LIGHT) > .55 else "body"


def bell_ink(point, normal):
    if normal.z < -.28:
        return "accent"
    if point.z < .94:
        return "light" if normal.dot(LIGHT) > .1 else "accent"
    # Pale radial highlights and isolated deeper lavender flecks through the dome.
    theta = math.atan2(point.x, point.y)
    if .99 < point.z < 1.21 and math.cos(9*theta+14*point.z) > .77:
        return "dark"
    return "cream" if normal.dot(LIGHT) > .66 else "body"


def eye(s, sign, center, radius, group="body"):
    s.ellipsoid(center, tuple(radius*k for k in (1,1.06,.89)), group,
                lambda p,n: "light" if n.z>.36 else "dark", sides=13, steps=8)
    pupil = center + V((sign*.64,.52,.14))*radius
    s.ellipsoid(pupil, tuple(radius*k for k in (.48,.53,.53)), group,
                lambda p,n: "cream" if n.z>.89 else "ink", sides=10, steps=6)


def arm_ink(point, normal):
    if STYLE == "octopus":
        if normal.z > .33 and (point.y < .04 or abs(point.x) > .41):
            return "dark"
        return "accent" if normal.z > -.40 else "body"
    if STYLE == "jellyfish":
        return "light" if normal.dot(LIGHT) > .28 else "accent"
    return "cream" if normal.z < -.49 else "accent" if normal.z < .19 else "body"


def fins(s):
    for side in (-1, 1):
        strip = []
        for y, width, z in ((-.91,.22,.57),(-.74,.42,.54),(-.52,.62,.53),(-.27,.68,.53),
                             (0,.65,.54),(.24,.54,.54),(.44,.35,.55)):
            front = max(0, min(1, (y+.68)/.9))
            weights = {f"fin.{side}.front": front, f"fin.{side}.rear": 1-front}
            inner_x = side * (.20 if abs(y) > .70 else .30)
            outer_x = side*width
            strip.append(([V((inner_x,y,z+.024)), V((outer_x,y,z+.021)),
                           V((outer_x,y,z-.021)), V((inner_x,y,z-.024))], weights))
        s.rings(strip, lambda p,n: "accent" if n.z > .25 else "dark")


def surface():
    s = CatSurface()
    if STYLE == "cuttlefish":
        s.start("Rounded mantle and continuous side fins")
        s.ellipsoid(V((0,-.225,.59)),(.48,.733,.325),"body",mantle_ink,sides=24,steps=15)
        fins(s)
        s.start("Head and paired eyes")
        s.ellipsoid(V((0,.47,.54)),(.302,.282,.213),"body",mantle_ink,sides=20,steps=12)
        for sign in (-1,1):
            eye(s,sign,V((sign*.246,.543,.61)),.111)
    elif STYLE == "octopus":
        s.start("Rust mantle, brow and arm web")
        s.ellipsoid(V((0,-.25,.946)),(.345,.335,.411),"mantle",mantle_ink,sides=24,steps=15)
        s.ellipsoid(V((0,.065,.632)),(.34,.295,.246),"body",mantle_ink,sides=20,steps=12)
        s.ellipsoid(V((0,0,.447)),(.446,.396,.104),"body",mantle_ink,sides=18,steps=10)
        for sign in (-1,1):
            eye(s,sign,V((sign*.218,.244,.729)),.081)
    elif STYLE == "nautilus":
        s.start("Cream spiral shell and dark apertural hood")
        s.ellipsoid(V((0,-.148,.775)),(.35,.489,.557),"body",shell_ink,sides=30,steps=22)
        s.ellipsoid(V((0,.265,.635)),(.293,.265,.264),"body",mantle_ink,sides=22,steps=14)
        for sign in (-1,1):
            eye(s,sign,V((sign*.225,.396,.636)),.062)
    else:
        s.start("Rounded lavender bell and scalloped rim")
        s.ellipsoid(V((0,0,1.014)),(.475,.464,.298),"body",bell_ink,sides=28,steps=17)
        s.ellipsoid(V((0,0,.878)),(.468,.459,.092),"body",bell_ink,sides=24,steps=13)
        for angle in (0, math.tau*.25, math.tau*.50, math.tau*.75):
            pad = V((.174*math.sin(angle),.174*math.cos(angle),.808))
            s.ellipsoid(pad,(.091,.086,.064),"body",
                        lambda p,n: "dark" if n.z<-.3 else "light",sides=13,steps=8)
    thickness = {"cuttlefish": .059, "octopus": .106, "nautilus": .036, "jellyfish": .043}[STYLE]
    for i, points in enumerate(ARMS):
        s.start(f"Appendage {i+1}")
        sections = []
        for joint, (a, b) in enumerate(zip(points, points[1:])):
            for share in (0, .47):
                radius = thickness*(1-.76*(joint+share)/3)
                key = arm(i,joint)
                weights = {arm(i,joint-1):.46,key:.54} if joint and not share else {key:1}
                sections.append((a.lerp(b,share),radius,radius*.91,weights))
        tip = thickness * (.48 if STYLE == "cuttlefish" and i in (2,5) else .17)
        sections.append((points[-1],tip,tip*.88,{arm(i,2):1}))
        s.tube(sections, arm_ink, sides=11 if STYLE == "octopus" else 8)
        if STYLE == "octopus":
            for joint, (a, b) in enumerate(zip(points, points[1:])):
                p = a.lerp(b,.40) - V((0,0,.084-.023*joint))
                size = .045-.007*joint
                s.ellipsoid(p,(size,size*1.08,.025),arm(i,joint),
                            lambda p,n: "cream" if n.z < .53 else "accent",sides=7,steps=3)
    return s


def pose(_, rest, clip, t):
    phase = math.tau*t
    accent = math.sin(math.pi*t)**2
    cruising = clip in ("swim", "pulse", "jet")
    fleeing = clip in ("flee", "chase")
    showing = clip in ("display", "action")
    strike = math.sin(phase)**4 if clip == "feed" else 0
    squeeze = ((.5-.5*math.cos(phase))*1.0 if cruising else
               (.5-.5*math.cos(2*phase))*1.29 if fleeing else .14*math.sin(phase))
    bob = .026*math.sin(phase)
    if STYLE in ("octopus", "jellyfish"):
        bob += .107*squeeze if cruising or fleeing else .09*accent*showing
    forward = .102*strike - .07*squeeze*fleeing
    pitch = .041*math.sin(phase)-.15*accent*showing+.12*strike
    rotation = euler(pitch, .042*math.sin(phase), .034*math.cos(phase))
    movement = transform(rotation, BODY, BODY+V((0,forward,bob)))
    body_frame = movement
    if STYLE == "jellyfish":
        bell_width = 1 - .18*squeeze + .14*accent*showing
        bell_height = 1 + .13*squeeze - .05*accent*showing
        scale = Matrix.Diagonal((bell_width,bell_width,bell_height,1))
        scale.translation = BODY - scale @ BODY
        body_frame = movement @ scale
    out = {"body":body_frame @ rest["body"]}
    if "mantle" in rest:
        origin = rest["mantle"].translation
        tilt = .12*squeeze - .22*accent*showing
        out["mantle"] = transform(rotation @ euler(tilt),origin,movement @ origin) @ rest["mantle"]
    for key, (root, _) in FINS.items():
        side = math.copysign(1,root.x)
        ripple = math.sin(phase*(2 if fleeing else 1)+root.y*3.8)
        angle = (.42 if fleeing else .29 if cruising else .08)*ripple + .17*accent*showing
        out[key] = transform(rotation @ euler(0,side*angle,0),root,movement @ root) @ rest[key]
    for i, points in enumerate(ARMS):
        cursor = body_frame @ points[0]
        side = math.copysign(1,points[-1].x)
        for joint, (a,b) in enumerate(zip(points,points[1:])):
            wave = phase*(1 if not fleeing else 2) - joint*.95 + i*.59
            yaw = (.21 if cruising else .14 if fleeing else .065)*math.sin(wave)
            curl = (.27 if cruising else .18 if fleeing else .076)*math.cos(wave)
            local = b-a
            if STYLE == "octopus":
                grab = .38*accent*showing*(1 if i < 4 else -.46)
                yaw += side*grab
                curl += .30*squeeze*fleeing + grab
                local *= 1-.24*squeeze if fleeing else 1-.10*squeeze*cruising
            elif STYLE == "jellyfish":
                local.y -= .13*squeeze*fleeing
                curl += .24*squeeze+.30*accent*showing
            elif STYLE == "nautilus":
                local *= 1-.27*squeeze*fleeing+.20*accent*showing
                yaw += -side*.24*accent*showing
                curl += .29*squeeze*fleeing-.33*accent*showing
            else:
                reach = strike*(1 if i in (2,5) else .34)
                local.y *= 1+.92*reach-.17*squeeze*fleeing
                curl += .40*accent*showing-.14*reach
                yaw += -side*.41*accent*showing
            target = cursor + rotation @ (euler(curl,0,yaw) @ local)
            part = arm(i,joint)
            out[part] = aimed(rest[part],cursor,target)
            cursor = target
    return out
