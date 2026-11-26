"""Sprite-guided arthropod bodies. Each profile supplies its own volumes and markings."""
import math
from wildlife_build import CatSurface, V, aimed, euler, stride, transform

BODY = V((0, .02, .34))
HEAD = V((0, .53, .38))
ABDOMEN = V((0, -.37, .41))
LIGHT = V((-.50, .29, .81)).normalized()
SIDES = (("l", 1), ("r", -1))
# Body entries are (lateral width, longitudinal half-length, height).
# Palette entries are ink, shadow, body, light, marking, pale, eye and wing.
PROFILES = {
    "ant": ("Ant", "crawl", "waist", (.18,.28,.15), (.29,.40,.22), (.225,.27,.16),
            ("272822","42372b","71432e","9f5637","b16544","d18c5f","21251f","e6dbb3")),
    "earwig": ("Earwig", "walk", "forceps", (.19,.29,.135), (.228,.50,.145), (.20,.225,.132),
            ("29221e","3c2c26","63463a","8d6350","a67c64","c9a185","29231c","e6dbb3")),
    "leaf-insect": ("Leaf Insect", "walk", "leaf", (.186,.27,.116), (.365,.58,.105), (.19,.225,.135),
                    ("35422b","45562f","6d934b","98b765","afc57e","ccdc9b","303f27","e2efb9")),
    "grasshopper": ("Grasshopper", "hop", "spring", (.185,.31,.17), (.242,.55,.17), (.201,.233,.170),
                    ("313b2b","4b603b","7a9451","a3ae65","c0bc78","ded9a1","283429","e5e1ae")),
    "ladybug": ("Ladybug", "fly", "spotted", (.19,.26,.135), (.394,.48,.32), (.202,.21,.135),
                ("222a25","343a2e","a63728","df5534","c84832","f6b88a","1d2722","e8dfbd")),
    "stag-beetle": ("Stag Beetle", "fly", "antlers", (.22,.29,.156), (.315,.53,.23), (.234,.24,.149),
                    ("24291f","353526","5d4a32","806042","9c7a51","c9aa6b","20271f","dccc95")),
    "roly-poly": ("Roly-poly", "walk", "plates", (.196,.27,.15), (.311,.55,.228), (.190,.27,.134),
                  ("292e27","43463a","676955","8c866c","a59a7c","c0ad87","2b2b23","eee3c6")),
    "bee": ("Bee", "fly", "striped", (.205,.29,.175), (.291,.43,.25), (.200,.245,.19),
            ("292c23","484332","b28730","e6b84e","ecbd54","f1d98e","202821","f1e6c4")),
    "cricket": ("Cricket", "hop", "spring", (.185,.29,.144), (.251,.49,.175), (.184,.229,.149),
                ("352f27","594a36","90754c","b19968","c4ad79","ded0a1","2a2723","e5d6ae")),
    "dragonfly": ("Dragonfly", "fly", "dragonfly", (.192,.28,.145), (.142,.78,.093), (.213,.199,.151),
                   ("30413a","425d52","648479","8fa892","8ba981","bdd1ab","292e28","d3dcc9")),
    "butterfly": ("Orange Butterfly", "flutter", "butterfly", (.136,.27,.117), (.122,.43,.108), (.145,.183,.125),
                   ("2c2d27","534231","a96539","d99258","e5a35c","ebcd89","252721","dfa563")),
    "praying-mantis": ("Praying Mantis", "walk", "mantis", (.164,.31,.143), (.201,.58,.17), (.229,.182,.17),
                        ("31402b","4a673a","739346","9caf5e","a6b067","c6cd8e","2c3827","d1dda3")),
}
STYLE = MOVE = NAME = None
THORAX = TAIL = FACE = None
PALETTE = DURATIONS = None
REVISION = 1
LEG_COUNT = 3


