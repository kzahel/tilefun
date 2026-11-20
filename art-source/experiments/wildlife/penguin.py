"""Penguin with upright waddles and prone aquatic strokes."""
import math

from wildlife_build import CatSurface, V, aimed, euler, stride, transform

NAME = "Penguin"
PALETTE = dict(zip(
    ("back", "dark", "wing", "white", "yellow", "feet", "edge", "beak", "eye"),
    "2b3939 1e302f 475555 dedbd0 d7bb6b 62584c a6afa6 ad8042 102528".split(),
))
DURATIONS = {"idle":48,"walk":30,"swim":30,"action":22,"flee":19,"flee-swim":17}
LIGHT = V((-.43,.28,.86)).normalized()
BODY = V((0,0,.83))
HEAD = V((0,.059,1.30))
TAIL = V((0,-.184,.386))
SIDES = (("L",-1),("R",1))


def appendages(side):
    sign = dict(SIDES)[side]
    wing = (V((sign*.237,-.025,1.155)),V((sign*.327,-.095,.86)),
            V((sign*.387,-.171,.550)))
    leg = (V((sign*.126,.063,.505)),V((sign*.158,.095,.226)),
           V((sign*.172,.140,.107)))
    return wing, leg


def joints():
    bones = [("body",BODY,BODY+V((0,0,.43)),None),
             ("head",HEAD,HEAD+V((0,.119,.23)),"body"),
             ("tail",TAIL,TAIL+V((0,-.265,-.058)),"body")]
    for side, _ in SIDES:
        (a,b,c),(d,e,f) = appendages(side)
        bones += [(f"flipper.{side}",a,b,"body"),(f"tip.{side}",b,c,f"flipper.{side}"),
                  (f"leg.{side}",d,e,"body"),(f"foot.{side}",e,f,f"leg.{side}")]
    return bones


def coat(p,n):
    if p.y > .025 and n.y > -.02 and abs(p.x)<(.304 if p.z<1.18 else .178):
        return "white" if n.dot(LIGHT)>-.34 else "edge"
    return "wing" if n.dot(LIGHT)>.62 else "dark" if n.dot(LIGHT)<-.40 else "back"


def head_ink(p,n):
    if p.z < 1.38 and p.y > .123:
        return "white" if n.y>.38 else "yellow"
    return "dark" if n.dot(LIGHT)<-.39 else "back"


def surface():
    s = CatSurface()
    s.start("Dark coat and cream bib")
    s.ellipsoid(BODY,(.345,.371,.564),"body",coat,sides=26,steps=17)
    s.ellipsoid(HEAD+V((0,.003,.160)),(.229,.267,.242),"head",head_ink,sides=23,steps=13)
    s.start("Bill and cheek marks")
    s.tube([(V((0,.249,1.468)),.094,.057,{"head":1}),
            (V((0,.395,1.461)),.063,.039,{"head":1}),
            (V((0,.502,1.436)),.013,.008,{"head":1})],
           lambda p,n:"beak" if n.z>-.34 else "yellow",sides=11)
    for side, sign in SIDES:
        patch = V((sign*.172,.181,1.366))
        s.ellipsoid(patch,(.058,.075,.081),"head",lambda p,n:"yellow",sides=13,steps=8)
        eye = V((sign*.152,.203,1.519))
        s.ellipsoid(eye,(.039,.037,.038),"head",
                    lambda p,n:"edge" if n.z>.78 else "eye",sides=10,steps=7)
        (a,b,c),(d,e,f) = appendages(side)
        front, tip = f"flipper.{side}", f"tip.{side}"
        s.start("Tapered flipper "+side)
        s.tube([(a,.092,.111,{front:1}),(a.lerp(b,.50),.078,.150,{front:1}),
                (b,.066,.129,{front:.53,tip:.47}),
                (b.lerp(c,.64),.049,.074,{tip:1}),(c,.018,.023,{tip:1})],
               lambda p,n:"wing" if n.dot(LIGHT)>.22 else "dark",sides=12)
        s.start("Black webbed foot "+side)
        leg, foot = f"leg.{side}", f"foot.{side}"
        s.tube([(d,.092,.085,{leg:1}),(e,.067,.060,{leg:.44,foot:.56}),
                (f,.058,.061,{foot:1})],lambda p,n:"dark",sides=10)
        s.ellipsoid(f+V((sign*.026,.092,-.043)),(.103,.169,.058),foot,
                    lambda p,n:"feet" if n.z>.56 else "dark",sides=14,steps=8)
    s.start("Tail feathers")
    s.tube([(TAIL,.108,.066,{"tail":1}),
            (TAIL+V((0,-.184,-.038)),.119,.045,{"tail":1}),
            (TAIL+V((0,-.303,-.065)),.067,.022,{"tail":1})],
           lambda p,n:"wing" if n.z>.51 else "dark",sides=10)
    return s


def pose(_,rest,clip,t):
    wave = math.tau*t
    aquatic = clip in ("swim","flee-swim")
    fast = clip in ("flee","flee-swim")
    walking = clip in ("walk","flee")
    stretch = math.sin(math.pi*t)**2 if clip=="action" else 0
    drive = 2*wave if fast and aquatic else wave
    trunk_pitch = -1.44 if aquatic else -.22 if fast else .005
    trunk_pitch += .083*math.sin(drive)-.09*stretch
    q = euler(trunk_pitch,.052*math.sin(drive),(.11 if walking else .039)*math.sin(drive))
    root_z = (.34 if aquatic else .84)+(.039 if walking else .027)*math.cos(2*wave)+.078*stretch
    body = transform(q,BODY,V((.056*math.sin(wave)*walking,0,root_z)))
    output = {"body":body@rest["body"]}
    hq = q@euler((.18 if aquatic else .003)-.27*stretch+.043*math.sin(wave),0,
                .10*math.sin(wave)*(not fast))
    output["head"] = transform(hq,HEAD,body@HEAD)@rest["head"]
    tail_q = q@euler(.08*math.sin(drive),0,.075*math.sin(wave))
    output["tail"] = transform(tail_q,TAIL,body@TAIL)@rest["tail"]
    for side, sign in SIDES:
        (a,b,c),(d,e,f) = appendages(side)
        beat = math.sin(drive+sign*.11)
        flare = .43*stretch if not aquatic else .61+(.48 if fast else .34)*beat
        rotation = euler(-.074*math.sin(wave)*sign,sign*-flare,0)
        elbow = body@a + q@(rotation@(b-a))
        tip = elbow+q@(rotation@(euler(.18*beat,sign*-.18*flare,0)@(c-b)))
        output[f"flipper.{side}"] = aimed(rest[f"flipper.{side}"],body@a,elbow)
        output[f"tip.{side}"] = aimed(rest[f"tip.{side}"],elbow,tip)
        advance,lift = stride(t,0 if sign<0 else .5,.263 if fast else .175,
                              .107 if fast else .069) if walking else (0,0)
        ankle = body@e+V((0,advance*.78,lift*.56)) if not aquatic else body@e
        foot = f+V((0,advance,lift)) if not aquatic else body@f+V((0,0,.035*beat))
        output[f"leg.{side}"] = aimed(rest[f"leg.{side}"],body@d,ankle)
        output[f"foot.{side}"] = aimed(rest[f"foot.{side}"],ankle,foot)
    return output
