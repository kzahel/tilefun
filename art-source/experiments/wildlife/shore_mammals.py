"""Low amphibious mammals and a heavy pond walker, from the active sprite bank."""
import math

from wildlife_build import CatSurface, V, aimed, euler, solve_knee, stride, transform

LIGHT = V((-.41,.31,.86)).normalized()
SIDES = (("L",-1),("R",1))
PROFILES = {
    "river-otter": ("River otter",(.318,.775,.274),
                    "493e31 77614a a18b69 dbd1b7 26302b d0ba90"),
    "platypus": ("Platypus",(.351,.66,.253),
                 "4c4738 786344 8b7654 bea978 26302b 8e8262"),
    "hippopotamus": ("Hippopotamus",(.605,.954,.519),
                     "6a554f 987b70 b49a88 d1af9a 202725 4f443f"),
}
NAME = STYLE = PALETTE = DURATIONS = DIMS = BODY = HEAD = JAW = FEET = TAIL = None


def configure(species):
    global NAME, STYLE, PALETTE, DURATIONS, DIMS, BODY, HEAD, JAW, FEET, TAIL
    STYLE = species
    NAME, DIMS, colors = PROFILES[species]
    PALETTE = dict(zip(("dark","coat","light","cream","eye","accent"),colors.split()))
    hippo = STYLE == "hippopotamus"
    DURATIONS = {"idle":48,"walk":33,"action":23,"flee":20}
    if not hippo:
        DURATIONS.update({"swim":28,"flee-swim":17})
    width,length,depth = DIMS
    BODY = V((0,0,.732 if hippo else .391))
    HEAD = BODY+V((0,.84*length,.025))
    JAW = HEAD+V((0,.109,-.16 if hippo else -.071))
    FEET = {}
    for suffix, sign in SIDES:
        for name, side_y in (("fore",1),("hind",-1)):
            root = BODY+V((sign*width*.71,side_y*length*.61,-depth*.36))
            middle = root+V((sign*(.083 if hippo else .11),side_y*-.088,-.231 if hippo else -.127))
            end = V((middle.x+sign*.033,middle.y+side_y*.128,.105 if hippo else .077))
            FEET[f"{name}.{suffix}"] = (root,middle,end)
    base = BODY+V((0,-length*.85,-.076 if not hippo else .058))
    offsets = (((0,0,0),(0,-.14,-.047),(0,-.27,-.096)) if hippo else
               ((0,0,0),(0,-.35,-.079),(0,-.69,-.121),(0,-1.02,-.110)))
    TAIL = [base+V(offset) for offset in offsets]


def joints():
    result = [("body",BODY,BODY+V((0,.37,0)),None),
              ("head",HEAD,HEAD+V((0,.36,0)),"body"),
              ("jaw",JAW,JAW+V((0,.33,-.026)),"head")]
    for name,(a,b,c) in FEET.items():
        result += [(name+".upper",a,b,"body"),(name+".lower",b,c,name+".upper"),
                   (name+".paw",c,c+V((0,.17,0)),name+".lower")]
    result.extend((f"tail.{i}",a,b,f"tail.{i-1}" if i else "body")
                  for i,(a,b) in enumerate(zip(TAIL,TAIL[1:])))
    return result


def skin(p,n):
    strength = n.dot(LIGHT)
    if STYLE == "river-otter" and p.y>.36 and p.z<BODY.z+.063:
        return "cream" if strength>-.50 else "accent"
    if strength < -.46:
        return "dark"
    return "light" if strength > .76 else "coat"


def head_surface(s):
    hippo = STYLE == "hippopotamus"
    otter = STYLE == "river-otter"
    spine = HEAD+V((0,-.16,.025))
    s.ellipsoid(spine,(.412,.307,.337) if hippo else (.224,.279,.218),
                "head",skin,sides=19,steps=13)
    if hippo:
        muzzle = HEAD+V((0,.35,-.126))
        s.ellipsoid(muzzle,(.469,.372,.233),"head",skin,sides=24,steps=15)
        s.ellipsoid(JAW+V((0,.285,-.081)),(.390,.346,.115),"jaw",skin,sides=20,steps=12)
        s.ellipsoid(muzzle+V((0,.06,-.179)),(.342,.271,.045),"head",
                    lambda p,n:"dark",sides=14,steps=8)
        for sign in (-1,1):
            nose = muzzle+V((sign*.169,.294,.089))
            s.ellipsoid(nose,(.069,.028,.042),"head",lambda p,n:"accent",sides=10,steps=7)
            tooth = JAW+V((sign*.247,.492,-.016))
            s.tube([(tooth,.051,.049,{"jaw":1}),
                    (tooth+V((0,.036,.115)),.017,.017,{"jaw":1})],
                   lambda p,n:"cream",sides=9)
    elif otter:
        muzzle = HEAD+V((0,.194,-.061))
        s.ellipsoid(muzzle,(.181,.208,.117),"head",lambda p,n:"cream",sides=17,steps=10)
        s.ellipsoid(muzzle+V((0,.168,.021)),(.089,.057,.049),"head",
                    lambda p,n:"eye",sides=12,steps=8)
        s.ellipsoid(JAW+V((0,.169,-.023)),(.116,.166,.064),"jaw",
                    lambda p,n:"cream",sides=14,steps=8)
    else:
        s.ellipsoid(HEAD+V((0,.239,-.081)),(.218,.270,.056),"head",
                    lambda p,n:"eye" if n.dot(LIGHT)<-.27 else "dark",sides=19,steps=11)
        s.ellipsoid(JAW+V((0,.185,-.068)),(.176,.206,.036),"jaw",
                    lambda p,n:"eye",sides=15,steps=9)
    for sign in (-1,1):
        eye = HEAD+V((sign*(.325 if hippo else .178),.112,.140 if hippo else .081))
        size = .052 if hippo else .041
        s.ellipsoid(eye,(size,size,size),"head",
                    lambda p,n:"cream" if n.z>.84 else "eye",sides=11,steps=7)
        if otter or hippo:
            ear = HEAD+V((sign*(.289 if hippo else .179),-.076,.229 if hippo else .162))
            radius = .091 if hippo else .066
            s.ellipsoid(ear,(radius,.052,radius),"head",
                        lambda p,n:"accent" if n.y>.40 else skin(p,n),sides=11,steps=7)


