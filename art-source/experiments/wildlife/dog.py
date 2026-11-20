"""Low-set tricolor Tilefun dog with drooped ears and a white tail tip."""
import math

from mathutils import Matrix
from wildlife_build import CatSurface, V, aimed, euler, mix, rows, solve_knee, stride, transform

NAME = "Tricolor Dog"
VARIANT = "tricolor"
ROLLOUT = False
DURATIONS = {"idle": 48, "walk": 16, "action": 31, "pickup": 19, "release": 19}
PALETTE = {
    "deep": "1c2028", "black": "272a32", "slate": "414651", "tan_dark": "78452f",
    "tan": "ad7549", "tan_light": "cd995f", "tan_hi": "dfa96b", "ear_dark": "583626",
    "ear": "855038", "white": "fbf4dc", "cream": "e9dbbf", "cream_shadow": "b2a99b",
    "eye_glow": "b7854f", "eye": "261d21", "glint": "fff5df", "nose": "1e252c",
    "nose_light": "414750", "jaw": "54382d", "tongue": "b77b71",
}
LIGHT = V((-.45, .33, .82)).normalized()
BODY = V((0, 0, .72))
HEAD = V((0, .83, 1.08))
HIPS = {
    "fl": (.252, .60, .79, .49, .36, .69),
    "fr": (-.252, .60, .79, .49, .36, .69),
    "hl": (.266, -.65, .77, -.42, .38, -.74),
    "hr": (-.266, -.65, .77, -.42, .38, -.74),
}
TAIL = [V(p) for p in ((0,-.95,.84),(0,-1.25,.95),
                       (.02,-1.62,1.09),(.04,-1.94,1.23),(.04,-2.18,1.35))]
EAR_PIVOT = {side: HEAD + V((sign * .345, -.078, .15)) for side, sign in (("l", 1), ("r", -1))}


def configure(variant):
    global VARIANT, NAME, DURATIONS
    VARIANT=variant
    DURATIONS={"idle":48,"walk":31,"action":31}
    if variant == "golden":
        NAME="Golden Retriever"
        PALETTE.update({
            "deep":"8e5f3b", "black":"b1824f", "slate":"c3955e", "tan_dark":"95633d",
            "tan":"bc8a54", "tan_light":"d3a66e", "tan_hi":"e4b980", "ear_dark":"875133",
            "ear":"a66b41", "white":"edca97", "cream":"dcb484", "cream_shadow":"ae895e",
        })
    else:
        NAME="Pointed-ear Shepherd"
        PALETTE.update({
            "deep":"222627", "black":"313334", "slate":"50524b", "tan_dark":"845737",
            "tan":"aa7b50", "tan_light":"c59660", "tan_hi":"d6aa73", "ear_dark":"4a392f",
            "ear":"9d7161", "white":"d1ab7d", "cream":"b99164", "cream_shadow":"866345",
        })
        for side,pivot in EAR_PIVOT.items():
            EAR_PIVOT[side]=pivot+V((0,0,.051))

def configure_rollout():
    global ROLLOUT
    ROLLOUT = True
    DURATIONS["flee"] = 8 if VARIANT == "tricolor" else 15
    if VARIANT == "tricolor":
        PALETTE.update(deep="24212a", black="302f36", slate="474651")


def bone_names(name):
    return name + ".upper", name + ".lower", name + ".paw"


def joints():
    definitions = [
        ("body", BODY, BODY + V((0, .7, 0)), None),
        ("head", HEAD, HEAD + V((0, .50, 0)), "body"),
        ("jaw", HEAD + V((0, .20, -.16)), HEAD + V((0, .60, -.18)), "head"),
    ]
    for side, p in EAR_PIVOT.items():
        sign=1 if side=="l" else -1
        reach=V((sign*.18,-.079,.422)) if VARIANT=="shepherd" else V((sign*.03,.035,-.49))
        definitions.append(("ear." + side, p, p + reach, "head"))
    for name, (x, y, z, ky, kz, py) in HIPS.items():
        hip, knee, ankle = (x,y,z), (x,ky,kz), (x,py,.109)
        a, b, c = bone_names(name)
        definitions.extend(((a, hip, knee, "body"), (b, knee, ankle, a),
                            (c, ankle, (x,py+.20,.109), b)))
    for i in range(len(TAIL)-1):
        definitions.append((f"tail{i}", TAIL[i], TAIL[i+1], f"tail{i-1}" if i else "body"))
    return definitions


