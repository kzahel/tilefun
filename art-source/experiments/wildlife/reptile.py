"""Low-bodied reptiles and amphibians with articulated tails and distinct dorsal features."""
import math
from wildlife_build import CatSurface, V, aimed, euler, mix, solve_knee, stride, transform

# Trunk width, half-length, height, head length, tail reach, feature and palette.
PROFILES={
    "alligator":("American Alligator",(.40,.79,.24),.56,1.30,"gator","26382c 43513b 687356 8a9069 c2b68b 515b48 314032 242c23"),
    "crocodile":("Nile Crocodile",(.35,.84,.22),.66,1.35,"croc","333a2b 535b40 7e8058 9c966b cbb886 726c4d 46543b 282f24"),
    "komodo-dragon":("Komodo Dragon",(.35,.72,.26),.38,1.11,"monitor","3b3b2f 59574a 807664 a2967b d3c29b 736652 625644 332f27"),
    "axolotl":("Axolotl",(.31,.54,.24),.33,.80,"gills","733e4f 9c5d6a bd8586 d5a4a0 ebc4ae ac596e c16d80 482c3d"),
    "chameleon":("Chameleon",(.37,.59,.34),.32,.77,"curl","384333 576742 819363 a7ad78 d3ce94 727b4c b3ae73 303b2a"),
    "frilled-neck-lizard":("Frilled-neck Lizard",(.28,.62,.23),.35,1.03,"frill","454035 79614a 987a56 b49972 d7be8b b17c54 c59768 322b24"),
    "gecko":("Gecko",(.28,.59,.23),.31,.81,"pads","494536 75674c a28d62 bea67b d8c496 9c865a a0826a 3b3629"),
    "iguana":("Iguana",(.31,.68,.28),.36,1.21,"spines","3b4930 556542 7e9157 a7ab70 d0cc90 647349 526644 303a27"),
    "land-tortoise":("Land Tortoise",(.47,.64,.34),.27,.26,"land-shell","3f3d30 62533c 917650 b3996d c6ad80 7e6547 645840 342f26"),
    "pond-turtle":("Pond Turtle",(.42,.61,.29),.26,.29,"pond-shell","344236 4f6045 788662 9da776 c5c28a 687d50 596f49 28382c"),
    "sea-turtle":("Sea Turtle",(.48,.70,.30),.28,.32,"sea-shell","32493d 506a55 78896c a3ad85 ced1a3 647d5c 5a795e 273b2f"),
    "newt":("Newt",(.22,.53,.21),.27,.87,"newt","394036 5d5d42 7c7757 a39365 d1a667 a8784a 726b4b 2e342b"),
    "salamander":("Salamander",(.25,.57,.23),.26,.92,"spots","2c332a 4d533c 77764d a3955e d4b867 c4a557 6b6945 292f28"),
    "texas-horned-lizard":("Texas Horned Lizard",(.43,.59,.23),.30,.55,"horns","4e402f 80684b a78b62 c5ab7f ddc398 97724f 8f7455 463729"),
}
LIGHT=V((-.48,.26,.84)).normalized()
SIDES=(("l",1),("r",-1))
NAME=STYLE=PALETTE=DURATIONS=None
WIDTH=LENGTH=HEIGHT=BILL=TAIL_LEN=None
BODY=HEAD=JAW=TAIL=LEGS=None
SEA_ROLLOUT=False
POND_ROLLOUT=False


