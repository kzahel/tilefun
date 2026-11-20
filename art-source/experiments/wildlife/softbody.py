"""Original shelled and soft-bodied animals with spatially articulated appendages."""
import math
from wildlife_build import CatSurface, V, aimed, euler, mix, transform

PROFILES={
    "snail":("Garden Snail","snail",(.36,.47,.44),2,"473c2d 745b41 9d7e51 c0a571 d5bd87 655842"),
    "octopus":("Rust Octopus","octopus",(.37,.36,.43),8,"573a2d 905234 b96e48 d0936b e3b28b 534336"),
    "cuttlefish":("Cuttlefish","cuttlefish",(.34,.63,.33),8,"544438 85664e a78a69 c9ac81 e0c59b 5d4b3e"),
    "nautilus":("Nautilus","nautilus",(.39,.45,.46),7,"5b483c 927257 bb9871 d7ba8d e4ccab 685445"),
    "jellyfish":("Moon Jellyfish","jellyfish",(.52,.52,.32),10,"4f6270 748896 9cadb1 bbccd0 d7e0d8 6a8190"),
    "starfish":("Starfish","starfish",(.27,.27,.15),5,"644334 9e674e c58c69 d9ac81 e8c59a 93664c"),
    "manta-ray":("Manta Ray","ray",(.39,.56,.23),2,"303e49 4f6270 6f8390 98a7aa cbcec0 425764"),
    "seahorse":("Seahorse","horse",(.243,.28,.38),1,"514936 846e4d b49b6e d5bd8e e4cea0 77644a"),
    "leafy-seadragon":("Leafy Seadragon","dragon",(.244,.33,.34),1,"4e5134 687b4a 91a364 b3b982 d0ce99 7b8758"),
}
LIGHT=V((-.44,.25,.86)).normalized()
NAME=STYLE=DIMS=COUNT=PALETTE=DURATIONS=None
BODY=ARMS=None


def configure(variant):
    global NAME,STYLE,DIMS,COUNT,PALETTE,DURATIONS,BODY,ARMS
    NAME,STYLE,DIMS,COUNT,colors=PROFILES[variant]
    PALETTE=dict(zip(("ink","shadow","coat","light","pale","mark"),colors.split()))
    DURATIONS={"idle":48,"crawl":30,"swim":29,"jet":24,"pulse":26,
               "action":25,"feed":26,"display":24}
    BODY=V((0,0, .81 if STYLE=="jellyfish" else .62 if STYLE in ("horse","dragon") else
            .25 if STYLE=="starfish" else .43 if STYLE=="snail" else .54))
    ARMS=[arm_axis(i) for i in range(COUNT)]


def arm_axis(i):
    theta=i*math.tau/COUNT
    x,y=math.sin(theta),math.cos(theta)
    if STYLE=="starfish":
        return [BODY+V((x*.15,y*.15,0)),BODY+V((x*.51,y*.51,-.023)),
                BODY+V((x*.83,y*.83,-.054)), BODY+V((x*1.01,y*1.01,-.081))]
    if STYLE=="jellyfish":
        reach=.58+.10*math.sin(i*2.1)
        return [BODY+V((x*.29,y*.29,-.091)),BODY+V((x*.35,y*.35,-.30)),
                BODY+V((x*.30,y*.30,-reach*.82)),BODY+V((x*.36,y*.36,-reach))]
    if STYLE in ("horse","dragon"):
        return [BODY+V((0,-.125,-.18)),BODY+V((0,-.254,-.47)),
                BODY+V((0,-.42,-.55)),BODY+V((0,-.48,-.37))]
    if STYLE=="ray":
        sign=1 if i==0 else -1
        return [BODY+V((sign*.22,.17,.012)),BODY+V((sign*.60,-.025,-.032)),
                BODY+V((sign*.92,-.29,-.028)),BODY+V((sign*1.22,-.45,-.054))]
    if STYLE=="snail":
        sign=1 if i==0 else -1
        return [BODY+V((sign*.10,.51,.073)),BODY+V((sign*.164,.593,.22)),
                BODY+V((sign*.189,.67,.39)),BODY+V((sign*.209,.72,.42))]
    if STYLE in ("cuttlefish","nautilus"):
        across=(i-(COUNT-1)/2)/max(1,(COUNT-1)/2)
        reach=.57 if STYLE=="cuttlefish" else .39
        return [BODY+V((across*.213,.43,-.06)),BODY+V((across*.31,.61,-.13)),
                BODY+V((across*.43,.71+reach*.38,-.12)),
                BODY+V((across*.48,.71+reach*.58,-.08))]
    # Octopus arms fan outward and curl up at their ends.
    span=.92+.11*math.sin(i*1.9)
    return [BODY+V((x*.21,y*.23,-.13)),BODY+V((x*span*.48,y*span*.49,-.24)),
            BODY+V((x*span*.82,y*span*.83,-.27)),BODY+V((x*span,y*span,-.11))]


