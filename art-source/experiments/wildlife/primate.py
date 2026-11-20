"""Sprite-guided primates and upright animals with species-shaped limbs and faces."""
import math
from wildlife_build import CatSurface, V, aimed, euler, solve_knee, stride, transform

# Torso half-width/half-depth/height, shoulder and hip height, arm reach,
# head width, tail reach, feature and palette.
PROFILES={
    "gorilla":("Silverback Gorilla",(.54,.46,.49),.89,1.03,.67, .29,.14,"gorilla",
               "282b2a 484a45 6d7068 8c8e82 a3a497 55514b 33332f 7f8079"),
    "chimpanzee":("Chimpanzee",(.37,.34,.40),.77,.92,.59,.245,.09,"chimp",
                   "292b29 49443d 706052 967665 c3a286 987a63 392f2c a48872"),
    "orangutan":("Orangutan",(.44,.38,.47),.84,.94,.74,.268,.10,"orange",
                  "392d27 66412f 905338 b57143 d09d75 a67d62 43332d 9e5a39"),
    "capuchin-monkey":("Capuchin Monkey",(.33,.33,.34),.67,.78,.52,.193,.72,"capuchin",
                       "342922 594333 79604a a38868 c7ad8a a7896c 3d322a 977859"),
    "ring-tailed-lemur":("Ring-tailed Lemur",(.30,.38,.33),.63,.78,.49,.177,.94,"rings",
                        "292e2f 555859 797e7e a3a39b e1d8c1 b1aba1 333537 c6bba4"),
    "mandrill":("Mandrill",(.38,.36,.41),.76,.90,.57,.205,.19,"mandrill",
                "302c2b 545047 767160 989482 bbb49b 695d50 302c2b b2645e"),
    "proboscis-monkey":("Proboscis Monkey",(.36,.38,.40),.71,.85,.54,.204,.65,"nose",
                        "4d392e 7a5643 a6785b c19c7b e0c3a0 b78e70 493833 a56759"),
    "japanese-macaque":("Japanese Macaque",(.354,.33,.41),.72,.85,.53,.218,.30,"macaque",
                        "4b3d34 796655 9d8873 bda792 d6bfa6 a97469 493a36 9b655d"),
    "kangaroo":("Kangaroo",(.36,.34,.53),.90,1.15,.40,.202,1.02,"roo",
                "4c3c31 7f5b43 ac7e58 c8a378 e4c49d ae8a6b 554132 88704c"),
    "wallaby":("Red-necked Wallaby",(.34,.32,.46),.81,1.02,.35,.192,.83,"roo-red",
               "4c3b32 865b46 b38764 c8aa83 e3c9a7 ab876b 514139 a16d52"),
    "elephant-upright":("Upright Elephant",(.43,.34,.49),.66,1.19,.60,.278,.22,"elephant",
                       "40474d 656e75 859198 a9b3b4 d5cbbb b7a5a0 4a5258 e1d9be"),
    "giraffe-upright":("Upright Giraffe",(.36,.31,.50),.75,1.29,.62,.213,.34,"giraffe",
                      "544232 89684b bb9160 d1ad75 ebd0a2 ac8b69 66503e 99734d"),
}
SIDES=(("l",1),("r",-1))
LIGHT=V((-.44,.32,.84)).normalized()
NAME=STYLE=PALETTE=DURATIONS=None
DIMS=HIP=CHEST=HEAD=TAIL=LIMBS=ARM=None
ROLLOUT_MOTION=None


def configure(variant):
    global NAME,STYLE,PALETTE,DURATIONS,DIMS,HIP,CHEST,HEAD,TAIL,LIMBS,ARM
    NAME,DIMS,leg,shoulder,ARM,face,tail,STYLE,colors=PROFILES[variant]
    PALETTE=dict(zip(("ink","shadow","coat","light","face","nose","eye","accent"),colors.split()))
    if STYLE=="mandrill":
        PALETTE["blue"]="658e9a"
    DURATIONS={"idle":48,"walk":29,"hop":23,"action":25,"climb":29,"pickup":23,"eat":27,"sit":34}
    upright=is_upright()
    HIP=V((0,-.15,leg))
    CHEST=V((0,.05 if upright else .39,shoulder))
    face_y=.10 if upright else .53
    HEAD=V((0,face_y,shoulder+(.56 if STYLE=="giraffe" else .34 if upright else .22)))
    TAIL=[HIP+V(p) for p in (
        (0,-.14,.035),(0,-.22-tail*.3,.031+(tail*.12 if not is_roo() else -tail*.19)),
        (0,-.22-tail*.67,.085+(tail*.28 if not is_roo() else -tail*.29)),
        (0,-.20-tail,.094+(tail*.59 if not is_roo() else -tail*.39)),
    )]
    LIMBS={}
    w,d,h=DIMS
    for label,sign in SIDES:
        for fore in (True,False):
            name=("arm" if fore else "leg")+"."+label
            root=CHEST if fore else HIP
            a=root+V((sign*w*(.78 if fore else .49),.048 if fore else -.031,-.135 if fore else -.095))
            if upright and fore:
                b=a+V((sign*.056,.152,-ARM*.49))
                c=b+V((sign*.017,.133,-ARM*.37))
            elif fore:
                b=a+V((sign*.132,.095,-a.z*.51))
                c=V((sign*w*.98,a.y+.207,.103))
            else:
                b=a+V((sign*.048,.175,-a.z*.49))
                c=V((sign*w*.73,a.y-.143 if upright else a.y-.09,.104))
            LIMBS[name]=(a,b,c)
    DIMS=(*DIMS,face)


