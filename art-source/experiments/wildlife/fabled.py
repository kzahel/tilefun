"""Original flight and heavy-body rigs for the bat and Tilefun's fantasy animals."""
import math

from wildlife_build import CatSurface, V, aimed, euler, stride, transform

PROFILES={
    "griffin":("Griffin",(.46,.91,.43),.70,.37,1.46,"eagle","282633 665044 a37a4e cfaa6b e8e4cf d6a34b 4a3831"),
    "small-dragon":("Small Dragon",(.43,.80,.39),.43,.47,1.25,"dragon","202b30 284f4c 428569 7cb88b f4ead0 875073 e0a955"),
    "t-rex":("T. rex",(.56,1.19,.56),1.04,.75,0,"rex","263027 415038 6c8051 93a469 c8c697 e7dcc0 d5a550"),
    "bat":("Bat",(.274,.42,.28),.23,.24,1.19,"bat","20282b 493f39 76634f 9a8064 b19a77 9b796c b0a28b"),
}
LIGHT=V((-.43,.30,.85)).normalized()
SIDES=(("l",1),("r",-1))
NAME=STYLE=PALETTE=DURATIONS=DIMS=BODY=HEAD=JAW=TAIL=FEET=WINGS=None


def configure(key):
    global NAME,STYLE,PALETTE,DURATIONS,DIMS,BODY,HEAD,JAW,TAIL,FEET,WINGS
    NAME,DIMS,leg,head_r,spread,STYLE,colors=PROFILES[key]
    PALETTE=dict(zip(("ink","shade","coat","light","pale","wing","accent"),colors.split()))
    DURATIONS={"idle":48,"walk":27,"fly":22,"action":24,"feed":27,"display":28,"sleep":40}
    w,d,h=DIMS
    BODY=V((0,0,leg+h*.47))
    HEAD=BODY+V((0,d*(1.02 if STYLE=="rex" else .79),h*(1.19 if STYLE=="rex" else .67)))
    JAW=HEAD+V((0,head_r*.22,-head_r*.24))
    TAIL=[BODY+V(p) for p in (
        (0,-d*.75,h*.14),(0,-d*1.10,h*.18),(0,-d*1.49,h*.32),
        (0,-d*(2.55 if STYLE=="rex" else 2.27 if STYLE=="dragon" else 1.75),h*.50),
    )]
    FEET={}
    WINGS={}
    for side,sign in SIDES:
        base=BODY+V((sign*w*.65,d*.49,h*.48))
        if spread:
            WINGS[side]=(base,base+V((sign*spread*.53,-.06,.14)),
                         base+V((sign*spread*.98,-.43,.036)))
        axes=("back",) if STYLE=="bat" else ("front","back")
        for limb in axes:
            front=limb=="front"
            a=BODY+V((sign*w*.51,d*(.61 if front else -.53),-.14))
            if STYLE=="rex" and front:
                b=a+V((sign*.085,.092,-.24))
                c=b+V((sign*.024,.18,-.11))
            else:
                b=V((sign*w*.65,a.y+(.07 if front else -.16),a.z*.60))
                c=V((sign*w*((.52 if STYLE=="bat" else .67)),a.y+(.07 if front else -.05),.115))
            FEET[f"{limb}.{side}"]=(a,b,c)
    DIMS=(*DIMS,head_r)


def joints():
    arr=[("body",BODY,BODY+V((0,.44,0)),None),
         ("head",HEAD,HEAD+V((0,.41,0)),"body"),("jaw",JAW,JAW+V((0,.32,-.04)),"head")]
    for side,(a,b,c) in WINGS.items():
        arr.extend(((f"wing.{side}",a,b,"body"),(f"tip.{side}",b,c,f"wing.{side}")))
    for name,(a,b,c) in FEET.items():
        up,dn,paw=f"{name}.u",f"{name}.d",f"{name}.tip"
        arr.extend(((up,a,b,"body"),(dn,b,c,up),(paw,c,c+V((0,.20,0)),dn)))
    for i,(a,b) in enumerate(zip(TAIL,TAIL[1:])):
        arr.append((f"tail{i}",a,b,f"tail{i-1}" if i else "body"))
    return arr


def shade(n,c="coat"):
    d=n.dot(LIGHT)
    return "shade" if d<-.42 else "light" if d>.66 and c=="coat" else c


def body_paint(p,n):
    q=p-BODY
    if STYLE=="eagle" and q.y>.24 and q.z>.04:
        return "pale"
    if STYLE=="rex":
        if q.z < -.17:
            return "pale" if n.z > -.7 else "light"
        return "shade" if q.z>.24 and math.cos(q.y*17+abs(q.x)*6)>.48 else shade(n)
    if q.z<-.22 and STYLE!="bat":
        return "pale" if n.dot(LIGHT)>.15 else "light"
    if STYLE in ("dragon","rex") and q.z>0 and math.cos(q.y*21+q.x*8)>.52:
        return "shade"
    return shade(n)


