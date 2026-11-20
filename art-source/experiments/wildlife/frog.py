"""Common pond frog with crouched haunches, long toes and a springing hop."""
import math

from wildlife_build import CatSurface, V, aimed, euler, rows, solve_knee, transform

NAME = "Common Frog"
DURATIONS = {"idle": 48, "hop": 27, "swim": 27, "action": 20}
PALETTE = {
    "ink": "3c382a", "olive_dark": "66573c", "olive": "8e784c", "olive_light": "b4975d",
    "spot": "675539", "gold": "c2a36d", "gold_light": "d8bd85", "belly": "c2a777",
    "belly_dark": "88724e", "belly_light": "e0c892", "toe": "b28e57",
    "iris": "ae8b45", "pupil": "2d2920", "eye_shine": "f3d9a2", "mouth": "4a3a29",
}
LIGHT = V((-.47,.26,.83)).normalized()
BODY = V((0,-.11,.36))
HEAD = V((0,.40,.42))
LEGS = {
    "fl": (.270,.38,.44,.44,.235,.55),
    "fr": (-.270,.38,.44,.44,.235,.55),
    "hl": (.375,-.37,.42,-.24,.285,-.47),
    "hr": (-.375,-.37,.42,-.24,.285,-.47),
}

def paint(normal, kind):
    options = {
        "back": ("olive_dark", "olive", "olive_light"),
        "belly": ("belly_dark", "belly", "belly_light"),
        "spot": ("ink", "spot", "olive_dark"),
        "gold": ("olive", "gold", "gold_light"),
        "toe": ("olive_dark", "toe", "gold"),
    }[kind]
    light = normal.dot(LIGHT)
    return options[0] if light < -.33 else options[1] if light < .59 else options[2]


def joints():
    result = [
        ("body", BODY, BODY + V((0,.55,0)), None),
        ("head", HEAD, HEAD + V((0,.41,0)), "body"),
        ("throat", HEAD+V((0,.33,-.11)), HEAD+V((0,.54,-.14)), "head"),
    ]
    for name,(x,y,z,ky,kz,py) in LEGS.items():
        sign=1 if x>0 else -1
        knee=(x+sign*(.21 if name[0]=="h" else .049),ky,kz)
        hip,ankle=(x,y,z),(x*1.17,py,.091)
        up,down,toe=(f"{name}.{part}" for part in ("up","down","toe"))
        result.extend(((up,hip,knee,"body"),(down,knee,ankle,up),
                       (toe,ankle,(x*1.17,py+.25,.091),down)))
    return result


def body_paint(p,n):
    mottled = p.z>.43 and abs(p.x)>.15 and math.cos(p.y*13+p.x*8)>.49
    region = "spot" if mottled else "belly" if p.z < .265 else "back"
    return paint(n,region)


def face_paint(p,n):
    if p.z < .36 or (p.y>.65 and p.z<.434):
        return paint(n,"belly")
    if abs(p.x)>.255 and .38 < p.z < .51:
        return paint(n,"spot")
    return paint(n,"back")


