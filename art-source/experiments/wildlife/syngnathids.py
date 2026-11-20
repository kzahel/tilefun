"""Upright seahorse and horizontal leafy seadragon, with skinned fins and tails."""
import math

from wildlife_build import CatSurface, V, aimed, euler, transform

LIGHT = V((-.43,.28,.86)).normalized()
DURATIONS = {"idle":48,"swim":30,"action":22,"flee":16}
NAME = PALETTE = BODY = HEAD = TAIL = FINS = LEAVES = None
DRAGON = False


def configure(species):
    global NAME, PALETTE, BODY, HEAD, TAIL, FINS, LEAVES, DRAGON
    DRAGON = species == "leafy-seadragon"
    NAME = "Leafy seadragon" if DRAGON else "Seahorse"
    colors = (
        "526a42 78935e b2bc77 d9c8a0 151d19 9ca563" if DRAGON
        else "675641 ab7652 d5af66 d9c8a0 151d19 c28f52"
    )
    PALETTE = dict(zip(("dark","coat","light","cream","eye","fin"),colors.split()))
    BODY = V((0,0,.74 if DRAGON else .94))
    HEAD = V((0,.23,.817 if DRAGON else 1.29))
    profile = (
        ((0,-.27,.72),(0,-.52,.68),(0,-.82,.64),(0,-1.09,.633),(0,-1.35,.654),(0,-1.57,.689))
        if DRAGON else
        ((0,-.11,.66),(0,-.19,.45),(0,-.27,.24),(0,-.43,.12),
         (0,-.62,.16),(0,-.66,.31),(0,-.55,.39))
    )
    TAIL = [V(coords) for coords in profile]
    far_fin = V((0,-.44,.98)) if DRAGON else V((0,-.51,1.16))
    root_fin = V((0,-.29,.79 if DRAGON else 1.00))
    FINS = [("dorsal",root_fin,far_fin,"body")]
    for sign in (-1,1):
        root = HEAD+V((sign*.111,-.036,-.044))
        FINS.append((f"fin.{sign}",root,root+V((sign*.15,-.17,.032)),"head"))
    LEAVES = []
    if DRAGON:
        for joint, x, y, z, reach in (
            ("body",.21,.20,.72,.29),("body",.18,-.05,.89,.34),
            ("tail.0",.09,-.38,.71,.27),("tail.1",.07,-.61,.64,.29),
            ("tail.2",.06,-.97,.67,.27),("tail.3",.039,-1.24,.64,.23),
        ):
            for sign in (-1,1):
                root = V((sign*x,y,z))
                mood = -1 if joint in ("tail.1","tail.3") else 1
                tip = root+V((sign*reach*.63,-reach*.63,reach*.42*mood))
                LEAVES.append((f"leaf.{len(LEAVES)}",root,tip,joint))


def joints():
    items = [("body",BODY,BODY+V((0,.36,0)),None),
             ("head",HEAD,HEAD+V((0,.25,.076)),"body")]
    items.extend((f"tail.{i}",a,b,f"tail.{i-1}" if i else "body")
                 for i,(a,b) in enumerate(zip(TAIL,TAIL[1:])))
    return items + FINS + LEAVES


def skin(p, n):
    if p.y>.15 and n.y>.04 or not DRAGON and p.z<.89 and n.y>.33:
        return "light" if n.dot(LIGHT)>.01 else "coat"
    wave = math.cos((p.y if DRAGON else p.z)*33+abs(p.x)*5.5)
    if wave>.50 and n.z>-.32:
        return "light" if DRAGON else "coat"
    return "dark" if n.dot(LIGHT)<-.41 else "coat" if DRAGON else "fin"


def leaf_surface(s, root, tip, width, group):
    along = tip-root
    tangent = V((0,.38,.92)).cross(along).normalized()
    thickness = along.normalized().cross(tangent)*.019
    rings = []
    for t, radius in ((0,.022),(.29,width*.84),(.58,width),(.82,width*.45),(1,.005)):
        p = root.lerp(tip,t)
        rings.append(([p-radius*tangent,p+thickness*(1-t),
                       p+radius*tangent,p-thickness*(1-t)],{group:1}))
    s.rings(rings,lambda p,n: "light" if n.dot(LIGHT)>.20 else "fin")