def configure_rollout():
    global ROLLOUT_MOTION, DURATIONS, PALETTE
    # Active sprite colors, arm reach, action lean, and escape stride gain.
    profiles = {
        "gorilla": ("20292e 354247 3e494e 7f8c8f 8c9692 586366 20292e 657378", .16,.14,.27),
        "chimp": ("222b2d 394342 394342 68716a ae9a7c 776d5e 222b2d b7a58b", .24,.21,.34),
        "orange": ("2d2d2a 64534a a5653a cc9256 8f7056 74614c 2d2d2a cc9256", .18,.19,.29),
        "macaque": ("252927 85816d b5af95 b5af95 cd8b7d a65c55 252927 a65c55", .17,.23,.30),
        "mandrill": ("252927 676945 676945 929471 d3bc81 90534c 252927 bf6052", .13,.20,.27),
        "nose": ("252927 a8795d 956b40 d89b70 d8ba84 a8795d 252927 bf6052", .15,.24,.31),
        "rings": ("252927 514b42 858e89 aab1a1 e6e0c8 bf6052 252927 d2a65c", .20,.17,.35),
        "elephant": ("141c18 5d6965 8d9390 b9bbb0 e5d9b9 a88a7f 141c18 e5d9b9", .26,.17,.31),
        "giraffe": ("151a17 785138 c99e56 e5c780 d6bd83 a66e43 151a17 d6bd83", .20,.25,.36),
        "roo": ("252f28 513426 a7673c c78e55 e3d0a2 805138 252f28 403c30", .13,.12,.27),
        "roo-red": ("262d2b 6b5744 9a8268 b69c79 d9c7a4 9c7965 323832 b4a18b", .09,.10,.21),
    }
    colors, reach, lean, bound = profiles[STYLE]
    PALETTE.update(zip(("ink","shadow","coat","light","face","nose","eye","accent"),colors.split()))
    if STYLE=="mandrill":
        PALETTE["blue"]="557f9c"
    ROLLOUT_MOTION = (reach, lean, bound)
    DURATIONS = {"idle":48,("hop" if is_roo() else "walk"):31,"action":25,"flee":21}


def is_roo():
    return STYLE in ("roo","roo-red")


def is_upright():
    return is_roo() or STYLE in ("elephant","giraffe")


def joints():
    root=HIP.lerp(CHEST,.57)
    result=[("body",root,root+V((0,.32,.32)),None),
            ("head",HEAD,HEAD+V((0,.28,0)),"body")]
    for name,(a,b,c) in LIMBS.items():
        up,down,tip=f"{name}.u",f"{name}.d",f"{name}.tip"
        result.extend(((up,a,b,"body"),(down,b,c,up),(tip,c,c+V((0,.21,0)),down)))
    for i,(a,b) in enumerate(zip(TAIL,TAIL[1:])):
        result.append((f"tail{i}",a,b,f"tail{i-1}" if i else "body"))
    if STYLE=="elephant":
        a=HEAD+V((0,.24,-.05))
        b=a+V((0,.095,-.41))
        result.append(("trunk",a,b,"head"))
    return result


def band(n,base="coat",shadow="shadow",light="light"):
    value=n.dot(LIGHT)
    return shadow if value<-.42 else light if value>.63 else base