def configure(key):
    global NAME,STYLE,PALETTE,DURATIONS,WIDTH,LENGTH,HEIGHT,BILL,TAIL_LEN,BODY,HEAD,JAW,TAIL,LEGS
    NAME,(WIDTH,LENGTH,HEIGHT),BILL,TAIL_LEN,STYLE,colors=PROFILES[key]
    PALETTE=dict(zip(("ink","shade","coat","light","belly","mark","feature","eye"),colors.split()))
    DURATIONS={"idle":48,"walk":29,"swim":28,"action":24,"feed":27,"display":26}
    BODY=V((0,0,HEIGHT+.20))
    HEAD=BODY+V((0,LENGTH*.77,.048))
    JAW=HEAD+V((0,BILL*.14,-.059))
    p=BODY+V((0,-LENGTH*.76,-HEIGHT*.115))
    if STYLE=="curl":
        TAIL=[p+V(q) for q in ((0,0,0),(0,-.31,.035),(0,-.57,.198),(0,-.61,.46),(0,-.38,.58),(0,-.263,.427))]
    else:
        TAIL=[p+V((0,-TAIL_LEN*k,-.10*k+.035*math.sin(math.pi*k))) for k in (0,.26,.54,.80,1)]
    LEGS={}
    for side,sign in SIDES:
        for front in (True,False):
            a=BODY+V((sign*WIDTH*.73,LENGTH*(.62 if front else -.62),-.048))
            b=a+V((sign*.187,.041 if front else -.103,-.026))
            c=V((sign*(WIDTH*.83+(.30 if STYLE=="sea-shell" else .21)),
                 a.y+(.148 if front else -.21),.071))
            LEGS[("front" if front else "back")+"."+side]=(a,b,c)


def configure_rollout():
    global SEA_ROLLOUT, POND_ROLLOUT, PALETTE, DURATIONS, WIDTH, LENGTH, HEIGHT
    global BODY, HEAD, JAW, LEGS, TAIL
    if STYLE in ("gills","pond-shell"):
        POND_ROLLOUT = True
        colors = (
            "9c526d 9c526d d9a9ab ebc2bd f1d4c2 9c526d d891a9 1d251e" if STYLE=="gills"
            else "344e3d 344e3d 4d7954 6d9365 d6c69a 4d7954 bdcb80 1d251e"
        )
        PALETTE = dict(zip(("ink","shade","coat","light","belly","mark","feature","eye"),colors.split()))
        DURATIONS = {"idle":48,"walk":33,"action":25,"flee":19}
        gills = STYLE=="gills"
        BODY = V((0,0,.315 if gills else .413))
        HEAD = BODY+V((0,LENGTH*.77,.021))
        JAW = HEAD+V((0,BILL*.17,-.05))
        start = BODY+V((0,-LENGTH*.75,-.05))
        TAIL = ([start+V(coords) for coords in
                ((0,0,0),(0,-.22,.035),(0,-.51,.072),(0,-.76,.109),(0,-.91,.139))]
                if gills else [start+V((0,-.30*t,-.069*t)) for t in (0,.25,.5,.75,1)])
        LEGS = {}
        for side,sign in SIDES:
            for limb,y in (("front",.36),("back",-.34)):
                a = V((sign*WIDTH*.68,y,BODY.z-.073))
                b = a+V((sign*.118,-.081 if limb=="front" else .093,-.082))
                c = V((sign*(WIDTH*.95+.103),y+(.10 if limb=="front" else -.12),.054))
                LEGS[f"{limb}.{side}"] = (a,b,c)
        return
    assert STYLE == "sea-shell"
    SEA_ROLLOUT = True
    colors = "415747 415747 65805a a5ad71 d4c48f c0b57a 65805a 202e35"
    PALETTE = dict(zip(("ink","shade","coat","light","belly","mark","feature","eye"),colors.split()))
    DURATIONS = {"idle":48,"swim":34,"action":23,"flee":18}
    WIDTH,LENGTH,HEIGHT = .56,.71,.24
    BODY = V((0,0,.45))
    HEAD = V((0,.636,.415))
    JAW = HEAD+V((0,.068,-.081))
    LEGS = {}
    for side, sign in SIDES:
        front = ((sign*.368,.388,.376),(sign*.658,.289,.331),(sign*1.126,-.03,.246))
        back = ((sign*.345,-.398,.321),(sign*.512,-.564,.289),(sign*.712,-.796,.230))
        for label, axis in (("front",front),("back",back)):
            LEGS[f"{label}.{side}"] = tuple(V(p) for p in axis)