def surface():
    s=CatSurface()
    w,d,h,r=DIMS
    s.start("Creature-specific torso")
    s.ellipsoid(BODY,(w,d,h),"body",body_paint,sides=20,steps=12)
    s.start("Articulated neck and head")
    neck_from=BODY+V((0,d*.48,h*.28))
    neck_mid=neck_from.lerp(HEAD,.48)+V((0,-.16,.18)) if STYLE=="rex" else neck_from.lerp(HEAD,.48)
    s.tube([(neck_from,w*.75,w*.68,{"body":.78,"head":.22}),
            (neck_mid,r*.69,r*.67,{"body":.42,"head":.58}),
            (HEAD,r*.73,r*.70,{"head":1})],
           lambda p,n:"pale" if STYLE=="eagle" else shade(n),sides=14)
    s.ellipsoid(HEAD,(r*.65,r*(.78 if STYLE=="eagle" else .91),r*.54),"head",
                lambda p,n:"pale" if STYLE=="eagle" else shade(n),sides=16,steps=10)
    muzzle=HEAD+V((0,r*.56,-.051))
    length=.39 if STYLE=="rex" else .25 if STYLE in ("dragon","eagle") else .18
    if STYLE=="rex":
        muzzle=HEAD+V((0,r*.66,-.05))
        for bone, z, thick in (("head",0,.26),("jaw",-.32,.125)):
            s.tube([(muzzle+V((0,dy,z)),width,thick*height,{bone:1})
                    for dy,width,height in ((-.35,.43,.85),(-.07,.40,1),(.38,.32,.88),(.46,.25,.64))],
                   lambda p,n:shade(n) if bone=="head" else "pale" if n.z<-.15 else "shade",sides=8)
    else:
        s.ellipsoid(muzzle,(r*.48,length,r*.27),"head",
                    lambda p,n:"wing" if STYLE=="eagle" else shade(n),sides=14,steps=8)
        s.ellipsoid(muzzle+V((0,.031,-r*.317)),(r*.43,length*.87,r*.175),"jaw",
                    lambda p,n:"wing" if STYLE=="eagle" else "pale" if n.z>.02 else "shade",
                    sides=13,steps=7)
    for sign in (-1,1):
        eye=HEAD+V((sign*r*.53,r*.55,r*.14))
        s.ellipsoid(eye,(.066,.061,.062),"head",
                    lambda p,n:"accent" if n.y>.22 else "ink",sides=10,steps=6)
        s.ellipsoid(eye+V((sign*.043,.033,.016)),(.028,.026,.036),"head",
                    lambda p,n:"pale" if n.z>.89 else "ink",sides=8,steps=5)
        if STYLE=="rex":
            s.ellipsoid(eye+V((sign*.055,-.036,.085)),(.095,.195,.066),"head",
                        lambda p,n:shade(n),sides=10,steps=6)
        if STYLE in ("bat","dragon","eagle"):
            r0=.090 if STYLE=="bat" else .071
            a=HEAD+V((sign*r*.54,-r*.11,r*.27))
            b=a+V((sign*.139,-.068,.32 if STYLE=="bat" else .205))
            s.tube([(a,r0,r0*.76,{"head":1}),(a.lerp(b,.53),r0*.65,r0*.65,{"head":1}),
                    (b,.012,.014,{"head":1})],
                   lambda p,n:"wing" if STYLE=="bat" and n.y>.42 else "pale" if STYLE=="eagle" else shade(n),
                   sides=9)
        if STYLE in ("rex","dragon"):
            for i in range(5 if STYLE=="rex" else 3):
                a=muzzle+V((sign*(.372-i*.015),-.09+i*.105,-.18)) if STYLE=="rex" else muzzle+V((sign*r*.40,.121+i*.073,-r*.18))
                s.tube([(a,.024,.027,{"head":1}),(a+V((0,0,-.068)),.006,.007,{"head":1})],
                       lambda p,n:"wing" if STYLE=="rex" else "pale",sides=7)
    for side,(a,b,c) in WINGS.items():
        s.start("Flight surface " + side)
        upper,tip=f"wing.{side}",f"tip.{side}"
        sign=1 if side=="l" else -1
        s.tube([(a,.082,.070,{upper:1}),(a.lerp(b,.51),.075,.128,{upper:1}),
                (b,.061,.106,{upper:.55,tip:.45}),
                (b.lerp(c,.55),.054,.169,{tip:1}),(c,.017,.031,{tip:1})],
               lambda p,n:"wing" if STYLE in ("dragon","bat") else "pale",sides=10)
        for i in range(5):
            p=a.lerp(b,.36) if i<2 else b.lerp(c,(i-2)*.21)
            root=upper if i<2 else tip
            end=p+V((sign*(.18+i*.043),-.31-i*.038,-.048+.008*i))
            width=.119 if STYLE=="eagle" else .131
            s.tube([(p,.052,.048,{root:1}),(p.lerp(end,.56),width,.040,{root:1}),
                    (p.lerp(end,.83),width*.66,.029,{root:1}),
                    (end,.012,.014,{root:1})],
                   lambda p,n:"pale" if STYLE=="eagle" and n.z>.41 else "ink" if n.z<-.56 else "wing",
                   sides=9)
    for name,(a,b,c) in FEET.items():
        s.start(name)
        upper,lower,paw=f"{name}.u",f"{name}.d",f"{name}.tip"
        fore=name.startswith("front")
        broad=w*(.35 if not fore else .24)
        if STYLE=="rex" and fore:
            broad*=.63
        elif STYLE=="rex":
            broad*=1.33
        s.tube([(a,broad,broad*.93,{upper:1}),
                (a.lerp(b,.63),broad*.76,broad*.80,{upper:1}),
                (b,broad*.63,broad*.60,{upper:.58,lower:.42}),
                (b.lerp(c,.65),broad*.49,broad*.52,{lower:1}),
                (c,broad*.44,broad*.44,{lower:.49,paw:.51})],
               lambda p,n:shade(n),sides=10)
        for i in (-1,0,1):
            digit=c+V((i*.052,.11,-.039))
            s.ellipsoid(digit,(.035,.114,.043),paw,
                        lambda p,n:"accent" if STYLE=="eagle" and fore else shade(n),sides=8,steps=5)
    s.start("Tapered tail")
    for i,(a,b) in enumerate(zip(TAIL,TAIL[1:])):
        wide=max(.028,w*(.60-.18*i))
        if STYLE=="bat":
            wide*=.29
        name=f"tail{i}"
        s.tube([(a,wide,wide*.81,{name:1}),
                (a.lerp(b,.57),wide*.82,wide*.69,{name:1}),
                (b,wide*.59,wide*.51,{name:1})],
               lambda p,n:body_paint(p,n),sides=11)
    return s