def surface():
    s = CatSurface()
    s.start("Ribbed trunk")
    dimensions = (.169,.426,.173) if DRAGON else (.245,.251,.355)
    s.ellipsoid(BODY,dimensions,"body",skin,sides=26,steps=17)
    if not DRAGON:
        s.ellipsoid(BODY+V((0,.151,-.129)),(.151,.142,.201),"body",
                    lambda p,n:"cream" if n.dot(LIGHT)>.48 else "light",sides=16,steps=12)
    s.start("Eyes and tubular snout")
    skull = HEAD+V((0,.075,.093))
    skull_shape = (.150,.194,.140) if DRAGON else (.175,.219,.207)
    s.ellipsoid(skull,skull_shape,"head",skin,sides=19,steps=13)
    nose = [skull+V((0,.107,-.054)),skull+V((0,.27,-.072)),
            skull+V((0,.441 if DRAGON else .382,-.076))]
    s.tube([(p,w,w*.82,{"head":1}) for p,w in zip(nose,(.095,.054,.036))],
           lambda p,n:"cream" if n.z>-.15 else "light",sides=12)
    s.ellipsoid(nose[-1]+V((0,.011,-.003)),(.026,.020,.022),"head",
                lambda p,n:"dark",sides=9,steps=6)
    for sign in (-1,1):
        eye = skull+V((sign*(.124 if DRAGON else .147),.067,.061))
        radius = .047 if DRAGON else .059
        s.ellipsoid(eye,(radius,radius,radius),"head",
                    lambda p,n:"cream" if n.z>.69 else "eye",sides=12,steps=8)
    if not DRAGON:
        s.start("Crown tips")
        for side in (-1,1):
            top = skull+V((side*.055,-.073,.135))
            s.tube([(top,.048,.046,{"head":1}),
                    (top+V((side*.018,-.058,.130)),.009,.010,{"head":1})],
                   skin,sides=8)
    s.start("Tapered tail")
    sections = []
    count = len(TAIL)-1
    for i,(a,b) in enumerate(zip(TAIL,TAIL[1:])):
        for phase in (0,.42,.76):
            ratio = (i+phase)/count
            radius = .137*(1-ratio)**.75+.009
            weights = {f"tail.{i-1}":.49,f"tail.{i}":.51} if i and phase==0 else {f"tail.{i}":1}
            sections.append((a.lerp(b,phase),radius,radius*.88,weights))
    sections.append((TAIL[-1],.016,.014,{f"tail.{count-1}":1}))
    s.tube(sections,skin,sides=12)
    for key,root,tip,_ in FINS+LEAVES:
        s.start(key)
        leaf_surface(s,root,tip,.101 if key in {"dorsal","fin.-1","fin.1"} else .074,key)
    return s


def pose(_, rest, clip, t):
    wave = math.tau*t
    swimming = clip == "swim"
    escaping = clip == "flee"
    action = math.sin(math.pi*t)**2 if clip=="action" else 0
    drive = math.sin(2*wave) if escaping else math.sin(wave)
    q = euler(.051*math.sin(wave)-.14*action-.16*drive*escaping,
              .041*math.cos(wave),.077*drive if escaping else .033*math.sin(wave))
    lift = .038*math.cos(wave)+.09*action+.060*drive*escaping
    body = transform(q,BODY,BODY+V((0,.08*drive*escaping,lift)))
    result = {"body":body@rest["body"]}
    head_q = q@euler(.31*action+.04*math.sin(wave)-.11*drive*escaping)
    result["head"] = transform(head_q,HEAD,body@HEAD)@rest["head"]
    cursor = body@TAIL[0]
    for i,(a,b) in enumerate(zip(TAIL,TAIL[1:])):
        phase = wave*(2 if escaping else 1)-.73*i
        swing = (.29 if escaping else .14 if swimming else .046)*math.sin(phase)
        flex = .14*action*(i+1)+.09*math.cos(phase)*escaping
        if escaping and not DRAGON:
            flex -= .18*(.5+.5*drive)
        delta = q@(euler(flex,0,swing)@(b-a))
        name = f"tail.{i}"
        result[name] = aimed(rest[name],cursor,cursor+delta)
        cursor += delta
    for i,(key,root,tip,parent) in enumerate(FINS+LEAVES):
        bone = result[parent]@rest[parent].inverted()
        amplitude = (.39 if escaping else .24 if swimming else .09) if i<3 else (
            .20 if escaping else .14 if swimming else .049
        )
        beat = math.sin(wave*(3 if escaping and i<3 else 2 if swimming and i<3 else 1)+.90*i)
        rotation = bone.to_quaternion()@euler(.17*action+amplitude*beat,0,.46*amplitude*beat)
        result[key] = transform(rotation,root,bone@root)@rest[key]
    return result