def part(i,n):
    return f"arm.{i:02}.{n}"


def joints():
    arr=[("body",BODY,BODY+V((0,.39,0)),None)]
    if STYLE in ("snail","horse","dragon","jellyfish","octopus"):
        arr.append(("head",BODY+V((0,.25,.13)),BODY+V((0,.57,.22)),"body"))
    if STYLE=="ray":
        p=BODY+V((0,-.39,-.037))
        arr.append(("tail",p,p+V((0,-.88,.03)),"body"))
    for i, points in enumerate(ARMS):
        for n,(a,b) in enumerate(zip(points,points[1:])):
            arr.append((part(i,n),a,b,part(i,n-1) if n else "body"))
    return arr


def band(n,color="coat"):
    light=n.dot(LIGHT)
    return "shadow" if light<-.37 else "light" if light>.65 else color


def shell_color(p,n):
    q=p-BODY
    a=math.atan2(q.z-.16,q.y)
    r=math.hypot(q.z-.16,q.y)
    if math.cos(a*2-r*27)>.48:
        return "mark"
    return band(n)


def surface():
    s=CatSurface()
    s.start("Distinct body volume")
    if STYLE in ("snail","nautilus"):
        s.ellipsoid(BODY+V((0,-.09,.192)),DIMS,"body",shell_color,sides=22,steps=14)
        if STYLE=="snail":
            foot=BODY+V((0,.191,-.27))
            s.ellipsoid(foot,(.251,.681,.116),"body",
                        lambda p,n:band(n,"pale"),sides=16,steps=10)
            s.ellipsoid(foot+V((0,.419,.20)),(.184,.252,.15),"head",
                        lambda p,n:band(n,"light"),sides=14,steps=8)
    elif STYLE=="jellyfish":
        for i,(y,mul,h) in enumerate(((0,1,.25),(0,.88,.25),(0,.62,.103))):
            s.ellipsoid(BODY+V((0,y,.04+i*.085)),(DIMS[0]*mul,DIMS[1]*mul,h),
                        "body" if not i else "head",
                        lambda p,n:"pale" if n.z>.52 else "coat" if n.z>-.12 else "mark",
                        sides=20,steps=11)
    elif STYLE in ("horse","dragon"):
        s.ellipsoid(BODY,DIMS,"body",lambda p,n:band(n),sides=16,steps=10)
        face=BODY+V((0,.187,.321))
        s.ellipsoid(face,(.177,.239,.21),"head",lambda p,n:band(n),sides=14,steps=9)
        s.tube([(face+V((0,.12,-.048)),.088,.067,{"head":1}),
                (face+V((0,.304,-.087)),.048,.051,{"head":1}),
                (face+V((0,.379,-.111)),.034,.039,{"head":1})],
               lambda p,n:band(n,"pale"),sides=9)
        for sign in (-1,1):
            s.ellipsoid(face+V((sign*.151,.067,.057)),(.047,.052,.050),
                        "head",lambda p,n:"ink",sides=9,steps=6)
        if STYLE=="dragon":
            for sign in (-1,1):
                for row in range(3):
                    middle=BODY+V((sign*(.26+row*.045),-.164+row*.183,-.124+row*.148))
                    s.ellipsoid(middle,(.175,.088,.055),"body",
                                lambda p,n:band(n,"pale"),sides=9,steps=6)
    else:
        s.ellipsoid(BODY,DIMS,"body",lambda p,n:band(n,"pale" if n.z<-.42 else "coat"),
                    sides=20,steps=12)
    if STYLE in ("octopus","cuttlefish","nautilus","ray"):
        for sign in (-1,1):
            pos=BODY+V((sign*DIMS[0]*.58,DIMS[1]*(.74 if STYLE=="ray" else .84),DIMS[2]*.55))
            s.ellipsoid(pos,(.064,.071,.064),"body",lambda p,n:"pale" if n.z>.83 else "ink",
                        sides=10,steps=6)
    if STYLE=="ray":
        s.start("Trailing ray tail")
        p=BODY+V((0,-.39,-.037))
        tail=[(p,.079,.053,{"tail":1}),(p+V((0,-.42,.016)),.048,.036,{"tail":1}),
              (p+V((0,-.97,.062)),.013,.014,{"tail":1})]
        s.tube(tail,lambda p,n:"mark" if n.z>.33 else "shadow",sides=8)
    if STYLE=="cuttlefish":
        for sign in (-1,1):
            p=BODY+V((sign*.32,-.143,-.096))
            s.ellipsoid(p,(.141,.60,.049),"body",lambda p,n:band(n,"pale"),sides=12,steps=10)
    for i, points in enumerate(ARMS):
        s.start(f"Radiating appendage {i+1}")
        segments=[]
        thick=.10 if STYLE in ("starfish","octopus") else .068 if STYLE in ("dragon","horse") else .047
        for n,(a,b) in enumerate(zip(points,points[1:])):
            for frac in (0,.51):
                scale=1-.78*(n+frac)/3
                width,depth=thick*scale,thick*scale*.88
                if STYLE=="ray":
                    width,depth=((.28,.231,.091)[n],(.09,.066,.045)[n])
                if STYLE=="starfish":
                    width,depth=((.171,.142,.067)[n],(.085,.073,.052)[n])
                weights={part(i,n):1} if n==0 or frac else {part(i,n-1):.4,part(i,n):.6}
                segments.append((a.lerp(b,frac),width,depth,weights))
        segments.append((points[-1],.013,.014,{part(i,2):1}))
        s.tube(segments,lambda p,n:band(n,"mark" if math.cos((p.x+p.y)*33)>.69 else "coat"),
               sides=10 if STYLE in ("starfish","ray","octopus") else 8)
        if STYLE=="snail":
            s.ellipsoid(points[-1],(.041,.046,.048),part(i,2),lambda p,n:"ink",sides=9,steps=5)
        if STYLE=="octopus":
            for n in range(3):
                p=points[n].lerp(points[n+1],.48)+V((0,0,-.052))
                s.ellipsoid(p,(.043,.054,.022),part(i,n),lambda p,n:"pale",sides=8,steps=4)
    return s


