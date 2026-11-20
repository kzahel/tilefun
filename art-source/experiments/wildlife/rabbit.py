"""Tuxedo-cat style warm rabbit with a clean saddle and expressive hop."""
import math

from wildlife_build import CatSurface, V, aimed, euler, rows, smooth, solve_knee, transform

NAME = "Meadow Rabbit"
ROLLOUT = False
DURATIONS = {"idle": 48, "hop": 24, "action": 18, "eat": 29}
PALETTE = {
    "ink": "403a32", "deep": "615347", "saddle": "776759", "saddle_light": "8c7b69",
    "tan_deep": "82735e", "tan": "a49075", "tan_light": "bda88b", "shine": "c6b497",
    "cream_shadow": "ab9b84", "cream": "e5d6b8", "cream_light": "f4e6c9",
    "ear_deep": "905e60", "ear": "b37f7b", "ear_light": "ce9c90",
    "eye": "302922", "eye_light": "faf0d9", "nose": "9b6963",
}
LIGHT=V((-.47,.31,.83)).normalized()
BODY=V((0,-.08,.48))
HEAD=V((0,.59,.64))
TAIL=V((0,-.90,.45))
EAR={side:HEAD+V((sign*.176,-.071,.204)) for side,sign in (("l",1),("r",-1))}
HIPS={
    "fl": (.200,.44,.53,.40,.29,.60),
    "fr": (-.200,.44,.53,.40,.29,.60),
    "hl": (.285,-.45,.47,-.22,.25,-.48),
    "hr": (-.285,-.45,.47,-.22,.25,-.48),
}

def configure_rollout():
    global ROLLOUT
    ROLLOUT = True
    PALETTE.update(saddle="61544a", saddle_light="786656", tan="aa9479", tan_light="baa487")


def joints():
    entries=[
        ("body",BODY,BODY+V((0,.60,0)),None),("head",HEAD,HEAD+V((0,.45,0)),"body"),
        ("tail",TAIL,TAIL+V((0,-.28,.09)),"body"),
    ]
    for side,p in EAR.items():
        sign=1 if side=="l" else -1
        entries.append((f"ear.{side}",p,p+V((sign*.116,-.20,.73)),"head"))
    for name,(x,y,z,ky,kz,py) in HIPS.items():
        hip,knee,ankle=(x,y,z),(x,ky,kz),(x,py,.103)
        upper,lower,paw=(f"{name}.{part}" for part in ("upper","lower","paw"))
        entries.extend(((upper,hip,knee,"body"),(lower,knee,ankle,upper),
                        (paw,ankle,(x,py+.2,.103),lower)))
    return entries


def paint(n,region="tan"):
    dot=n.dot(LIGHT)
    colors={
        "tan":("tan_deep","tan","tan_light"),
        "cream":("cream_shadow","cream","cream_light"),
        "saddle":("deep","saddle","saddle_light"),
    }[region]
    return colors[0] if dot < -.25 else colors[1] if dot < .63 else colors[2]


def body_color(p,n):
    if p.z>.59 and (-.91 if ROLLOUT else -.83)<p.y<.40 and (ROLLOUT or abs(p.x)<.44-max(0,p.y)*.26):
        return paint(n,"saddle")
    if p.z<.34 or (p.y>.43 and p.z<.51):
        return paint(n,"cream")
    return paint(n)


