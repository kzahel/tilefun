"""Fresh crabs, lobsters, shrimp, spiders and scorpions with articulate limbs."""
import math

from wildlife_build import CatSurface, V, aimed, euler, mix, stride, transform

# Profile is name, shell widths (x, y, z), pairs of legs, limb reach,
# distinguishing anatomy and active reference tones.
PROFILES={
    "crab":("Rust Crab",(.48,.37,.23),4,.49,"crab","4c3329 8a4930 bb6f41 d6945a dda878 633b30"),
    "coconut-crab":("Coconut Crab",(.56,.54,.29),4,.55,"coconut","3e3c38 646052 9c7960 bd966e cfa781 493d36"),
    "horseshoe-crab":("Horseshoe Crab",(.49,.57,.27),5,.38,"horseshoe","4b4434 6f6250 9a8969 b6a382 c5b494 3d3a2f"),
    "lobster":("Lobster",(.30,.57,.24),4,.40,"lobster","413333 793d34 b5674c d98c5d dfab81 523930"),
    "mantis-shrimp":("Peacock Mantis Shrimp",(.29,.58,.225),4,.39,"mantis","403d34 6b6b44 a19f5c cca975 d6b788 7d6758"),
    "shrimp":("Shrimp",(.245,.50,.22),4,.34,"shrimp","5b3d39 956352 bd8870 d6a589 e2bea3 584238"),
    "scorpion":("Scorpion",(.355,.43,.22),4,.49,"scorpion","403329 6c5039 9a7452 c1966b d8b07d 503b31"),
    "spider":("Wolf Spider",(.33,.405,.26),4,.53,"spider","302a29 4d4036 766353 9e8871 b9a087 362f29"),
    "giant-spider":("Giant Spider",(.42,.55,.32),4,.67,"giant","282730 493d47 675763 8a7483 b096a1 312a33"),
}
LIGHT=V((-.40,.28,.87)).normalized()
NAME=STYLE=PALETTE=DURATIONS=None
W=L=H=LEGS=REACH=None
BODY=TAIL=None
ROLLOUT=False
SIDES=(("l",1),("r",-1))


def configure(variant):
    global NAME,STYLE,PALETTE,DURATIONS,W,L,H,LEGS,REACH,BODY,TAIL
    NAME,(W,L,H),LEGS,REACH,STYLE,colors=PROFILES[variant]
    PALETTE=dict(zip(("ink","shadow","coat","light","accent","eye"),colors.split()))
    DURATIONS={"idle":48,"walk":28,"swim":26,"action":24,"feed":24,"display":28,"sleep":41}
    BODY=V((0,.02,H+.18))
    a=BODY+V((0,-L*.74,-.036))
    if STYLE=="scorpion":
        TAIL=[a+V(p) for p in ((0,0,0),(0,-.22,.09),(0,-.36,.25),(0,-.30,.49),(0,-.11,.61),(0,.098,.53))]
    elif STYLE=="horseshoe":
        TAIL=[a,a+V((0,-.36,-.031)),a+V((0,-.73,.032))]
    elif STYLE in ("lobster","mantis","shrimp"):
        TAIL=[a+V(p) for p in ((0,0,0),(0,-.18,-.054),(0,-.43,-.08),(0,-.651,-.022))]
    else:
        TAIL=[]


def configure_rollout():
    global ROLLOUT, PALETTE, DURATIONS, W, L, H, REACH, BODY, TAIL
    profiles = {
        "horseshoe": ((.59,.60,.224),.22,"614b38 614b38 897853 ab7a50 ab7a50 141d18"),
        "lobster": ((.36,.61,.251),.34,"614b38 614b38 b96546 ab7a50 dec5a0 141d18"),
        "mantis": ((.30,.62,.215),.32,"365343 487e9f 638b62 da8151 dfad6e 264a5c"),
        "shrimp": ((.30,.52,.296),.30,"614b38 ab7a50 cb9c80 dec5a0 dec5a0 141d18"),
        "crab": ((.486,.395,.247),.44,"642c21 642c21 b74c28 e68e40 f5c46f 202c2b"),
        "coconut": ((.569,.589,.348),.493,"614b38 614b38 8d6a4d ab7a50 dec5a0 141d18"),
    }
    (W,L,H), REACH, colors = profiles[STYLE]
    ROLLOUT = True
    PALETTE = dict(zip(("ink","shadow","coat","light","accent","eye"),colors.split()))
    DURATIONS = {"idle":48}
    DURATIONS.update({"walk":31} if shore_crab() else {"swim":29})
    if STYLE in ("lobster","mantis","coconut"):
        DURATIONS.update({"feed":24,"display":25,"chase":18})
    else:
        DURATIONS.update({"action":22,"flee":18})
    BODY = V((0,.02,H+(.24 if STYLE=="coconut" else .15)))
    root = BODY + V((0,-L*.72,-.043))
    offsets = {
        "horseshoe": ((0,0,0),(0,-.49,-.021),(0,-.87,.037)),
        "lobster": ((0,0,0),(0,-.21,-.015),(0,-.42,-.030),(0,-.66,.003),(0,-.81,.033)),
        "mantis": ((0,0,0),(0,-.19,-.019),(0,-.39,-.040),(0,-.59,-.013),(0,-.75,.036)),
        "shrimp": ((0,0,0),(0,-.17,-.088),(0,-.29,-.169),(0,-.36,-.216),(0,-.48,-.217)),
    }
    TAIL = [root + V(offset) for offset in offsets.get(STYLE, ())]