def coat(p,n):
    if ROLLOUT_MOTION and STYLE=="gorilla":
        if -.43<p.y<.24 and p.z>HIP.z+.18 and n.z>.33:
            return "light" if n.z>.61 else "accent"
        return band(n,"coat","shadow","accent")
    if STYLE=="gorilla" and p.y<.30 and p.z>HIP.z-.15:
        return band(n,"light","coat","face")
    if STYLE=="giraffe":
        card_y=(p.z*5.4+math.floor(p.y*5)*.34)%1-.5
        card_x=((p.x+p.y)*5.71+math.floor(p.z*5)*.31)%1-.5
        return "shadow" if abs(card_y)<.37 and abs(card_x)<.34 else band(n,"face","coat","face")
    if STYLE=="roo-red" and p.z>HIP.z+.14 and p.y>-.05:
        return band(n,"accent")
    if STYLE in ("rings","roo","roo-red") and p.y>.17 and n.y>.18:
        return band(n,"face","coat","face")
    if ROLLOUT_MOTION and STYLE=="macaque" and p.z<HIP.z+.10:
        return band(n,"shadow","nose","coat")
    return band(n)


def face_color(p,n):
    q=p-HEAD
    if STYLE in ("giraffe","elephant"):
        return coat(p,n)
    if q.y>.015 and abs(q.x)<DIMS[3]*.88 and q.z<DIMS[3]*.66:
        if ROLLOUT_MOTION and STYLE=="gorilla":
            return "ink" if n.z<.12 else "shadow"
        if STYLE=="mandrill":
            return "accent" if abs(q.x)<DIMS[3]*.34 else "blue"
        if STYLE=="rings" and .061<abs(q.x) and q.z>.019:
            return "ink"
        return band(n,"face","nose","face")
    return coat(p,n)


def surface():
    s=CatSurface()
    w,d,h,r=DIMS
    s.start("Species chest and pelvis")
    center=HIP.lerp(CHEST,.56)
    shell_shape=(w,d,h) if is_upright() else (w,d*1.38,h*.82)
    s.ellipsoid(center,shell_shape,"body",coat,sides=20,steps=11)
    top=CHEST+V((0,.021,.10))
    s.ellipsoid(top,(w*(.96 if STYLE in ("gorilla","orange") else .79),d*.81,h*.72),"body",coat,sides=16,steps=9)
    s.start("Neck and face")
    neck_from=CHEST+V((0,.057,.14))
    s.tube([(neck_from,r*.80,r*.77,{"body":.88,"head":.12}),
            (neck_from.lerp(HEAD,.48),r*.57,r*.58,{"body":.52,"head":.48}),
            (HEAD+V((0,0,-r*.13)),r*.77,r*.74,{"head":1})],
           coat,sides=12)
    s.ellipsoid(HEAD,(r,r*.89,r*.97),"head",face_color,sides=18,steps=11)
    muzzle=HEAD+V((0,r*.69,-r*.31))
    if STYLE=="giraffe":
        muzzle+=V((0,.139,0))
    s.ellipsoid(muzzle,(r*.72,r*(1.13 if STYLE=="giraffe" else .57),r*.53),
                "head",lambda p,n:band(n,"nose","shadow","face"),sides=14,steps=8)
    if STYLE=="nose":
        s.ellipsoid(muzzle+V((0,.085,.067)),(.096,.133,.191),"head",
                    lambda p,n:band(n,"accent","nose","face"),sides=12,steps=8)
    if STYLE=="mandrill":
        for sign in (-1,1):
            s.ellipsoid(muzzle+V((sign*.095,.025,.031)),(.071,.053,.123),"head",
                        lambda p,n:"blue",sides=10,steps=6)
    for side,sign in SIDES:
        eye=HEAD+V((sign*r*.55,r*.73,r*.177))
        s.ellipsoid(eye,(.051,.047,.048),"head",
                    lambda p,n:"face" if n.z>.84 and n.y>.11 else "eye",sides=10,steps=6)
        ear=HEAD+V((sign*r*.87,-.011,r*.37))
        if is_roo():
            s.tube([(ear,.084,.067,{"head":1}),
                    (ear+V((sign*.107,-.033,.188)),.073,.050,{"head":1}),
                    (ear+V((sign*.154,-.054,.348)),.016,.019,{"head":1})],
                   lambda p,n:"nose" if n.y>.45 else coat(p,n),sides=9)
        elif STYLE=="elephant":
            s.ellipsoid(ear+V((sign*.112,-.021,-.092)),(.207,.070,.242),"head",
                        lambda p,n:"nose" if n.y>.49 else coat(p,n),sides=12,steps=8)
            start=muzzle+V((sign*.141,.081,-.042))
            s.tube([(start,.043,.043,{"head":1}),
                    (start+V((sign*.052,.136,-.041)),.011,.012,{"head":1})],
                   lambda p,n:"accent",sides=8)
        else:
            s.ellipsoid(ear,(.084,.041,.083),"head",
                        lambda p,n:"nose" if n.y>.58 else coat(p,n),sides=9,steps=6)
        if STYLE=="giraffe":
            p=HEAD+V((sign*.096,-.048,.162))
            s.tube([(p,.037,.036,{"head":1}),
                    (p+V((sign*.028,-.022,.139)),.045,.038,{"head":1})],
                   lambda p,n:"shadow",sides=8)
    if STYLE=="elephant":
        a=HEAD+V((0,.24,-.05))
        s.tube([(a,.111,.104,{"head":.56,"trunk":.44}),
                (a+V((0,.055,-.18)),.088,.091,{"trunk":1}),
                (a+V((0,.095,-.41)),.057,.062,{"trunk":1}),
                (a+V((0,.211,-.47)),.043,.048,{"trunk":1})],
               lambda p,n:coat(p,n),sides=10)
    for name,(a,b,c) in LIMBS.items():
        fore=name.startswith("arm")
        up,down,tip=f"{name}.u",f"{name}.d",f"{name}.tip"
        s.start(name)
        broad=w*(.43 if STYLE=="gorilla" and fore else .35 if fore or is_roo() else .29)
        if is_roo() and fore:
            broad*=.63
        s.tube([(a+V((0,0,.082)),broad*.67,broad*.68,{"body":.38,up:.62}),
                (a,broad,broad,{up:1}),(a.lerp(b,.59),broad*.77,broad*.82,{up:1}),
                (b,broad*.63,broad*.67,{up:.46,down:.54}),
                (b.lerp(c,.65),broad*.51,broad*.54,{down:1}),
                (c,broad*.48,broad*.49,{down:.47,tip:.53})],
               lambda p,n:coat(p,n),sides=10)
        length=.18 if is_roo() and not fore else .118 if fore else .126
        end=c+V((0,.045,-.033 if not (fore and is_upright()) else 0))
        s.ellipsoid(end,(max(.044,broad*.64),length,.072 if fore else .070),tip,
                    lambda p,n:band(n,"nose","shadow","coat"),sides=11,steps=6)
    s.start("Coat-marked flexible tail")
    for i,(a,b) in enumerate(zip(TAIL,TAIL[1:])):
        r0=(.163 if is_roo() else .093)*(1-.65*i/2)
        r1=max(.017,r0*.66)
        bone=f"tail{i}"
        s.tube([(a,r0,r0,{bone:1}), (a.lerp(b,.62),r0*.84,r0*.84,{bone:1}),
                (b,r1,r1,{bone:1})],
               lambda p,n:"ink" if STYLE=="rings" and math.cos(p.y*28+p.z*11)>.05 else
               "face" if STYLE=="rings" else coat(p,n),sides=9)
    return s