def axolotl_gill(sign, index):
    start = HEAD+V((sign*(WIDTH*.71),-.098+index*.062,.055))
    end = start+V((sign*(.245+index*.036),-.21+index*.023,.195-index*.047))
    return start,end


def joints():
    entries=[
        ("body",BODY,BODY+V((0,.49,0)),None),
        ("head",HEAD,HEAD+V((0,BILL,0)),"body"),
        ("jaw",JAW,JAW+V((0,BILL*.59,-.071)),"head"),
    ]
    for name,(a,b,c) in LEGS.items():
        u,d,p=f"{name}.upper",f"{name}.lower",f"{name}.foot"
        entries.extend(((u,a,b,"body"),(d,b,c,u),(p,c,c+V((0,.22,0)),d)))
    for i,(a,b) in enumerate(zip(TAIL,TAIL[1:])):
        entries.append((f"tail{i}",a,b,f"tail{i-1}" if i else "body"))
    if STYLE=="frill":
        for side,sign in SIDES:
            p=HEAD+V((sign*.075,-.119,.041))
            entries.append((f"frill.{side}",p,p+V((sign*.35,-.06,.19)),"head"))
    if POND_ROLLOUT and STYLE=="gills":
        for side,sign in SIDES:
            for index in range(3):
                root,tip = axolotl_gill(sign,index)
                entries.append((f"gill.{side}.{index}",root,tip,"head"))
    return entries


def shade(n,color="coat"):
    light=n.dot(LIGHT)
    if color=="belly":
        return "belly" if light>-.43 else "light"
    if color=="mark":
        return "mark" if light>-.61 else "shade"
    return "shade" if light<-.35 else "light" if light>.66 else color


def body_paint(p,n):
    delta=p-BODY
    if delta.z<-.09:
        return shade(n,"belly")
    if STYLE in ("spots","pads","gator","croc","newt","axolotl"):
        cell_y=(p.y*6.2+p.x*2)%1-.5
        cell_x=(abs(p.x)*7.2+p.z*2.17+math.floor(p.y*5.9)*.35)%1-.5
        if cell_y*cell_y+cell_x*cell_x<.108:
            return "mark" if STYLE in ("spots","newt") else "shade"
    if STYLE in ("spines","curl","horns") and n.z > .20 and math.cos(p.y*17+abs(p.x)*7)> .47:
        return "shade"
    return shade(n)