def configure(name):
    global NAME, STYLE, MOVE, THORAX, TAIL, FACE, PALETTE, DURATIONS
    global REVISION, LEG_COUNT
    name, _, revision = name.partition(":")
    REVISION = int(revision or 1)
    NAME,MOVE,STYLE,THORAX,TAIL,FACE,colors=PROFILES[name]
    keys=("ink","shadow","body","light","mark","pale","eye","wing")
    PALETTE=dict(zip(keys,colors))
    DURATIONS={"idle":48,MOVE:23 if MOVE in ("fly","flutter") else 29,"action":23}
    if name=="bee":
        DURATIONS["sip"]=27
    if STYLE=="mantis":
        DURATIONS.update({"feed":25,"display":28})
    if REVISION == 2:
        if STYLE == "plates":
            LEG_COUNT=7
            PALETTE.update({"body":"8a785c","light":"ad9776","mark":"b59c76","shadow":"6a5741"})
        elif STYLE == "striped":
            PALETTE.update({"body":"ac8036","mark":"dfaa41","shadow":"302e26","ink":"232925"})
        elif STYLE == "spotted":
            TAIL=(.453,.43,.348)
            FACE=(.242,.218,.147)
        elif STYLE == "antlers":
            THORAX=(.272,.29,.176)
            FACE=(.271,.236,.173)
        elif STYLE == "waist":
            THORAX=(.126,.225,.14)
            TAIL=(.321,.43,.230)
            PALETTE.update({"body":"92533a","shadow":"38362a","ink":"242923","mark":"b76545"})
        elif STYLE == "forceps":
            TAIL=(.248,.52,.168)
            PALETTE.update({"body":"4e352a","light":"85634d","mark":"a77958"})
        elif STYLE == "leaf":
            FACE=(.146,.194,.109)
            TAIL=(.442,.60,.091)
        elif STYLE == "spring":
            PALETTE.update({"body":"64774a","shadow":"3f5134","mark":"c1ba82"})


def point(side, pair, joint):
    sign=1 if side=="l" else -1
    if STYLE=="mantis" and pair==0:
        return V((sign*(.149,.376,.261)[joint],(.29,.46,.659)[joint],(.352,.252,.486)[joint]))
    if REVISION==2 and STYLE=="plates":
        y=.32-pair*.176
        return V((sign*(.167,.282,.344)[joint],y-(0,.026,.056)[joint],(.280,.174,.061)[joint]))
    y=(.31,.067,-.20)[pair]
    spread=(.20,.29,.235)[pair]
    long_rear=STYLE=="spring" and pair==2
    if REVISION==2 and STYLE=="waist":
        y*=.65
    if joint==0:
        return V((sign*.147,y,.322))
    scale=(1.28 if STYLE in ("waist","forceps","leaf") else .75 if STYLE in ("striped","spotted") else 1) if REVISION==2 else 1
    high=.594 if REVISION==2 and long_rear else .477 if long_rear else .246
    if joint==1:
        return V((sign*(.39 if long_rear else (spread+.139)*scale),y+(.21 if pair==0 else -.10 if pair==2 else -.02),high))
    return V((sign*(.564 if long_rear else (spread+.217)*scale),y+(.27 if pair==0 else -.29 if pair==2 else -.02),.061))


def wing_config(side):
    sign=1 if side=="l" else -1
    return V((sign*.12,.027,.446)),V((sign*.25,-.55,.441))


def flying_profile():
    return MOVE in ("fly","flutter")


def antenna(side):
    sign=1 if side == "l" else -1
    return HEAD+V((sign*.139,.125,.076)), HEAD+V((sign*.324,.576,.154))


def weapon(side):
    sign=1 if side=="l" else -1
    if STYLE=="forceps":
        return ABDOMEN+V((sign*.125,-.404,-.019)),ABDOMEN+V((sign*.267,-1.03 if REVISION==2 else -.937,.009))
    return HEAD+V((sign*.137,.156,-.028)),HEAD+V((sign*.238 if REVISION==2 else sign*.173,.738 if REVISION==2 else .638,.05))


def joints():
    result=[
        ("body",BODY,BODY+V((0,.43,0)),None),("head",HEAD,HEAD+V((0,.30,0)),"body"),
        ("abdomen",ABDOMEN,ABDOMEN+V((0,-.51,0)),"body"),
    ]
    for side,_ in SIDES:
        a,b=antenna(side)
        result.append((f"antenna.{side}",a,b,"head"))
        for i in range(LEG_COUNT):
            start,knee,end=(point(side,i,j) for j in range(3))
            up,down=f"leg.{side}.{i}.up",f"leg.{side}.{i}.down"
            result.extend(((up,start,knee,"body"),(down,knee,end,up)))
        if flying_profile():
            a,b=wing_config(side)
            result.append((f"wing.{side}",a,b,"body"))
        if REVISION==2 and STYLE in ("spotted","antlers"):
            p=ABDOMEN+V((.128 if side=="l" else -.128,.269,.10))
            result.append((f"case.{side}",p,p+V((0,-.46,.06)),"abdomen"))
        if STYLE in ("antlers","forceps","waist"):
            a,b=weapon(side)
            result.append((f"jaw.{side}",a,b,"abdomen" if STYLE=="forceps" else "head"))
    return result