def pose(rig,rest,clip,t):
    wave=math.tau*t
    travel=clip in ("crawl","swim","jet","pulse")
    action=math.sin(math.pi*t)**2 if clip in ("action","feed","display") else 0
    pulse=(.107 if clip in ("jet","pulse") else .038)*math.sin(wave)
    q=euler(.054*math.sin(wave),.047*math.cos(wave),.072*math.sin(wave)*travel)
    body=transform(q,BODY,BODY+V((0,.048*action,pulse)))
    out={"body":body@rest["body"]}
    if "head" in rest:
        a=rest["head"].translation
        forward=.094*action if STYLE in ("snail","octopus","horse","dragon") else 0
        result=body@a+V((0,forward,pulse*.71))
        out["head"]=transform(q@euler(-.19*action),a,result)@rest["head"]
    if "tail" in rest:
        a=rest["tail"].translation
        out["tail"]=transform(q@euler(.095*math.sin(wave),0,.28*math.sin(wave)),a,body@a)@rest["tail"]
    for i,points in enumerate(ARMS):
        p=body@points[0]
        sign=1 if points[-1].x>=0 else -1
        for n,(a,b) in enumerate(zip(points,points[1:])):
            k=math.sin(wave+n*.52+i*.59)
            yaw=(.30 if travel else .14)*k
            pitch=(.45 if clip=="jet" else .25 if travel else .13)*k+.20*action
            if STYLE=="ray":
                yaw*=.24
                pitch*=.64
            q_arm=euler(pitch,sign*(.38 if STYLE=="ray" and travel else .10)*k,yaw)
            delta=q@(q_arm@(b-a))
            out[part(i,n)]=aimed(rest[part(i,n)],p,p+delta)
            p+=delta
    return out