def surface():
    s=CatSurface()
    s.start("Low trunk with dorsal and underside paint")
    s.ellipsoid(BODY,(WIDTH,LENGTH,HEIGHT),"body",body_paint,sides=20,steps=13)
    if STYLE.endswith("shell"):
        s.start("Domed shell and scutes")
        center=BODY+V((0,-.07,HEIGHT*.51))
        def shell_paint(p,n):
            q=p-center
            if POND_ROLLOUT:
                if n.z < -.24 or abs(q.x)/WIDTH+.39*(q.y/LENGTH)**2>.94:
                    return "shade"
                crossing = abs((q.y*4.1+abs(q.x)*.67)%1-.5)
                return "shade" if crossing>.43 else "coat" if n.dot(LIGHT)>.17 else "light"
            if SEA_ROLLOUT:
                along = q.y/LENGTH
                across = abs(q.x)/WIDTH
                if n.z < -.21 or across+.48*along*along>.95:
                    return "coat" if n.z > -.41 else "shade"
                line = abs((along*1.68+.27*min(across,.87))%1-.5)
                if line>.459 or abs(across-(.40+.08*math.sin(8*along)))<.026:
                    return "coat"
                return "mark" if n.dot(LIGHT)>.44 else "light"
            u=(q.y*4.3+math.floor(abs(q.x)*5)*.44)%1-.5
            v=(abs(q.x)*5.6+math.floor(q.y*5)*.26)%1-.5
            if abs(u)+abs(v)>.68:
                return "shade"
            return "feature" if n.dot(LIGHT)>.65 else "mark"
        s.ellipsoid(center,(WIDTH*1.14,LENGTH*.92,HEIGHT*1.06),"body",shell_paint,sides=22,steps=14)
        s.ellipsoid(center+V((0,0,-HEIGHT*.36)),(WIDTH*1.15,LENGTH*.93,.052),"body",
                    lambda p,n:"shade" if n.dot(LIGHT)<.26 else "light",sides=18,steps=9)
    if STYLE in ("gator","croc","spines","horns"):
        s.start("Dorsal scutes")
        for i in range(9):
            y=mix(-LENGTH*.78,LENGTH*.65,i/8)
            for sign in (-1,1):
                p=BODY+V((sign*WIDTH*.21,y,HEIGHT*.69))
                r=.094 if STYLE=="spines" else .065
                s.tube([(p,.063,.066,{"body":1}),
                        (p+V((0,-.043,r*1.45)),.020,.026,{"body":1})],
                       lambda p,n:"feature" if n.dot(LIGHT)>.38 else "shade",sides=7)
    s.start("Species muzzle and hinged jaw")
    broad=.207 if SEA_ROLLOUT else WIDTH*(.96 if POND_ROLLOUT and STYLE=="gills" else
                .90 if STYLE in ("gator","gills","horns") else .61)
    rise=.161 if SEA_ROLLOUT else HEIGHT*(1.04 if STYLE=="curl" else .77)
    if SEA_ROLLOUT:
        s.ellipsoid(HEAD+V((0,-.133,-.017)),(.148,.210,.124),"head",body_paint,sides=17,steps=10)
    s.ellipsoid(HEAD,(broad,BILL*.73,rise),"head",body_paint,sides=18,steps=9)
    tip=HEAD+V((0,BILL*.57,-.045))
    s.ellipsoid(tip,(broad*(.80 if STYLE=="gator" else .61),BILL*.71,rise*.55),"head",
                lambda p,n:shade(n),sides=14,steps=8)
    s.ellipsoid(tip+V((0,.017,-rise*.43)),(broad*.57,BILL*.62,rise*.33),"jaw",
                lambda p,n:shade(n,"belly"),sides=14,steps=7)
    for side,sign in SIDES:
        p=HEAD+V((sign*broad*.65,BILL*.15,rise*.69))
        if STYLE in ("gator","croc","curl","pads"):
            s.ellipsoid(p,(.085,.097,.083),"head",lambda p,n:shade(n,"mark"),
                        sides=10,steps=7)
        eye_offset = V((sign*(.017 if POND_ROLLOUT else .042),.027,.021))
        s.ellipsoid(p+eye_offset,(.048,.059,.051),"head",
                    lambda p,n:"belly" if n.z>.84 else "eye",sides=10,steps=6)
        if STYLE=="gills":
            s.start("Branching gills "+side)
            for i in range(3):
                if POND_ROLLOUT:
                    start,end = axolotl_gill(sign,i)
                    gill = f"gill.{side}.{i}"
                else:
                    start=HEAD+V((sign*broad*.83,-.086+i*.053,.06))
                    end=start+V((sign*(.17+i*.037),-.26+i*.022,.21-i*.052))
                    gill = "head"
                s.tube([(start,.037,.042,{gill:1}),
                        (start.lerp(end,.54),.044,.055,{gill:1}),
                        (end,.018,.021,{gill:1})],
                       lambda p,n:"feature" if n.dot(LIGHT)>.43 else "mark",sides=8)
                if POND_ROLLOUT:
                    for progress in (.39,.63,.83):
                        root = start.lerp(end,progress)
                        tip = root+V((sign*.074,-.031,.073-.029*progress))
                        s.tube([(root,.019,.020,{gill:1}),(tip,.008,.008,{gill:1})],
                               lambda p,n:"mark",sides=7)
        if STYLE=="frill":
            s.start("Raised neck frill "+side)
            bone=f"frill.{side}"
            p=HEAD+V((sign*.181,-.116,.04))
            s.ellipsoid(p,(.229,.067,.209),bone,lambda p,n:"belly" if n.y>.42 else "mark",
                        sides=14,steps=9)
            s.ellipsoid(p+V((sign*.124,-.015,.075)),(.107,.059,.124),bone,
                        lambda p,n:"feature",sides=10,steps=6)
        if STYLE=="horns":
            s.start("Crown horns "+side)
            for i in range(3):
                root=HEAD+V((sign*broad*(.62+i*.098),-.094+i*.074,rise*.76))
                end=root+V((sign*.12,-.108,.119+i*.020))
                s.tube([(root,.037,.035,{"head":1}),(end,.009,.011,{"head":1})],
                       lambda p,n:"feature",sides=7)
    for name,(a,b,c) in LEGS.items():
        broad_limb = STYLE in ("gator","croc","horns","land-shell","sea-shell") or (
            POND_ROLLOUT and STYLE=="pond-shell"
        )
        limb = .089 if broad_limb else .062
        u,d,f=f"{name}.upper",f"{name}.lower",f"{name}.foot"
        s.start("Splayed limb "+name)
        if SEA_ROLLOUT:
            sea_flipper(s,name,a,b,c,u,d,f)
            continue
        s.tube([(a,limb*1.44,limb*1.15,{u:1}),
                (a.lerp(b,.62),limb,limb,{u:1}),
                (b,limb*.78,limb*.73,{u:.47,d:.53}),
                (b.lerp(c,.58),limb*.69,limb*.65,{d:1}),
                (c,limb*.55,limb*.51,{d:.39,f:.61})],
               lambda p,n:shade(n,"mark" if STYLE=="spots" and n.z>.44 else "coat"),sides=9)
        if STYLE=="sea-shell":
            s.ellipsoid(c+V((.08 if name.endswith(".l") else -.08,.024,-.024)),
                        (.234,.123,.047),f,lambda p,n:shade(n,"feature"),sides=12,steps=7)
        elif POND_ROLLOUT and STYLE=="pond-shell":
            s.ellipsoid(c+V((0,.046,-.019)),(.092,.110,.041),f,
                        lambda p,n:"feature" if p.y>c.y+.094 else shade(n),sides=13,steps=8)
        else:
            for i in range(-1,2):
                s.tube([(c+V((i*.019,.015,-.022)),.026,.024,{f:1}),
                        (c+V((i*.068,.093-abs(i)*.020,-.036)),.018,.018,{f:1}),
                        (c+V((i*.081,.163-abs(i)*.029,-.046)),.010,.011,{f:1})],
                       lambda p,n:"feature" if n.z>.42 else "shade",sides=6)
    s.start("Tapered articulated tail")
    rings=[]
    for i,(a,b) in enumerate(zip(TAIL,TAIL[1:])):
        bone=f"tail{i}"
        for ratio in (0,.52,.81):
            reach=(i+ratio)/(len(TAIL)-1)
            r=max(.018,WIDTH*.52*(1-reach)**.71)
            weights={bone:1} if ratio or not i else {f"tail{i-1}":.48,bone:.52}
            rings.append((a.lerp(b,ratio),r*.72 if STYLE=="gills" else r,
                          r*(1.52 if POND_ROLLOUT else 1.23) if STYLE=="gills" else r*.75,weights))
    rings.append((TAIL[-1],.015,.015,{f"tail{len(TAIL)-2}":1}))
    def tail_paint(p,n):
        if POND_ROLLOUT:
            return "mark" if STYLE=="gills" and n.z>.47 else body_paint(p,n)
        return "shade" if math.cos(abs(p.y)*23)>.46 else body_paint(p,n)
    s.tube(rings,tail_paint,sides=11)
    return s