def color(n, base):
    incidence = n.dot(LIGHT)
    if base == "white":
        return "white" if incidence > .53 else "cream" if incidence > -.20 else "cream_shadow"
    if base == "black":
        return "slate" if incidence > .64 else "black" if incidence > -.35 else "deep"
    return "tan_hi" if incidence > .72 else "tan_light" if incidence > .30 else "tan" if incidence > -.48 else "tan_dark"


def body_paint(p, n):
    if p.y > .38 and p.z < .89 and (abs(p.x) < .30 or p.y > .67):
        return color(n, "white")
    saddle = p.z > .76 + .12 * max(0, p.y + .39) and -.87 < p.y < .44
    return color(n, "black" if saddle else "tan")


def head_paint(p, n):
    h = p - HEAD
    if VARIANT=="shepherd" and h.y>.246 and (h.z<-.012 or abs(h.x)<.19):
        return color(n,"black")
    blaze = abs(h.x) < .13 + .1 * max(0, h.y) and h.y > .12 and h.z > -.17
    white = blaze or (h.y > .24 and h.z < -.06)
    return color(n, "white" if white else "tan")


def surface():
    s = CatSurface()
    s.start("Rounded beagle chest and saddle")
    body = []
    for y,z,width,rise in [
        (-1.115,.71,.07,.09),(-1.00,.70,.23,.21),(-.76,.72,.39,.27),(-.43,.73,.40,.29),
        (-.04,.74,.357,.30),(.28,.75,.372,.34),(.54,.79,.389,.38),
        (.73,.88,.325,.36),(.93,.96,.25,.28),(.99,1.00,.13,.19),
    ]:
        ring = [V((width*math.cos(math.tau*j/16),y,z+rise*math.sin(math.tau*j/16))) for j in range(16)]
        body.append((ring, {"body":1} if y < .73 else {"body":.82,"head":.18}))
    s.rings(body, body_paint)
    s.start("Short broad skull and pale blaze")
    s.ellipsoid(HEAD, (.397 if VARIANT=="shepherd" else .432,.41,.325),"head",head_paint,sides=20,steps=12)
    muzzle="black" if VARIANT=="shepherd" else "white"
    s.ellipsoid(HEAD+V((0,.353,-.102)),(.243 if VARIANT=="shepherd" else .29,.285,.153),"head",lambda p,n:color(n,muzzle),sides=16,steps=8)
    s.ellipsoid(HEAD+V((0,.371,-.201)),(.221 if VARIANT=="shepherd" else .234,.228,.092),"jaw",lambda p,n:color(n,muzzle),sides=14,steps=6)
    s.ellipsoid(HEAD+V((0,.590,-.085)),(.139,.063,.081),"head",
                lambda p,n:"nose_light" if n.z>.51 else "nose",sides=14,steps=6)
    s.ellipsoid(HEAD+V((0,.563,-.166)),(.101,.035,.027),"head",lambda p,n:"jaw",sides=8,steps=4)

    for side, sign in (("l",1),("r",-1)):
        s.start("Floppy ear " + side)
        origin, bone = EAR_PIVOT[side], "ear." + side
        sections = []
        flops = (
            (-.009,-.013,.025,.11,.145),(.092,.012,-.060,.111,.183),
            (.159,.041,-.184,.103,.193),(.169,.067,-.325,.089,.169),
            (.140,.087,-.451,.062,.133),(.099,.101,-.521,.022,.048),
        )
        upright = (
            (-.015,.005,-.10,.155,.100),(.013,-.026,.026,.133,.082),
            (.073,-.041,.170,.107,.064),(.125,-.067,.301,.071,.052),
            (.172,-.090,.412,.018,.017),
        )
        for x,y,z,rx,ry in upright if VARIANT=="shepherd" else flops:
            sections.append((origin+V((x*sign,y,z)),rx,ry,{bone:1}))
        def ear_paint(p,n):
            if VARIANT=="shepherd":
                return "ear" if n.y>.43 and abs(p.x-origin.x-sign*.07)<.102 else color(n,"black")
            return "ear_dark" if n.x*sign < -.18 or n.z < -.39 else "ear" if p.z < HEAD.z else color(n,"tan")
        s.tube(sections,ear_paint,sides=10)
        s.start("Dark glossy eye " + side)
        normal=V((sign*.67,.70,.20)).normalized()
        across=V((normal.y,-normal.x,0)).normalized()
        basis=Matrix((across,normal,across.cross(normal))).transposed()
        eye=HEAD+V((sign*.318,.265,.090))
        s.ellipsoid(eye,(.105,.054,.089),"head",lambda p,n:"tan_dark",sides=12,steps=6,basis=basis)
        s.ellipsoid(eye+normal*.039,(.081,.033,.073),"head",
                    lambda p,n:"eye_glow" if -.58 < n.z < -.27 else "eye",sides=12,steps=6,basis=basis)
        s.ellipsoid(eye+normal*.071+V((-.028,.005,.026)),(.022,.010,.021),"head",
                    lambda p,n:"glint",sides=8,steps=4,basis=basis)

    for name,(x,y,z,ky,kz,py) in HIPS.items():
        s.start(name)
        hip,knee,ankle=V((x,y,z)),V((x,ky,kz)),V((x,py,.109))
        upper, lower, paw=bone_names(name)
        broad=.187 if name.startswith("h") else .153
        s.tube([
            (hip+V((0,0,.14)),broad*.63,broad*.65,{"body":.28,upper:.72}),
            (hip,broad,broad*1.14,{upper:1}),
            (hip.lerp(knee,.60),broad*.86,broad,{upper:1}),
            (hip.lerp(knee,.94),.092,.097,{upper:.64,lower:.36}),
            (knee.lerp(ankle,.18),.079,.088,{upper:.20,lower:.80}),
            (knee.lerp(ankle,.63),.072,.076,{lower:1}),
            (ankle,.071,.073,{lower:.43,paw:.57}),
        ],lambda p,n:color(n,"white" if p.z<.26 else "tan"))
        s.ellipsoid(ankle+V((0,.052,-.037)),(.107,.141,.070),paw,lambda p,n:color(n,"white"),sides=12,steps=5)
    s.start("Raised white-tipped tail")
    radii=(.141,.125,.095,.081,.042)
    tail=[]
    for i in range(len(TAIL)-1):
        for f in (0,.48):
            p=TAIL[i].lerp(TAIL[i+1],f)
            r=mix(radii[i],radii[i+1],f)
            weights={f"tail{i}":1}
            if i and not f:
                weights={f"tail{i-1}":.4,f"tail{i}":.6}
            tail.append((p,r,r*.92,weights))
    tail.append((TAIL[-1],radii[-1],radii[-1],{"tail3":1}))
    s.tube(tail,lambda p,n:color(n,"white" if p.y < -1.59 else "tan" if p.y > -1.08 else "black"),sides=10)
    if VARIANT=="golden":
        s.start("Retriever chest ruff")
        s.ellipsoid(V((0,.62,.661)),(.32,.36,.246),"body",lambda p,n:color(n,"white"),sides=14,steps=8)
    return s


