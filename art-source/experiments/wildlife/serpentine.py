"""Continuous articulated bodies for snakes, eels, worms and many-legged crawlers."""
import math

from wildlife_build import CatSurface, V, aimed, euler, mix, stride, transform

# Length, trunk radius, segment count, anatomy and shade slots.
PROFILES={
    "king-cobra":("King Cobra",3.02,.166,13,"hood","383328 6c593b a89060 c2a975 d9c994 2f2c27"),
    "gaboon-viper":("Gaboon Viper",2.84,.199,12,"diamond","3f332b 785643 b68a63 d5af89 e6caa4 332a23"),
    "electric-eel":("Electric Eel",3.11,.163,13,"eel","383629 675640 987957 b79a71 d9bd88 2f2923"),
    "moray-eel":("Moray Eel",2.91,.177,13,"moray","344036 62704d 90a06a b6bd85 dbd2a0 29352b"),
    "worm":("Earthworm",2.31,.131,12,"rings","593c34 8e5d4f b98071 d8a093 eac1ac 4b332d"),
    "worm1":("Worm 1",2.31,.133,11,"cartoon","503430 984d43 cd7464 e4a08a f2c6aa 3b2c2a"),
    "worm2":("Worm 2",2.23,.137,11,"cartoon","3e3341 52445a 655058 8f6d78 a78491 403343"),
    "worm3":("Worm 3",2.27,.137,11,"cartoon","1f4638 215d48 207249 379466 6ea36e 1e4133"),
    "worm4":("Worm 4",2.35,.135,11,"cartoon","554739 6f4d3c 7a5f32 a07e4e b49760 4f3a2d"),
    "centipede":("Centipede",2.88,.136,13,"flat-legs","392f28 704437 a96543 c68b5a d8ad72 2e2923"),
    "millipede":("Millipede",2.72,.171,14,"many-legs","342c28 564239 7f5f4b a78668 c0a280 2c2824"),
}
LIGHT=V((-.42,.26,.87)).normalized()
NAME=STYLE=PALETTE=DURATIONS=POINTS=RADIUS=None
CLASSIC_WORM_ROLLOUT=False


def configure(key):
    global NAME,STYLE,PALETTE,DURATIONS,POINTS,RADIUS
    NAME,length,RADIUS,count,STYLE,colors=PROFILES[key]
    PALETTE=dict(zip(("ink","dark","coat","light","pale","eye"),colors.split()))
    DURATIONS={"idle":48,"slither":30,"crawl":30,"walk":29,"swim":29,"action":23,"display":25,"feed":24}
    POINTS=[]
    for i in range(count+1):
        k=i/count
        sway=(.104 if STYLE not in ("rings","cartoon") else .063)*math.sin(k*math.tau*1.65)
        y=(.49-k)*length
        z=RADIUS*.91+.048 if STYLE not in ("eel","moray") else RADIUS*1.31+.052
        POINTS.append(V((sway,y,z)))


def configure_rollout():
    global CLASSIC_WORM_ROLLOUT, PALETTE
    assert STYLE=="cartoon"
    colors = {
        "Worm 1":"614749 7f5144 8d6250 a27657 9b7b5e 594236",
        "Worm 2":"52445a 655058 786471 9b7887 8c716d 4e404b",
        "Worm 3":"215d48 207249 3b8059 4c8654 6a9a69 184f3c",
        "Worm 4":"6f4d3c 7a5f32 8b7343 9b8250 a48b57 5c4930",
    }
    PALETTE = dict(zip(("ink","dark","coat","light","pale","eye"),colors[NAME].split()))
    CLASSIC_WORM_ROLLOUT = True


def many_legs():
    return STYLE in ("flat-legs","many-legs")


def segment(i):
    return f"section.{i:02}"


def foot_points(i,sign):
    a=POINTS[i]+V((sign*RADIUS*.71,.01,-.017))
    b=a+V((sign*RADIUS*1.16,-.072,-.063))
    c=b+V((sign*RADIUS*.51,-.043,-.081))
    return a,b,c


def joints():
    items=[]
    for i,(a,b) in enumerate(zip(POINTS,POINTS[1:])):
        items.append((segment(i),a,b,segment(i-1) if i else None))
        if many_legs() and 0<i<len(POINTS)-2:
            for sign in (-1,1):
                root,knee,foot=foot_points(i,sign)
                name=f"foot.{i}.{sign}"
                items.extend(((name+".up",root,knee,segment(i)),(name+".down",knee,foot,name+".up")))
    return items


def color(point,n):
    if CLASSIC_WORM_ROLLOUT:
        ridge = .47<math.cos(point.y*31)<.71
        return "dark" if ridge or n.dot(LIGHT)<-.37 else "light" if n.dot(LIGHT)>.66 else "coat"
    if point.z<POINTS[0].z-RADIUS*.35:
        return "pale" if n.dot(LIGHT)>-.59 else "light"
    detail=math.cos(point.y*33)
    if STYLE in ("rings","cartoon","many-legs","flat-legs") and detail>.44:
        return "dark" if STYLE!="cartoon" else "light"
    if STYLE in ("diamond","moray"):
        ax=(point.y*4.16+point.x*1.30)%1-.5
        az=(point.z*6.47+abs(point.x)*4.9+math.floor(point.y*4.16)*.31)%1-.5
        if abs(ax)+abs(az) < .39:
            return "dark"
    if STYLE=="hood" and detail>.62:
        return "dark"
    light=n.dot(LIGHT)
    return "light" if light>.55 else "coat" if light>-.35 else "dark"