def shade(normal, low="shadow", base="body", high="light"):
    light=normal.dot(LIGHT)
    return low if light < -.30 else base if light < .54 else high


def abdomen_paint(p,n):
    if STYLE=="striped":
        stripe=math.cos((p.y-ABDOMEN.y)*17)
        if stripe>(-.23 if REVISION==2 else .16):
            return shade(n,"ink","shadow","shadow")
        return shade(n,"shadow","body","mark")
    if STYLE=="spotted" and p.z>.47:
        spots=[(.19,-.18),(.22,-.46),(.12,-.66)]
        if any((abs(p.x)-x)**2+(p.y-y)**2<(.009 if REVISION==2 else .0047) for x,y in spots) or abs(p.x)<.038:
            return "ink"
        return shade(n,"shadow","mark","light")
    if STYLE=="leaf":
        if REVISION==2 and abs(p.x)<.041:
            return "shadow"
        if abs(p.x)<.044 or math.cos(p.y*19+abs(p.x)*19)>.70:
            return shade(n,"body","mark","pale")
        return shade(n)
    if STYLE=="waist":
        return shade(n,"ink","shadow","body")
    if REVISION==2 and STYLE=="forceps" and p.z>.42 and -.62<p.y<-.22:
        return "mark" if math.cos(p.y*18)>.13 else "light"
    if REVISION==2 and STYLE=="spring" and p.z>.42:
        return "mark" if abs(p.x)>.14 else "shadow"
    return shade(n)