def claws():
    return STYLE in ("crab","coconut","scorpion","lobster","mantis")


def shore_crab():
    return STYLE in ("crab","coconut")


def leg(side,i):
    sign=1 if side=="l" else -1
    front=(i/(LEGS-1)-.5)*2
    y=-front*L*.65
    a=BODY+V((sign*W*.71,y,-.082))
    b=a+V((sign*REACH*.58,.12 if i<2 else -.116,.022))
    c=V((sign*(W*.70+REACH*(1 if 0<i<LEGS-1 else .89)),
         b.y+(.146 if i==0 else -.177 if i==LEGS-1 else 0),.073))
    return a,b,c


def claw(side):
    s=1 if side=="l" else -1
    a=BODY+V((s*W*.65,L*.49,.05))
    b=BODY+V((s*(W+.12),L*.87,.061))
    c=BODY+V((s*(W+.071),L*1.36,.092))
    return a,b,c


def eye_center(sign):
    if ROLLOUT and STYLE == "horseshoe":
        return BODY+V((sign*.335,.257,.189))
    return BODY+V((sign*W*(.46 if STYLE in ("spider","giant") else .65),L*.75,H*.49+.075))


def feeler(side, sign):
    root = eye_center(sign)+V((sign*.036,.071,-.058))
    tip = root+V((sign*(.22 if STYLE=="mantis" else .275),
                  .65 if STYLE=="shrimp" else .56,.063))
    return f"antenna.{side}", root, tip


def joints():
    arr=[("body",BODY,BODY+V((0,.42,0)),None)]
    for side,sign in SIDES:
        if ROLLOUT and STYLE in ("lobster","mantis","shrimp"):
            key, root, tip = feeler(side,sign)
            arr.append((key,root,tip,"body"))
        for i in range(LEGS):
            a,b,c=leg(side,i)
            fore,back=f"leg.{side}.{i}.u",f"leg.{side}.{i}.d"
            arr.extend(((fore,a,b,"body"),(back,b,c,fore)))
        if claws():
            a,b,c=claw(side)
            upper,pincer,lower=f"claw.{side}.u",f"claw.{side}.p",f"claw.{side}.d"
            arr.extend(((upper,a,b,"body"),(pincer,b,c,upper),(lower,c,c+V((sign*.136,.21,-.019)),pincer)))
    for i,(a,b) in enumerate(zip(TAIL,TAIL[1:])):
        arr.append((f"tail{i}",a,b,f"tail{i-1}" if i else "body"))
    return arr


def shade(n,base="coat"):
    light=n.dot(LIGHT)
    return "shadow" if light<-.37 else "light" if light>.62 else base


def shell(p,n):
    delta=p-BODY
    if ROLLOUT and STYLE=="horseshoe":
        if n.z<.24 or (abs(delta.x)<.065 and abs(delta.y)>.34):
            return "shadow"
        return "light" if n.dot(LIGHT)>.89 and delta.y<-.24 else "coat"
    if ROLLOUT and STYLE=="mantis":
        if n.z>.1 and math.cos(p.y*24)>.64:
            return "light"
        return "shadow" if n.z<-.35 else "coat"
    if ROLLOUT and STYLE=="shrimp":
        if n.z < -.36 or math.cos(p.y*23+abs(p.x)*3)>.44:
            return "shadow"
        return "light" if n.dot(LIGHT)>.91 else "coat"
    if ROLLOUT and shore_crab():
        if n.z<-.32:
            return "shadow"
        if STYLE=="coconut" and p.y<-.36 and abs(p.x)<W*.45:
            return "accent" if n.z>.12 else "light"
        return shade(n)
    if STYLE in ("spider","giant") and math.cos(p.y*13+abs(p.x)*8)>.52 and abs(delta.x)<W*.50:
        return "accent" if n.z>.27 else "shadow"
    if STYLE in ("mantis","shrimp","lobster","horseshoe") and math.cos(p.y*23)>.53 and n.z>.13:
        return "accent" if STYLE in ("mantis","shrimp") else "shadow"
    return shade(n)