def surface():
    s=CatSurface()
    s.start("Continuous oval cross-section and flexible taper")
    sections=[]
    count=len(POINTS)-1
    for i,(a,b) in enumerate(zip(POINTS,POINTS[1:])):
        for fraction in (0,.45,.77):
            t=(i+fraction)/count
            base=math.sin(math.pi*(t*.84+.11))**.55
            if STYLE in ("rings","cartoon","many-legs","flat-legs"):
                base=1-.55*t*t+(.073 if fraction==.45 else 0)
            if STYLE in ("hood","diamond","eel","moray"):
                base*=1-t**5
            r=max(.022,RADIUS*base)
            weights={segment(i):1}
            if fraction==0 and i:
                weights={segment(i-1):.55,segment(i):.45}
            sections.append((a.lerp(b,fraction),r,r*(.68 if STYLE=="flat-legs" else .84),weights))
    sections.append((POINTS[-1],.020,.018,{segment(count-1):1}))
    s.tube(sections,color,sides=12)
    head=POINTS[0]+V((0,.067,.026))
    s.start("Species head and eyes")
    if STYLE in ("hood","diamond","eel","moray","cartoon","flat-legs","many-legs"):
        s.ellipsoid(head,(RADIUS*(1.55 if STYLE=="diamond" else 1.22),.218,RADIUS*.86),segment(0),
                    color,sides=14,steps=8)
        for sign in (-1,1):
            p=head+V((sign*RADIUS*.86,.082,RADIUS*.48))
            s.ellipsoid(p,(.038,.041,.043),segment(0),lambda p,n:"pale" if n.z>.86 else "eye",sides=9,steps=5)
    if STYLE=="hood":
        s.start("Cobra hood")
        for sign in (-1,1):
            hood=head+V((sign*.119,-.211,-.012))
            s.ellipsoid(hood,(.168,.278,.063),segment(0),
                        lambda p,n:"pale" if abs(p.x)<.12 else "dark" if p.y>head.y-.18 else "light",
                        sides=14,steps=8)
    if STYLE in ("eel","moray"):
        s.start("Low dorsal fin ribbon")
        for i,(a,b) in enumerate(zip(POINTS[1:],POINTS[2:]),start=1):
            p=a.lerp(b,.41)
            s.ellipsoid(p+V((0,0,RADIUS*.76)),(.024,.198,.079),segment(i),
                        lambda p,n:"light" if n.dot(LIGHT)>.55 else "dark",sides=8,steps=6)
    if many_legs():
        s.start("Segmental limbs")
        for i in range(1,len(POINTS)-2):
            for sign in (-1,1):
                a, b, c=foot_points(i,sign)
                name=f"foot.{i}.{sign}"
                s.tube([(a,.036,.038,{name+".up":1}),
                        (b,.025,.027,{name+".up":.50,name+".down":.50}),
                        (c,.011,.013,{name+".down":1})],
                       lambda p,n:"light" if n.z>.47 else "dark",sides=6)
    return s


def pose(rig,rest,clip,t):
    wave=math.tau*t
    travel=clip in ("crawl","walk","slither","swim")
    action=math.sin(math.pi*t)**2 if clip in ("action","feed","display") else 0
    rise=(.43 if STYLE=="hood" else .23 if STYLE in ("diamond","moray") else .118)*action
    p=POINTS[0]+V((.042*math.sin(wave),.065*action,rise))
    output={}
    for i,(a,b) in enumerate(zip(POINTS,POINTS[1:])):
        swing=(.31 if travel else .11)*math.sin(wave-i*.69)
        if STYLE in ("rings","cartoon"):
            swing*=.68
        pitch=-rise*(1.75 if i<2 else .74 if i<4 else .02)
        if CLASSIC_WORM_ROLLOUT:
            pulse = math.sin(wave-i*.78)
            pitch += (.31 if travel else .041)*pulse
            delta = euler(pitch,0,.47*swing)@((b-a)*(1+(.21 if travel else .029)*pulse))
        else:
            delta=euler(pitch,0,swing)@(b-a)
        end=p+delta
        key=segment(i)
        output[key]=aimed(rest[key],p,end)
        if many_legs() and 0<i<len(POINTS)-2:
            rotation=output[key].to_quaternion()@rest[key].to_quaternion().inverted()
            body=transform(rotation,a,p)
            for sign in (-1,1):
                hip,knee,toe=foot_points(i,sign)
                phase= (t+i*.082 + (0 if sign==1 else .5))%1
                advance,lift=stride(phase,0,.124,.052) if travel else (0,0)
                target=body@toe+V((0,advance,lift))
                mid=body@knee+V((0,.55*advance,.55*lift))
                base=f"foot.{i}.{sign}"
                output[base+".up"]=aimed(rest[base+".up"],body@hip,mid)
                output[base+".down"]=aimed(rest[base+".down"],mid,target)
        p=end
    return output