def surface():
    s=CatSurface()
    s.start("Low broad oval with mottled green-brown back")
    trunk=[]
    for y,z,w,h in (
        (-.86,.30,.096,.082),(-.71,.31,.275,.179),(-.49,.355,.404,.251),
        (-.24,.374,.432,.266),(.03,.383,.402,.243),(.26,.386,.337,.217),
        (.47,.387,.251,.187),(.56,.393,.127,.137),
    ):
        ring=[V((w*math.cos(math.tau*i/16),y,z+h*math.sin(math.tau*i/16))) for i in range(16)]
        trunk.append((ring,{"body":1} if y < .3 else {"body":.70,"head":.30}))
    s.rings(trunk,body_paint)
    s.start("Broad face and cream jaw")
    s.ellipsoid(HEAD+V((0,.046,.011)),(.399,.367,.211),"head",face_paint,sides=18,steps=10)
    s.ellipsoid(HEAD+V((0,.265,-.116)),(.295,.235,.104),"throat",
                lambda p,n:paint(n,"belly"),sides=16,steps=8)
    s.ellipsoid(HEAD+V((0,.405,-.044)),(.216,.038,.017),"head",
                lambda p,n:"mouth",sides=12,steps=5)
    for sign in (-1,1):
        s.start("High eye socket "+str(sign))
        eye=HEAD+V((sign*.27,.158,.165))
        s.ellipsoid(eye,(.156,.164,.140),"head",lambda p,n:paint(n,"gold"),sides=12,steps=7)
        s.ellipsoid(eye+V((sign*.037,.107,.055)),(.092,.073,.080),"head",
                    lambda p,n:"iris" if n.z>.19 else "olive_dark",sides=10,steps=6)
        s.ellipsoid(eye+V((sign*.056,.159,.064)),(.066,.029,.039),"head",
                    lambda p,n:"eye_shine" if n.z>.83 else "pupil",sides=10,steps=5)
    for name,(x,y,z,ky,kz,py) in LEGS.items():
        sign=1 if x>0 else -1
        hind=name[0]=="h"
        hip,knee,ankle=V((x,y,z)),V((x+sign*(.21 if hind else .049),ky,kz)),V((x*1.17,py,.091))
        up,down,toe=(f"{name}.{part}" for part in ("up","down","toe"))
        s.start(name)
        broad=.171 if hind else .081
        s.tube([
            (hip,broad*.94,broad,{"body":.35,up:.65}),
            (hip.lerp(knee,.54),broad,broad*1.10,{up:1}),
            (hip.lerp(knee,.89),broad*.70,broad*.77,{up:.86,down:.14}),
            (knee.lerp(ankle,.18),broad*.54,broad*.55,{up:.27,down:.73}),
            (knee.lerp(ankle,.59),broad*.46,broad*.49,{down:1}),
            (ankle,.035,.036,{down:.49,toe:.51}),
        ],lambda p,n:paint(n,"gold" if p.z<.23 else "spot" if math.cos(p.y*18)>.58 else "back"),sides=10)
        for digit in (-1,0,1):
            s.tube([
                (ankle+V((digit*.023,.011,-.019)),.035,.026,{toe:1}),
                (ankle+V((digit*.065,.091,-.045)),.029,.022,{toe:1}),
                (ankle+V((digit*.085,.213-abs(digit)*.054,-.067)),.019,.018,{toe:1}),
                (ankle+V((digit*.091,.246-abs(digit)*.055,-.068)),.010,.010,{toe:1}),
            ],lambda p,n:paint(n,"toe"),sides=7)
    return s


HOP = [(0,0,0,0),(.16,-.105,-.065,-.065),(.32,.14,.14,.24),
       (.53,.19,.17,.10),(.70,.10,.13,-.16),(.87,-.065,.08,-.08),(1,0,0,0)]
HIND = [(0,0,0),(.17,.098,0),(.35,-.28,.085),(.54,-.30,.26),
        (.70,.095,.17),(.87,.14,0),(1,0,0)]
FORE = [(0,0,0),(.18,-.03,0),(.36,.16,.15),(.53,.26,.24),
        (.70,.23,.21),(.87,.13,0),(1,0,0)]


def pose(rig,rest,clip,t):
    wave=math.tau*t
    hopping, swimming=clip=="hop",clip=="swim"
    pulse=math.sin(math.pi*t)**2 if clip=="action" else 0
    rise,lean,pitch=rows(HOP,t) if hopping else (.015*math.sin(wave)-.075*swimming,.026*pulse,.011*math.cos(wave))
    bodyq=euler(pitch,.034*math.sin(wave)*int(swimming),0)
    body=transform(bodyq,BODY,BODY+V((0,lean,rise)))
    output={"body":body@rest["body"]}
    hq=bodyq@euler(-.34*pitch+.11*pulse,0,.04*math.sin(wave))
    head=transform(hq,HEAD,body@HEAD+V((0,.039*pulse,-.036*pulse)))
    output["head"]=head@rest["head"]
    throat=rest["throat"].translation
    output["throat"]=transform(hq@euler(-.24*pulse),throat,head@throat+V((0,.052*pulse,-.062*pulse)))@rest["throat"]
    for name,(x,y,z,ky,kz,py) in LEGS.items():
        hind=name[0]=="h"
        sign=1 if x>0 else -1
        up,down,toe=(f"{name}.{part}" for part in ("up","down","toe"))
        if hopping:
            change, lift = rows(HIND if hind else FORE,t)
        elif swimming:
            direction=.33 if hind else .14
            change=direction*math.sin(wave+(0 if hind else math.pi))-.11
            lift=.15+.041*math.sin(wave)
        else:
            change,lift=(0,0)
        hip=body@V((x,y,z))
        toe_position=V((x*1.17+sign*.065*int(swimming),py+change,.091+lift))
        knee,ankle=solve_knee(hip,toe_position,rig.data.bones[up].length,
                             rig.data.bones[down].length,V((sign*.83,.40 if hind else -.25,0)))
        output[up]=aimed(rest[up],hip,knee)
        output[down]=aimed(rest[down],knee,ankle)
        output[toe]=transform(euler(-lift*1.3,0,-sign*.18),V((0,0,0)),ankle)
    return output