def surface():
    s=CatSurface()
    s.start("Species carapace")
    s.ellipsoid(BODY,(W,L,H),"body",shell,sides=20,steps=13)
    if STYLE in ("spider","giant","scorpion"):
        q=BODY+V((0,L*.74,-H*.19))
        s.ellipsoid(q,(W*.70,L*.58,H*.71),"body",shell,sides=14,steps=9)
    if STYLE=="horseshoe":
        rim = (W*1.17,L*.96,.065) if ROLLOUT else (W*1.15,L*.86,.057)
        s.ellipsoid(BODY+V((0,.080,-.087)),rim,"body",shell if ROLLOUT else
                    lambda p,n:shade(n,"shadow"),sides=20 if ROLLOUT else 16,steps=7)
        if ROLLOUT:
            s.start("Hinged rear shield")
            s.ellipsoid(BODY+V((0,-.48,-.075)),(.441,.365,.141),"tail0",shell,sides=18,steps=10)
    if ROLLOUT and STYLE=="shrimp":
        s.start("Raised carapace and folded abdomen")
        s.ellipsoid(BODY+V((0,-.17,-.053)),(.27,.39,.249),"body",shell,sides=17,steps=10)
    if ROLLOUT and STYLE=="coconut":
        s.start("Rounded rear carapace")
        s.ellipsoid(BODY+V((0,-.43,-.09)),(.408,.392,.238),"body",shell,sides=17,steps=10)
    for side,sign in SIDES:
        s.start("Eye group "+side)
        eye=eye_center(sign)
        if STYLE in ("crab","coconut","mantis","shrimp","lobster"):
            p=eye+V((-sign*.047,-.025,-.095))
            s.tube([(p,.040,.040,{"body":1}),(eye,.036,.034,{"body":1})],
                   lambda p,n:shade(n),sides=7)
        count=3 if STYLE in ("spider","giant") else 1
        for i in range(count):
            p=eye+V((sign*.057*i,-.026*i,-.022*i))
            r=.056 if not i else .036
            s.ellipsoid(p,(r,r*.94,r),"body",lambda p,n:"accent" if n.z>.86 else "eye",sides=10,steps=6)
        if STYLE in ("lobster","mantis","shrimp"):
            s.start("Long antenna "+side)
            key,p,tip = feeler(side,sign) if ROLLOUT else (
                "body",eye+V((sign*.044,.121,-.048)),eye+V((sign*.278,.612,.036))
            )
            s.tube([(p,.035 if ROLLOUT else .033,.036,{key:1}),
                    (p.lerp(tip,.54),.026,.024,{key:1}),
                    (tip,.012 if ROLLOUT else .009,.012,{key:1})],
                   lambda p,n:"shadow" if ROLLOUT else shade(n,"accent"),sides=7)
        for i in range(LEGS):
            a,b,c=leg(side,i)
            up,down=f"leg.{side}.{i}.u",f"leg.{side}.{i}.d"
            s.start(f"Leg {side} {i}")
            r=.062 if STYLE in ("spider","giant","crab","coconut") else .051
            s.tube([(a,r*1.14,r*1.18,{up:1}),
                    (a.lerp(b,.59),r,r*.97,{up:1}),
                    (b,r*.82,r*.74,{up:.56,down:.44}),
                    (b.lerp(c,.65),r*.53,r*.55,{down:1}),
                    (c,.022,.021,{down:1})],
                   lambda p,n:"ink" if p.z < .128 else shade(n),sides=9)
        if claws():
            s.start("Hinged pincer "+side)
            a,b,c=claw(side)
            stem,pincer,lower=f"claw.{side}.u",f"claw.{side}.p",f"claw.{side}.d"
            s.tube([(a,.102,.086,{stem:1}),(b,.094,.086,{stem:.46,pincer:.54}),
                    (b.lerp(c,.50),.108,.106,{pincer:1}),
                    (c,.111,.104,{pincer:1})],lambda p,n:shade(n),sides=10)
            width=1.13 if STYLE in ("coconut","lobster") and sign==1 else .91
            size = (.126,.172,.108) if ROLLOUT and STYLE=="mantis" else (.172*width,.212,.114)
            if ROLLOUT and shore_crab():
                size = (.206*width,.243*width,.146*width)
            s.ellipsoid(c+V((sign*.018,.101,.030)),size,
                        pincer,lambda p,n:shade(n),sides=12,steps=9)
            for split, bone in ((1,pincer),(-1,lower)):
                club = ROLLOUT and STYLE=="mantis"
                p=c+V((sign*split*.083,.157 if club else .186,.019))
                tip=c+V((sign*split*.034,.241 if club else .342,.006))
                s.tube([(p,.080,.063,{bone:1}),(p.lerp(tip,.55),.057,.039,{bone:1}),
                        (tip,.013,.014,{bone:1})],
                       lambda p,n:"shadow" if club else
                       "accent" if (ROLLOUT and STYLE=="crab") or n.dot(LIGHT)>.62 else "coat",
                       sides=8)
    for i,(a,b) in enumerate(zip(TAIL,TAIL[1:])):
        s.start(f"Tail segment {i+1}")
        name=f"tail{i}"
        t=i/max(1,len(TAIL)-2)
        if STYLE in ("lobster","mantis","shrimp"):
            rw=(1-(.48 if ROLLOUT else .65)*t)*W*.88
            s.tube([(a,rw,.096,{name:1}),(a.lerp(b,.69),rw*.87,.083,{name:1}),
                    (b,rw*.67 if ROLLOUT else rw*.60,.048,{name:1})],shell,sides=11)
            if i==len(TAIL)-2:
                for sign in (-1,1):
                    radii = (.157,.177,.047) if ROLLOUT and STYLE!="shrimp" else (.134,.171,.048)
                    s.ellipsoid(b+V((sign*.108,-.055,.023)),radii,name,fan_ink,
                                sides=10 if ROLLOUT else 9,steps=6)
        else:
            r=.102*(1-.62*t)
            s.tube([(a,r,r,{name:1}),(a.lerp(b,.54),r*.96,r*.88,{name:1}),
                    (b,max(.011,r*.43),max(.011,r*.45),{name:1})],
                   lambda p,n:shade(n,"accent" if STYLE=="scorpion" else "coat"),sides=9)
    return s