RUN_FORE = [(0,-.35,0,0),(.24,-.15,.22,.23),(.48,.38,.30,-.07),
            (.65,.42,.02,-.14),(.80,.15,0,0),(1,-.35,0,0)]
RUN_HIND = [(0,.16,0,0),(.24,-.38,.03,.22),(.44,-.40,.21,.27),
            (.61,-.12,.28,0),(.77,.35,.11,-.08),(.88,.36,0,0),(1,.16,0,0)]
PICKUP = [(0,0),(.27,.11),(.54,1),(.68,.94),(1,0)]
RELEASE = [(0,0),(.19,.26),(.43,.87),(.64,1),(.78,.55),(1,0)]


def pose(rig, rest, clip, t):
    wave=math.tau*t
    walk=clip=="walk"
    fetch=clip in ("pickup","release")
    run=clip=="flee"
    gesture=math.sin(math.pi*t)**2
    dip=gesture*(1 if clip=="pickup" else .67) if fetch else 0
    if ROLLOUT and fetch:
        dip = rows(PICKUP if clip=="pickup" else RELEASE,t)[0]
    sway=.032*math.sin(wave) if walk else .008*math.sin(wave)
    rise= .029*math.cos(2*wave) if walk else .022*(1-math.cos(wave))
    if run:
        rise=-.11+.081*math.cos(wave-.54)
    q=euler((.16 if run else .046)*math.sin(wave)-.117*dip,sway*1.2,0)
    body=transform(q,BODY,BODY+V((sway,.111*dip,rise-.15*dip)))
    result={"body":body@rest["body"]}
    hq=q@euler(-.83*dip + .04*math.sin(wave),0,.11*math.sin(wave)*(1 if clip=="action" else .3))
    head=transform(hq,HEAD,body@HEAD+V((0,.105*dip,-.18*dip)))
    result["head"]=head@rest["head"]
    jaw=rest["jaw"].translation
    open_mouth=(.26 if fetch else .08 if clip=="action" else 0)*gesture
    if ROLLOUT and fetch:
        # Close at the pickup contact. Open while pushing the ball free.
        open_mouth=.42*dip*(1 if t<.54 else 0) if clip=="pickup" else .41*dip
    result["jaw"]=transform(hq@euler(-open_mouth),jaw,head@jaw)@rest["jaw"]
    for side,p in EAR_PIVOT.items():
        flick=(.14 if walk else .07)*math.sin(wave+(0 if side=="l" else 1.5))
        if run:
            flick = -.22 + .30 * math.sin(wave+(.24 if side=="l" else .8))
        result["ear."+side]=transform(hq@euler(-.13*dip+flick,flick*.58,0),p,head@p)@rest["ear."+side]
    for name,(x,y,z,ky,kz,py) in HIPS.items():
        a,b,c=bone_names(name)
        hind=name[0]=="h"
        offset,lift=stride(t,(0 if hind else .24)+(0 if name[1]=="l" else .5),.33,.19) if walk else (0,0)
        roll=-lift
        if run:
            offset,lift,roll=rows(RUN_HIND if hind else RUN_FORE,(t+(.11 if name[1]=="l" else 0))%1)
        hip=body@V((x,y,z))
        toe=V((x,py+offset,.109+lift))
        knee,ankle=solve_knee(hip,toe,rig.data.bones[a].length,rig.data.bones[b].length,
                             V((0,1 if hind else -1,0)))
        result[a]=aimed(rest[a],hip,knee)
        result[b]=aimed(rest[b],knee,ankle)
        result[c]=transform(euler(roll),V((0,0,0)),ankle)
    p=body@TAIL[0]
    for i in range(len(TAIL)-1):
        wiggle=(.18+i*.13)*math.sin(wave*(2 if clip in ("idle","action") else 1)-i*.55)
        sweep=.19+.07*math.sin(wave-i*.4) if run else .07*math.sin(wave-i*.4)
        direction=q@(euler(sweep,0,wiggle*(.45 if run else 1))@(TAIL[i+1]-TAIL[i]))
        result[f"tail{i}"]=aimed(rest[f"tail{i}"],p,p+direction)
        p+=direction
    return result