def surface():
    s=CatSurface()
    s.start("Rounded haunch and continuous warm saddle")
    rings=[]
    for y,z,w,h in [
        (-1.04,.46,.055,.06),(-.94,.46,.215,.21),(-.74,.46,.398,.37),
        (-.47,.45,.452,.405),(-.19,.47,.398,.375),(.09,.48,.337,.314),
        (.36,.53,.316,.286),(.63,.60,.243,.237),(.78,.61,.10,.151),
    ]:
        if ROLLOUT and y < .36:
            y += max(0, -y) * .13
            w *= 1.16
            h *= 1.15
        ring=[V((w*math.cos(math.tau*i/18),y,z+h*math.sin(math.tau*i/18))) for i in range(18)]
        rings.append((ring,{"body":1} if y<.37 else {"body":.83,"head":.17}))
    s.rings(rings,body_color)
    s.start("Broad cheeks and ivory lip")
    s.ellipsoid(HEAD,(.36,.402,.31),"head",
                lambda p,n:paint(n,"cream" if p.z<.59 and p.y>.71 else "tan"),sides=18,steps=10)
    s.ellipsoid(HEAD+V((0,.349,-.071)),(.239,.202,.132),"head",
                lambda p,n:paint(n,"cream"),sides=14,steps=8)
    s.ellipsoid(HEAD+V((0,.521,-.029)),(.075,.037,.045),"head",
                lambda p,n:"nose" if n.z>-.25 else "deep",sides=10,steps=5)
    for side,sign in (("l",1),("r",-1)):
        pivot=EAR[side]
        ear=f"ear.{side}"
        s.start("Pink-lined ear " + side)
        points=[
            (0,.019,-.046,.121,.083),(.020,-.047,.102,.133,.085),
            (.049,-.112,.302,.133,.070),(.062,-.151,.517,.105,.060),
            (.086,-.186,.682,.060,.049),(.107,-.208,.729,.019,.025),
        ]
        sections=[(pivot+V((sign*x,y,z)),rx,ry,{ear:1}) for x,y,z,rx,ry in points]
        s.tube(sections,
               lambda p,n:("ear_light" if n.z>.19 else "ear") if n.y>.52 and
               abs(p.x-pivot.x-sign*.075)<.099 and p.z>pivot.z+.08 else paint(n,"saddle"),
               sides=10)
        s.start("Dark eye and glint " + side)
        s.ellipsoid(HEAD+V((sign*.257,.248,.094)),(.081,.078,.088),"head",
                    lambda p,n:"eye_light" if n.z>.64 and n.y>.15 else "eye",sides=12,steps=7)
    for name,(x,y,z,ky,kz,py) in HIPS.items():
        s.start(name)
        hip,knee,ankle=V((x,y,z)),V((x,ky,kz)),V((x,py,.103))
        upper,lower,paw=(f"{name}.{part}" for part in ("upper","lower","paw"))
        hind=name.startswith("h")
        broad=.222 if hind else .13
        s.tube([
            (hip+V((0,0,.12)),broad*.72,broad*.99,{"body":.38,upper:.62}),
            (hip,broad,broad*1.15,{upper:1}),
            (hip.lerp(knee,.68),broad*.79,broad*.94,{upper:.93,lower:.07}),
            (knee.lerp(ankle,.14),broad*.53,broad*.67,{upper:.42,lower:.58}),
            (knee.lerp(ankle,.67),.074,.09,{lower:1}),
            (ankle,.068,.077,{lower:.44,paw:.56}),
        ],lambda p,n:paint(n,"cream" if p.z<.17 else "tan"))
        s.ellipsoid(ankle+V((0,.073,-.034)),(.108 if hind else .09,.216 if hind else .145,.069),
                    paw,lambda p,n:paint(n,"cream" if not hind else "tan"),sides=12,steps=6)
    s.start("Cream cotton tail")
    s.ellipsoid(TAIL+V((0,-.137,.046)),(.167,.200,.155),"tail",
                lambda p,n:paint(n,"cream" if n.z>.04 or n.y<-.36 else "tan"),sides=12,steps=7)
    return s


HOP_BODY=[
    (0,0,0,0),(.16,-.13,-.15,-.10),(.32,.05,.02,.26),
    (.51,.10,.04,.10),(.68,.08,.06,-.14),(.82,-.13,.10,-.12),(1,0,0,0),
]
HOP_FORE=[
    (0,0,0,0),(.16,-.10,0,0),(.32,.10,.20,.25),(.52,.27,.26,-.17),
    (.68,.29,.15,-.30),(.79,.17,0,0),(1,0,0,0),
]
HOP_HIND=[
    (0,0,0,0),(.16,.16,0,0),(.33,-.24,.03,.42),(.51,-.10,.25,.27),
    (.70,.30,.22,-.03),(.85,.19,0,0),(1,0,0,0),
]


def pose(rig,rest,clip,t):
    wave=math.tau*t
    ishop=clip=="hop"
    feed=math.sin(math.pi*t)**.78 if clip in ("action","eat") else 0
    if ROLLOUT and clip == "action":
        feed = 0
    alert = math.sin(math.pi*t)**2 if ROLLOUT and clip=="action" else 0
    rise,lean,pitch=rows(HOP_BODY,t) if ishop else (.014*math.sin(wave)-.11*feed,.07*feed,.05*math.sin(wave)-.10*feed)
    q=euler(pitch)
    body=transform(q,BODY,BODY+V((0,lean,rise)))
    output={"body":body@rest["body"]}
    chew=.046*math.sin(wave*7)*feed if clip=="eat" else 0
    hq=q@euler(-(.74 if ROLLOUT else .48)*feed+chew-.10*math.sin(wave)*int(ishop),
               0, .38*alert*math.sin(wave))
    head_origin=body@HEAD+V((0,.054*feed,-(.22 if ROLLOUT else .15)*feed+.049*alert))
    h=transform(hq,HEAD,head_origin)
    output["head"]=h@rest["head"]
    output["tail"]=transform(q@euler(.11*math.sin(wave)),TAIL,body@TAIL)@rest["tail"]
    for side,p in EAR.items():
        sign=1 if side=="l" else -1
        flex=-.26*math.sin(math.pi*t) if ishop else -.21*feed
        flutter=(.074+.22*alert)*math.sin(wave+(0 if side=="l" else 1.2))
        output["ear."+side]=transform(hq@euler(flex+flutter,sign*.045*math.sin(wave),0),p,h@p)@rest["ear."+side]
    for name,(x,y,z,ky,kz,py) in HIPS.items():
        upper,lower,paw=(f"{name}.{part}" for part in ("upper","lower","paw"))
        hind=name.startswith("h")
        offset,lift,roll=rows(HOP_HIND if hind else HOP_FORE,t) if ishop else (0,0,0)
        hip=body@V((x,y,z))
        splay = .092*math.sin(math.pi*t)**2 if ROLLOUT and hind and ishop else 0
        toe=V((x+math.copysign(splay,x),py+offset,.103+lift))
        knee,ankle=solve_knee(hip,toe,rig.data.bones[upper].length,rig.data.bones[lower].length,V((0,1 if hind else -1,0)))
        output[upper]=aimed(rest[upper],hip,knee)
        output[lower]=aimed(rest[lower],knee,ankle)
        output[paw]=transform(euler(roll),V((0,0,0)),ankle)
    return output