def fan_ink(_, normal):
    if ROLLOUT and STYLE == "mantis":
        return "shadow" if normal.z>.04 else "coat"
    return shade(normal,"accent")


def rollout_pose(rest, clip, t):
    wave = math.tau*t
    swim = clip == "swim"
    walking = shore_crab() and clip in ("walk","chase","flee")
    rapid = clip in ("chase","flee")
    display = math.sin(math.pi*t)**2 if clip in ("display","action") else 0
    feeding = clip == "feed"
    kick = (.5-.5*math.cos(2*wave))*rapid
    lift = .031*math.cos(wave)+.09*display+.056*kick
    pitch = .039*math.sin(wave)-.21*display+.19*kick
    q = euler(pitch,(.081 if walking else .05)*math.sin(wave),
              .077*math.sin(wave) if swim else .03*math.sin(2*wave))
    body = transform(q,BODY,BODY+V((0,.060*kick,lift)))
    out = {"body":body@rest["body"]}
    for side, sign in SIDES:
        if STYLE in ("lobster","mantis","shrimp"):
            key, a, b = feeler(side, sign)
            flick = math.sin(wave*2+sign*.78)
            end = body@a + q@(euler(.20*flick+.16*display,0,sign*(.12*flick+.26*display))@(b-a))
            out[key] = aimed(rest[key],body@a,end)
        for i in range(LEGS):
            a,b,c = leg(side,i)
            phase = wave*(2 if rapid else 1)-i*.88+sign*.93
            sweep = (.18 if swim else .12 if rapid else .036)*math.sin(phase)
            bend = (.15 if swim else .20 if rapid else .06)*(1+math.cos(phase))*.5
            mid = body@b+V((sign*(.024*display-.08*kick),sweep*.48,bend*.42))
            tip = body@c+V((sign*(.046*display-.15*kick),sweep-.15*kick,bend))
            if walking:
                offset = i*.25+(.5 if sign<0 else 0)
                advance,lift = stride(t,offset,.225 if rapid else .156,.123 if rapid else .079)
                if STYLE=="crab":
                    step = V((advance,.34*advance,lift))
                else:
                    step = V((sign*.31*advance,.87*advance,lift))
                mid = body@b+step*.52
                tip = c+step
            stem, end = f"leg.{side}.{i}.u", f"leg.{side}.{i}.d"
            out[stem] = aimed(rest[stem],body@a,mid)
            out[end] = aimed(rest[end],mid,tip)
        if claws():
            a,b,c = claw(side)
            stem,palm,pincer = f"claw.{side}.u",f"claw.{side}.p",f"claw.{side}.d"
            grasp = math.sin(wave+sign*.64)**4 if feeding else 0
            jab = grasp*(.25 if STYLE=="mantis" else .08)
            mid = body@b+V((sign*.137*display,.10*jab+.09*kick,.139*display))
            wrist = body@c+V((sign*(.19*display-.12*grasp),jab+.08*kick,
                              .31*display+.12*grasp+.03*math.sin(wave+sign)))
            out[stem] = aimed(rest[stem],body@a,mid)
            out[palm] = aimed(rest[palm],mid,wrist)
            opening = .07+.63*display+.40*grasp
            claw_rot = (out[palm]@rest[palm].inverted()).to_quaternion()
            out[pincer] = transform(claw_rot@euler(0,0,-sign*opening),c,wrist)@rest[pincer]
    if not TAIL:
        return out
    cursor = body@TAIL[0]
    for i,(a,b) in enumerate(zip(TAIL,TAIL[1:])):
        beat = math.sin(wave-i*.61)
        curl = .11*beat if swim else .40*kick if rapid else -.20*display
        if STYLE == "shrimp" and rapid:
            curl *= 1.36
        if STYLE == "horseshoe":
            curl = (.15 if swim else .28 if rapid else .055)*beat-.30*display
        end = cursor+q@(euler(curl,0,.063*beat+.05*kick)@(b-a))
        key = f"tail{i}"
        out[key] = aimed(rest[key],cursor,end)
        cursor = end
    return out