def pose(rig,rest,clip,t):
    if ROLLOUT_MOTION:
        return rollout_pose(rig,rest,clip,t)
    wave=math.tau*t
    walk=clip=="walk"
    hop=math.sin(math.pi*t)**2 if clip=="hop" else 0
    gesture=math.sin(math.pi*t)**2 if clip in ("pickup","eat","action","climb","sit") else 0
    root=rest["body"].translation
    q=euler(.076*math.sin(wave)*walk+.31*hop-.17*gesture*(clip=="pickup"),
            .054*math.sin(wave)*walk,0)
    rise=.021*math.sin(wave)+.17*hop-.21*gesture*(clip=="sit")
    body=transform(q,root,root+V((.035*math.sin(wave)*walk,0,rise)))
    out={"body":body@rest["body"]}
    hq=q@euler(-.30*gesture*(clip in ("pickup","eat"))-.31*hop,0,.12*math.sin(wave)*(clip=="idle"))
    h=transform(hq,HEAD,body@HEAD+V((0,.067*gesture,-.11*gesture*(clip=="pickup"))))
    out["head"]=h@rest["head"]
    for name,(a,b,c) in LIMBS.items():
        fore=name.startswith("arm")
        phase=(.22 if fore else 0)+(.5 if name.endswith(".r") else 0)
        adv,lift=stride(t,phase,.205,.117) if walk else (0,0)
        if fore and is_upright() and walk:
            adv=.25*math.sin(wave+math.tau*phase)
            lift=.05*math.cos(wave+math.tau*phase)
        if hop:
            adv+=.23*hop if fore else -.34*hop
            lift+=.16*hop
        if gesture and fore:
            adv+=.24*gesture
            lift+=(.28 if clip in ("eat","action","climb") else .10)*gesture
        up,dn,tip=f"{name}.u",f"{name}.d",f"{name}.tip"
        mid=body@b+V((0,.51*adv,.61*lift))
        end=c+V((0,adv,lift))
        out[up]=aimed(rest[up],body@a,mid)
        out[dn]=aimed(rest[dn],mid,end)
        out[tip]=transform(euler(-.61*lift),V((0,0,0)),end)
    p=body@TAIL[0]
    for i,(a,b) in enumerate(zip(TAIL,TAIL[1:])):
        d=b-a
        d=q@(euler(.08*math.sin(wave-i*.51)-.10*hop,0,.16*math.sin(wave-i*.78))@d)
        out[f"tail{i}"]=aimed(rest[f"tail{i}"],p,p+d)
        p+=d
    if "trunk" in rest:
        a=rest["trunk"].translation
        out["trunk"]=transform(hq@euler(.27*gesture,.13*math.sin(wave)),a,h@a)@rest["trunk"]
    return out