def surface():
    s=CatSurface()
    s.start("Thorax")
    s.ellipsoid(BODY,THORAX,"body",lambda p,n:shade(n,"shadow","body","mark") if
                REVISION==2 and STYLE=="waist" else shade(n,"shadow","ink","body") if
                REVISION==2 and STYLE=="antlers" else shade(n),sides=14,steps=9)
    s.start("Distinct abdomen sculpture")
    if STYLE=="plates":
        for i in range(7):
            y=ABDOMEN.y+(.39-i*.128)
            amount=math.sin(math.pi*(i+1)/8)
            s.ellipsoid(V((0,y,.362+amount*.059)),
                        (.26+(.147 if REVISION==2 else .081)*amount,.136,.142+amount*.079),"abdomen",
                        lambda p,n:shade(n,"shadow","body","mark"),sides=14,steps=6)
    elif REVISION==2 and STYLE in ("spotted","antlers"):
        s.ellipsoid(ABDOMEN,(TAIL[0]*.82,TAIL[1]*.92,TAIL[2]*.67),"abdomen",
                    lambda p,n:shade(n,"shadow","ink","body"),sides=16,steps=9)
        for side,sign in SIDES:
            s.ellipsoid(ABDOMEN+V((sign*TAIL[0]*.42,-.026,.115)),
                        (TAIL[0]*.565,TAIL[1],TAIL[2]*.71),f"case.{side}",
                        abdomen_paint if STYLE=="spotted" else lambda p,n:shade(n,"mark","shadow","pale"),
                        sides=18,steps=11)
    else:
        s.ellipsoid(ABDOMEN,TAIL,"abdomen",abdomen_paint,sides=22 if STYLE=="spotted" else 16,steps=11)
    if STYLE=="waist":
        s.ellipsoid(BODY+V((0,-.27,.035)),(.098,.193,.096),"body",
                    lambda p,n:shade(n,"ink","body","mark"),sides=10,steps=6)
    s.start("Head")
    s.ellipsoid(HEAD,FACE,"head",lambda p,n:shade(n,"ink","shadow","body") if STYLE=="spotted" or
                REVISION==2 and STYLE in ("waist","antlers","striped") else shade(n),sides=14,steps=8)
    for side, sign in SIDES:
        s.start("Eye and antenna "+side)
        eye=HEAD+V((sign*FACE[0]*.78,FACE[1]*.43,FACE[2]*.42))
        eye_scale=.66 if REVISION==2 and STYLE=="leaf" else 1
        s.ellipsoid(eye,(.077*eye_scale,.078*eye_scale,.085*eye_scale),"head",
                    lambda p,n:"pale" if n.z>.85 and n.y>.22 else "eye",sides=10,steps=6)
        a,b=antenna(side)
        joint=a.lerp(b,.51)+V((sign*.08,-.015,.079))
        s.tube([(a,.030,.029,{f"antenna.{side}":1}),
                (joint,.024,.024,{f"antenna.{side}":1}),
                (b,.013,.015,{f"antenna.{side}":1})],
               lambda p,n:shade(n,"ink","shadow","body"),sides=7)
        if REVISION==2 and STYLE=="spotted":
            s.ellipsoid(HEAD+V((sign*.143,.179,.029)),(.071,.052,.069),"head",
                        lambda p,n:"pale",sides=8,steps=5)
        if STYLE in ("antlers","forceps","waist"):
            s.start("Mandible " + side)
            a,b=weapon(side)
            hook=b+V((-sign*.124,-.095 if STYLE!="forceps" else .080,.023))
            bone=f"jaw.{side}"
            length=(1.02 if REVISION==2 else .77) if STYLE=="antlers" else 1 if STYLE=="forceps" else .38
            b=a.lerp(b,length)
            hook=a.lerp(hook,length)
            s.tube([(a,.073,.068,{bone:1}),(a.lerp(b,.52),.066,.062,{bone:1}),
                    (b,.038,.047,{bone:1}),(hook,.016,.018,{bone:1})],
                   lambda p,n:shade(n,"ink","shadow","light"),sides=8)
            if STYLE=="antlers":
                mid=a.lerp(b,.63)
                s.tube([(mid,.038,.035,{bone:1}),(mid+V((-sign*.134,.112,.038)),.010,.012,{bone:1})],
                       lambda p,n:shade(n,"ink","shadow","light"),sides=7)
        for i in range(LEG_COUNT):
            s.start(f"Leg {side} {i}")
            start,knee,end=(point(side,i,j) for j in range(3))
            up,down=f"leg.{side}.{i}.up",f"leg.{side}.{i}.down"
            thick=(.136 if REVISION==2 else .095) if STYLE=="spring" and i==2 else \
                (.068 if REVISION==2 else .051) if STYLE=="leaf" else .046 if REVISION==2 else .039
            s.tube([
                (start,thick*.84,thick,{up:1}),
                (start.lerp(knee,.63),thick,thick*.83,{up:1}),
                (knee,thick*.47,thick*.49,{up:.55,down:.45}),
                (knee.lerp(end,.67),.026,.028,{down:1}),
                (end,.020,.019,{down:1}),
            ],lambda p,n:shade(n,"ink","shadow","body") if STYLE in ("spotted","antlers","plates") or
               REVISION==2 and (p.z<.135 or STYLE=="spring") else
               shade(n,"shadow","body","light"),sides=8)
            if STYLE=="mantis" and i==0:
                s.ellipsoid(knee.lerp(end,.63),(.073,.103,.129),down,
                            lambda p,n:shade(n,"shadow","body","mark"),sides=10,steps=6)
        if flying_profile():
            s.start("Wing " + side)
            a,b=wing_config(side)
            bone=f"wing.{side}"
            width=.206 if REVISION==2 else .132 if STYLE=="spotted" else .156
            s.tube([(a,.055,.030,{bone:1}),(a.lerp(b,.27),width,.026,{bone:1}),
                    (a.lerp(b,.64),width*.93,.025,{bone:1}),(a.lerp(b,.89),width*.53,.021,{bone:1}),
                    (b,.016,.015,{bone:1})],
                   lambda p,n:"pale" if abs(p.x)<.18 or n.z<-.18 else "wing",sides=10)
            if STYLE in ("dragonfly","butterfly"):
                deluxe=.38 if STYLE=="butterfly" else .145
                for i in range(2):
                    offset=V((sign*(.03+.069*i),-.015-i*.208,.02+i*.020))
                    root=a+offset
                    end=b+offset+V((sign*.095,-.198+i*.197,.023))
                    s.tube([(root,.048,.023,{bone:1}),
                            (root.lerp(end,.39),deluxe*(1-.21*i),.024,{bone:1}),
                            (root.lerp(end,.76),deluxe*.79,.022,{bone:1}),
                            (end,.028,.014,{bone:1})],
                           lambda p,n:"ink" if STYLE=="butterfly" and
                           (p-root).length>(end-root).length*.77 else
                           "mark" if STYLE=="butterfly" and n.z>.3 else "wing",
                           sides=10)
    return s