def pose(rig,rest,clip,t):
    if ROLLOUT:
        return rollout_pose(rest,clip,t)
    wave=math.tau*t
    walk,swim=clip=="walk",clip=="swim"
    pinch=math.sin(math.pi*t)**2 if clip in ("display","action","feed") else 0
    q=euler(.054*math.sin(wave),.052*math.sin(wave)*int(walk),.054*math.sin(wave)*int(swim))
    body=transform(q,BODY,BODY+V((.034*math.sin(wave)*int(walk),.029*pinch,
                                .035*math.cos(wave)-(H*.29 if clip=="sleep" else 0))))
    out={"body":body@rest["body"]}
    for side,sign in SIDES:
        for i in range(LEGS):
            a,b,c=leg(side,i)
            u,d=f"leg.{side}.{i}.u",f"leg.{side}.{i}.d"
            phase=i*.25+(0 if sign>0 else .5)
            advance,lift=stride(t,phase,.159,.086) if walk else (0,0)
            if swim:
                advance=.15*math.sin(wave+phase*math.tau)
                lift=.11+.079*math.cos(wave+phase*math.tau)
            if clip=="sleep":
                c=c.lerp(a,.37)
            tip=c+V((sign*advance*.84 if STYLE in ("crab","coconut") else 0,
                     advance*.47 if STYLE in ("crab","coconut") else advance,lift))
            mid=body@b+V((sign*advance*.26,.49*advance,.48*lift))
            out[u]=aimed(rest[u],body@a,mid)
            out[d]=aimed(rest[d],mid,tip)
        if claws():
            a,b,c=claw(side)
            upper,pincer,lower=f"claw.{side}.u",f"claw.{side}.p",f"claw.{side}.d"
            mid=body@b+V((sign*.108*pinch,.061*pinch,.12*pinch))
            tip=body@c+V((sign*.14*pinch,.11*pinch,.22*pinch+.031*math.sin(wave)))
            out[upper]=aimed(rest[upper],body@a,mid)
            out[pincer]=aimed(rest[pincer],mid,tip)
            lrot=q@euler(.11*pinch,0,-sign*.61*pinch)
            out[lower]=transform(lrot,c,tip)@rest[lower]
    if TAIL:
        p=body@TAIL[0]
        for i,(a,b) in enumerate(zip(TAIL,TAIL[1:])):
            beat=math.sin(wave-i*.57)
            curl=-.37*pinch if STYLE=="scorpion" else .22*beat*int(swim)
            end=p+q@(euler(curl,0,.062*beat)@(b-a))
            name=f"tail{i}"
            out[name]=aimed(rest[name],p,end)
            p=end
    return out