def rollout_pose(rig, rest, clip, t):
    reach, lean, bound = ROLLOUT_MOTION
    wave = math.tau*t
    swing = math.sin(wave)
    gesture = math.sin(math.pi*t)**2 if clip=="action" else 0
    moving = clip in ("walk","flee")
    fleeing = clip=="flee"
    upright = is_upright()
    hopping = is_roo() and clip in ("hop","flee")
    flight = math.sin(math.pi*t)**2 if hopping else 0
    push = math.sin(wave)
    root = rest["body"].translation
    pitch = lean*gesture + (.10 if fleeing else .034)*swing*moving + .14*fleeing
    if hopping:
        pitch = -(bound if fleeing else bound*.64)*flight+.06*push
    q = euler(pitch, (.09 if fleeing else .044)*swing*moving, 0)
    rise = .018*swing + ((.046+bound*.16) if fleeing else .030)*math.cos(2*wave)*moving
    if hopping:
        # The Realm owns altitude. Draw the take-off compression and folded legs in place.
        rise = -.072*max(0,-push)
    body = transform(q, root, root+V((.027*swing*moving, 0, rise-.05*gesture)))
    out = {"body":body@rest["body"]}
    hq = q@euler(-(.19 if upright else .26)*gesture, 0, .10*swing*(clip=="idle"))
    h = transform(hq, HEAD, body@HEAD+V((0,.07*gesture,-lean*.20*gesture)))
    out["head"] = h@rest["head"]
    for name,(a,b,c) in LIMBS.items():
        arm = name.startswith("arm")
        right = name.endswith(".r")
        phase = .50*right + ((.10 if fleeing else .25) if arm else 0)
        advance, lift = (0,0)
        if moving:
            advance,lift = stride(t,phase, .29+bound*.48 if fleeing else .22,
                                  .10+bound*.27 if fleeing else .081)
        if upright and arm:
            advance = (.36 if fleeing else .20)*math.sin(wave+math.tau*phase)*moving
            lift = .065*math.cos(wave+math.tau*phase)*moving + (.19 if fleeing else 0)
        if hopping:
            advance = (.26 if arm else -.36 if fleeing else -.24)*flight
            lift = (.18 if arm else .30 if fleeing else .22)*flight
        lead_hand = arm and (not right or STYLE in ("gorilla","elephant"))
        if lead_hand:
            advance += reach*gesture
            lift += (.17 if upright else .106)*gesture
        hand_or_foot=(body@c if upright and arm else c)+V((0,advance,lift))
        up,dn,tip=f"{name}.u",f"{name}.d",f"{name}.tip"
        side = -1 if right else 1
        elbow_or_knee = V((side*.48, .16 if arm else 1, -.20 if arm else 0))
        mid,end = solve_knee(body@a,hand_or_foot,rig.data.bones[up].length,
                             rig.data.bones[dn].length,elbow_or_knee)
        out[up] = aimed(rest[up],body@a,mid)
        out[dn] = aimed(rest[dn],mid,end)
        out[tip] = transform(euler(-.51*lift),c,end)@rest[tip]
    p = body@TAIL[0]
    for i,(a,b) in enumerate(zip(TAIL,TAIL[1:])):
        d = q@(euler(.18*fleeing+.07*math.sin(wave-i*.50)-.22*flight,
                     0,(.06 if hopping else .20)*math.sin(wave-i*.75))@(b-a))
        out[f"tail{i}"] = aimed(rest[f"tail{i}"],p,p+d)
        p += d
    if "trunk" in rest:
        a = rest["trunk"].translation
        out["trunk"] = transform(hq@euler(-.35*gesture+.12*fleeing,.13*swing),a,h@a)@rest["trunk"]
    return out