def surface():
    s = CatSurface()
    s.start("Full trunk")
    s.ellipsoid(BODY,DIMS,"body",skin,sides=29,steps=18)
    s.start("Face and jointed mouth")
    head_surface(s)
    hippo = STYLE=="hippopotamus"
    for name,(a,b,c) in FEET.items():
        s.start(name)
        upper,lower,paw = name+".upper",name+".lower",name+".paw"
        radius = .179 if hippo else .091
        s.tube([(a,radius,radius*.98,{upper:1}),(a.lerp(b,.51),radius*.89,radius*.90,{upper:1}),
                (b,radius*.76,radius*.70,{upper:.49,lower:.51}),
                (c,radius*.57,radius*.56,{lower:.42,paw:.58})],skin,sides=11)
        s.ellipsoid(c+V((0,.062,-.037)),
                    (.143,.174,.071) if hippo else (.097,.142,.046),paw,
                    lambda p,n:"accent" if hippo else "dark",sides=14,steps=8)
    s.start("Tail")
    if STYLE=="platypus":
        radius = .235
    else:
        radius = .143 if not hippo else .078
    parts = []
    for i,(a,b) in enumerate(zip(TAIL,TAIL[1:])):
        for fraction in (0,.48,.77):
            progress = (i+fraction)/(len(TAIL)-1)
            taper = math.sin(.49+math.pi*.63*progress) if STYLE=="platypus" else (1-progress)**.77
            r = radius*taper+.014
            weights = {f"tail.{i-1}":.5,f"tail.{i}":.5} if i and not fraction else {f"tail.{i}":1}
            parts.append((a.lerp(b,fraction),r,r*(.32 if STYLE=="platypus" else .85),weights))
    parts.append((TAIL[-1],.081 if STYLE=="platypus" else .019,.016,
                  {f"tail.{len(TAIL)-2}":1}))
    s.tube(parts,skin,sides=13)
    return s


def pose(rig,rest,clip,t):
    wave = math.tau*t
    aquatic = clip in ("swim","flee-swim")
    fast = clip in ("flee","flee-swim")
    stepping = clip in ("walk","flee")
    hippo = STYLE=="hippopotamus"
    swim_wave = wave*(2 if fast else 1)
    gesture = math.sin(math.pi*t)**2 if clip=="action" else 0
    pitch = .033*math.sin(wave)-(.09 if hippo else .13)*gesture
    pitch += (.115 if fast else .049)*math.sin(swim_wave) if aquatic else -.085*fast
    sway = (.067 if fast else .033)*math.sin(swim_wave) if aquatic else .031*math.sin(wave)
    q = euler(pitch,sway,.039*math.cos(wave))
    lift = .018*math.cos(wave*2)+(.065 if not hippo else .046)*fast*math.sin(wave)**2
    body = transform(q,BODY,BODY+V((.033*math.sin(wave)*stepping,0,lift-.125*aquatic)))
    out = {"body":body@rest["body"]}
    hq = q@euler((-.24 if hippo else .24)*gesture+.045*math.sin(wave),0,.085*math.sin(wave))
    head = transform(hq,HEAD,body@HEAD+V((0,.072*gesture,.086*hippo*gesture)))
    out["head"] = head@rest["head"]
    opening = (.77 if hippo else .38)*gesture
    out["jaw"] = transform(hq@euler(-opening),JAW,head@JAW)@rest["jaw"]
    for name,(a,b,c) in FEET.items():
        fore = name.startswith("fore")
        left = name.endswith(".L")
        phase = .50*(fore != left)
        advance,lift = stride(t,phase,.31 if fast else .20,.102 if fast else .065) if stepping else (0,0)
        target = c+V((0,advance,lift))
        if aquatic:
            paddling = swim_wave + phase*math.tau
            backstroke = (.24 if fast else .17)*math.sin(paddling)
            target = body@c + V(((-1 if left else 1)*.081*math.cos(paddling),
                                 backstroke,.153+.093*math.cos(paddling)))
        up,down,foot = name+".upper",name+".lower",name+".paw"
        hip = body@a
        knee,ankle = solve_knee(hip,target,rig.data.bones[up].length,rig.data.bones[down].length,
                                 V((0,-1 if fore else 1,0)))
        out[up] = aimed(rest[up],hip,knee)
        out[down] = aimed(rest[down],knee,ankle)
        paw_rotation = euler(-.31*math.sin(swim_wave+phase*math.tau) if aquatic else -.58*lift)
        out[foot] = transform(paw_rotation,c,ankle)@rest[foot]
    cursor = body@TAIL[0]
    for i,(a,b) in enumerate(zip(TAIL,TAIL[1:])):
        phase = swim_wave-i*.73
        yaw = (.30 if fast else .19 if aquatic else .091)*math.sin(phase)
        bend = (.13 if aquatic else .063)*math.cos(phase)-.17*gesture
        delta = q@(euler(bend,0,yaw)@(b-a))
        name = f"tail.{i}"
        out[name] = aimed(rest[name],cursor,cursor+delta)
        cursor += delta
    return out