def pose(rig,rest,clip,t):
    wave=math.tau*t
    walk=clip=="walk"
    fly=clip=="fly"
    mouth=math.sin(math.pi*t)**2 if clip in ("feed","display","action") else 0
    q=euler((.08 if clip=="display" else -.17)*mouth+.047*math.sin(wave)*walk,0,
             .034*math.sin(wave))
    body=transform(q,BODY,BODY+V((0,.062*mouth,.042*math.sin(wave)-(.14 if clip=="sleep" else 0))))
    out={"body":body@rest["body"]}
    pitch=(-.70 if clip=="feed" else .39) if STYLE=="rex" else (-.35 if clip=="feed" else .18)
    dip=(-.45 if clip=="feed" else .22)*mouth if STYLE=="rex" else 0
    hq=q@euler(pitch*mouth,0,.068*math.sin(wave))
    h=transform(hq,HEAD,body@HEAD+V((0,.17*mouth if STYLE=="rex" else 0,dip)))
    out["head"]=h@rest["head"]
    out["jaw"]=transform(hq@euler((-.79 if STYLE=="rex" else -.51)*mouth),JAW,h@JAW)@rest["jaw"]
    for side,(a,b,c) in WINGS.items():
        sign=1 if side=="l" else -1
        upper,tip=f"wing.{side}",f"tip.{side}"
        spread=1 if fly else .85*mouth if clip=="display" else .48 if STYLE=="bat" else .16
        beat=(.61 if fly else .30)*math.cos(wave)
        d1=V((sign*.50,-.68,.12)).normalized().lerp(V((sign*.93,-.10,beat)).normalized(),spread).normalized()
        d2=V((sign*.31,-.78,.07)).normalized().lerp(V((sign*.87,-.30,beat*.82)).normalized(),spread).normalized()
        mid=a+d1*(b-a).length
        end=mid+d2*(c-b).length
        out[upper]=aimed(rest[upper],body@a,body@mid)
        out[tip]=aimed(rest[tip],body@mid,body@end)
    for name,(a,b,c) in FEET.items():
        fore=name.startswith("front")
        phase=(.27 if fore else 0)+(.5 if name.endswith(".r") else 0)
        advance,lift=stride(t,phase,.46,.20) if walk and STYLE=="rex" else stride(t,phase,.27,.137) if walk else (0,0)
        if fly:
            advance-=.17
            lift+=.24
        if fore and STYLE=="rex":
            advance*=.38
            lift*=.38
        up,dn,paw=f"{name}.u",f"{name}.d",f"{name}.tip"
        mid=body@b+V((0,.52*advance,.49*lift))
        end=c+V((0,advance,lift))
        out[up]=aimed(rest[up],body@a,mid)
        out[dn]=aimed(rest[dn],mid,end)
        out[paw]=transform(euler(lift*.39),V((0,0,0)),end)
    p=body@TAIL[0]
    for i,(a,b) in enumerate(zip(TAIL,TAIL[1:])):
        delta=q@(euler(.09*math.sin(wave-i*.73),0,
                       (.26 if walk or fly else .095)*math.sin(wave-i*.69))@(b-a))
        out[f"tail{i}"]=aimed(rest[f"tail{i}"],p,p+delta)
        p+=delta
    return out