def pose(rig,rest,clip,t):
    wave=math.tau*t
    flying=clip in ("fly","flutter")
    chase=clip=="chase"
    travel=clip in ("crawl","walk","hop") or chase
    hop=math.sin(math.pi*t)**2 if clip=="hop" else 0
    probe=math.sin(math.pi*t)**2 if clip in ("sip","action","feed","display") else 0
    threat=probe if STYLE=="mantis" and clip=="display" else 0
    bodyq=euler(.16*hop-.11*probe+.42*threat-.12*chase,.041*math.sin(wave)*(travel or flying),0)
    body=transform(bodyq,BODY,BODY+V((0,.031*probe,.026*math.sin(wave)+.115*hop+.057*flying)))
    out={"body":body@rest["body"]}
    hq=bodyq@euler(-.40*probe+.49*threat,0,.13*math.sin(wave)*(clip=="idle"))
    head=transform(hq,HEAD,body@HEAD+V((0,.070*probe,-.08*probe)))
    out["head"]=head@rest["head"]
    curl=.63*probe if REVISION==2 and STYLE=="plates" else 0
    aq=bodyq@euler(.16*math.sin(wave)*travel+.09*flying+curl,0,.10*math.sin(wave))
    abdomen=transform(aq,ABDOMEN,body@ABDOMEN)
    out["abdomen"]=abdomen@rest["abdomen"]
    for side,sign in SIDES:
        a,b=antenna(side)
        name=f"antenna.{side}"
        out[name]=transform(hq@euler(.13*math.sin(wave+sign)-.22*probe,0,sign*.19*math.sin(wave)),a,head@a)@rest[name]
        if STYLE in ("antlers","forceps","waist"):
            a,b=weapon(side)
            name=f"jaw.{side}"
            base,current=(abdomen,aq) if STYLE=="forceps" else (head,hq)
            out[name]=transform(current@euler(0,0,sign*.34*probe),a,base@a)@rest[name]
        for i in range(LEG_COUNT):
            a,knee,end=(point(side,i,j) for j in range(3))
            up,down=f"leg.{side}.{i}.up",f"leg.{side}.{i}.down"
            if travel:
                shift,lift=stride(t,(.5 if (sign==1)==(i%2==0) else 0),
                                  .245 if chase else .145,.12 if chase else .083)
                if clip=="hop" and i==2:
                    shift-=(.40 if REVISION==2 else .29)*hop
                    lift+=.105*hop
            else:
                shift=-.18 if flying else 0
                lift=.14 if flying else 0
            if STYLE=="mantis" and i==0:
                shift+=.26*probe-.18*threat
                lift+=.12*probe+.25*threat+.10*chase
            target=end+V((sign*(-.12 if flying else 0),shift,.052*curl+lift))
            hip=body@a
            k=body@knee+V((sign*(-.055 if flying else 0),.49*shift,.36*lift))
            out[up]=aimed(rest[up],hip,k)
            out[down]=aimed(rest[down],k,target)
        if flying_profile():
            a,b=wing_config(side)
            name=f"wing.{side}"
            spread=1 if flying else .51 if REVISION==2 and STYLE=="striped" else .33*probe
            beat=.68*math.cos(wave*(2 if STYLE in ("striped","dragonfly") else 1))
            wing_dir=(b-a).normalized().lerp(V((sign*.84,-.29,beat)).normalized(),spread).normalized()
            out[name]=aimed(rest[name],body@a,body@(a+wing_dir*(b-a).length))
        if REVISION==2 and STYLE in ("spotted","antlers"):
            name=f"case.{side}"
            p=rest[name].translation
            lift=.64 if flying else .31*probe
            out[name]=transform(aq@euler(-lift,0,sign*lift*.64),p,abdomen@p)@rest[name]
    return out