def sea_flipper(s,name,a,b,c,upper,lower,tip):
    front = name.startswith("front")
    size = 1 if front else .65
    s.tube([(a,.105*size,.075,{upper:1}),
            (a.lerp(b,.56),.178*size,.059,{upper:1}),
            (b,.187*size,.054,{upper:.47,lower:.53}),
            (b.lerp(c,.56),.159*size,.042,{lower:.67,tip:.33}),
            (b.lerp(c,.83),.092*size,.026,{tip:1}),
            (c,.023,.018,{tip:1})],lambda p,n:shade(n,"feature"),sides=13)


def sea_pose(rest, clip, t):
    wave = math.tau*t
    swim = clip=="swim"
    fast = clip=="flee"
    nod = math.sin(wave)**2 if clip=="action" else 0
    pulse = math.sin(wave*(2 if fast else 1))
    effort = .5-.5*math.cos(wave*(2 if fast else 1))
    q = euler(.043*math.sin(wave)-.19*fast*pulse+.05*nod,
              .069*pulse if swim or fast else .022*pulse,.084*pulse*fast)
    body = transform(q,BODY,BODY+V((0,.07*effort*fast,.034*math.cos(wave)+.054*effort*(swim or fast))))
    out = {"body":body@rest["body"]}
    head_q = q@euler(.14*nod,0,.066*math.sin(wave))
    h = transform(head_q,HEAD,body@HEAD+V((0,.098*nod-.061*fast,0)))
    out["head"] = h@rest["head"]
    out["jaw"] = transform(head_q@euler(-.39*nod),JAW,h@JAW)@rest["jaw"]
    for name,(a,b,c) in LEGS.items():
        sign = 1 if name.endswith(".l") else -1
        front = name.startswith("front")
        phase = wave*(2 if fast else 1)+sign*.14-(.74 if front else 0)
        span = (.38 if front else .18) if fast else (.28 if front else .14) if swim else .039
        sweep = span*math.sin(phase)
        rise = span*math.cos(phase)
        knee = body@b+V((-sign*.10*effort*fast,.56*sweep,.53*rise))
        end = body@c+V((-sign*.21*effort*fast,sweep-.19*fast*effort,rise))
        u,d,f = f"{name}.upper",f"{name}.lower",f"{name}.foot"
        out[u] = aimed(rest[u],body@a,knee)
        out[d] = aimed(rest[d],knee,end)
        bend = (out[d]@rest[d].inverted()).to_quaternion()
        out[f] = transform(bend@euler(0,.29*rise,0),c,end)@rest[f]
    cursor = body@TAIL[0]
    for i,(a,b) in enumerate(zip(TAIL,TAIL[1:])):
        delta = q@(euler(0,0,(.16 if fast else .064)*math.sin(wave-i*.54))@(b-a))
        name = f"tail{i}"
        out[name] = aimed(rest[name],cursor,cursor+delta)
        cursor += delta
    return out


def pond_pose(rig,rest,clip,t):
    wave = math.tau*t
    walking = clip in ("walk","flee")
    escape = clip=="flee"
    gesture = math.sin(math.pi*t)**2 if clip=="action" else 0
    turtle = STYLE=="pond-shell"
    q = euler(.047*math.sin(wave)*walking-.049*gesture,
              .048*math.cos(wave)*walking,.090*math.sin(wave)*escape)
    bob = (.046 if escape else .019)*math.sin(wave)**2
    body = transform(q,BODY,BODY+V((0,.041*escape*math.cos(wave),bob)))
    out = {"body":body@rest["body"]}
    hq = q@euler((.25 if turtle else -.13)*gesture,0,.070*math.sin(wave))
    h = transform(hq,HEAD,body@HEAD+V((0,(-.22 if turtle else .079)*gesture,-.048*turtle*gesture)))
    out["head"] = h@rest["head"]
    out["jaw"] = transform(hq@euler(-.27*gesture*(not turtle)),JAW,h@JAW)@rest["jaw"]
    for name,(a,b,c) in LEGS.items():
        left = name.endswith(".l")
        fore = name.startswith("front")
        phase = .5*(left != fore)
        advance,lift = stride(t,phase,.275 if escape else .173,.111 if escape else .059) if walking else (0,0)
        target = c+V((0,advance,lift))
        up,dn,foot = f"{name}.upper",f"{name}.lower",f"{name}.foot"
        hip = body@a
        knee,ankle = solve_knee(hip,target,rig.data.bones[up].length,rig.data.bones[dn].length,
                                 V(((1 if left else -1),-.42 if fore else .42,0)))
        out[up] = aimed(rest[up],hip,knee)
        out[dn] = aimed(rest[dn],knee,ankle)
        out[foot] = transform(euler(-.42*lift),c,ankle)@rest[foot]
    cursor = body@TAIL[0]
    for i,(a,b) in enumerate(zip(TAIL,TAIL[1:])):
        beat = math.sin(wave*(2 if escape else 1)-i*.69)
        yaw = (.39 if escape else .17 if walking else .066)*beat
        delta = q@(euler(.07*beat-.17*gesture,0,yaw)@(b-a))
        name = f"tail{i}"
        out[name] = aimed(rest[name],cursor,cursor+delta)
        cursor += delta
    if not turtle:
        for side,sign in SIDES:
            for index in range(3):
                name = f"gill.{side}.{index}"
                root,_ = axolotl_gill(sign,index)
                fan = .30*gesture+.062*math.sin(wave*2-index*.75)
                out[name] = transform(hq@euler(-.19*gesture,sign*fan,sign*fan),root,h@root)@rest[name]
    return out


def pose(rig,rest,clip,t):
    if SEA_ROLLOUT:
        return sea_pose(rest,clip,t)
    if POND_ROLLOUT:
        return pond_pose(rig,rest,clip,t)
    wave=math.tau*t
    walk,swim=clip=="walk",clip=="swim"
    pulse=math.sin(math.pi*t)**2 if clip in ("action","display","feed") else 0
    twist=.072*math.sin(wave) if walk else .095*math.sin(wave) if swim else .017*math.sin(wave)
    q=euler((.053 if clip!="feed" else -.20)*pulse,.052*math.sin(wave)*walk,twist)
    body=transform(q,BODY,BODY+V((.028*math.sin(wave)*walk,.033*pulse,.026*math.cos(wave))))
    out={"body":body@rest["body"]}
    hq=q@euler(-.17*pulse*(clip=="feed"),0,.097*math.sin(wave)*(clip=="idle"))
    h=transform(hq,HEAD,body@HEAD)
    out["head"]=h@rest["head"]
    out["jaw"]=transform(hq@euler(-.43*pulse),JAW,h@JAW)@rest["jaw"]
    for name,(a,b,c) in LEGS.items():
        sign=1 if name.endswith(".l") else -1
        fore=name.startswith("front")
        phase=(.26 if fore else 0)+(.5 if sign<0 else 0)
        advance,lift=stride(t,phase,.203,.079) if walk else (0,0)
        if swim:
            advance=(.21 if fore else .14)*math.sin(wave+phase*math.tau)
            lift=.14+.101*math.cos(wave+phase*math.tau)
        hip=body@a
        knee=body@b+V((sign*.069*math.sin(wave)*swim,.54*advance,.49*lift))
        target=c+V((sign*.097*math.cos(wave)*swim,advance,lift))
        u,d,f=f"{name}.upper",f"{name}.lower",f"{name}.foot"
        out[u]=aimed(rest[u],hip,knee)
        out[d]=aimed(rest[d],knee,target)
        out[f]=transform(euler(lift*.42,sign*lift*.47,-sign*.17),V((0,0,0)),target)
    p=body@TAIL[0]
    for i,(a,b) in enumerate(zip(TAIL,TAIL[1:])):
        sway=(.19 if walk else .36 if swim else .095)*math.sin(wave-i*.61)
        end=p+q@(euler(.054*math.sin(wave-i*.82),0,sway)@(b-a))
        name=f"tail{i}"
        out[name]=aimed(rest[name],p,end)
        p=end
    if STYLE=="frill":
        for side,sign in SIDES:
            name=f"frill.{side}"
            a=rest[name].translation
            spread=(1-pulse)*1.02
            out[name]=transform(hq@euler(0,0,sign*spread),a,h@a)@rest[name]
    return out
