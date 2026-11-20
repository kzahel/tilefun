"""Gold pond fish with a two-lobe tail, paddling fins and a moving jaw."""
import math

from wildlife_build import CatSurface, V, aimed, euler, mix, transform

NAME = "Golden Pond Fish"
VARIANT = None
ROLLOUT = False
CLASSIC_ROLLOUT = False
DURATIONS = {"idle": 48, "swim": 31, "action": 23}
PALETTE = {
    "ink": "64482c", "brown": "8a5c32", "ochre": "b7863d", "gold": "d59c45",
    "gold_light": "ebbc69", "back": "ac873e", "pale": "efd797",
    "cream_dark": "b19a68", "cream": "dbbb76", "cream_light": "f1d392",
    "fin": "b77a36", "fin_light": "dca250", "fin_dark": "795332",
    "eye": "322d28", "shine": "f8e5a8", "mouth": "774f31",
}
LIGHT = V((-.50,.23,.83)).normalized()
CENTER = V((0,.04,.41))
HEAD = V((0,.51,.43))
TAIL_ROOT = V((0,-.56,.42))
TAIL_END = V((0,-.93,.42))
JAWS = V((0,.67,.39))
FINS = {label:V((sign*.285,.19,.36)) for label,sign in (("l",1),("r",-1))}

def configure_rollout():
    global ROLLOUT, CLASSIC_ROLLOUT
    if VARIANT:
        CLASSIC_ROLLOUT = True
        PALETTE.update(eye="141414",shine="e6f0ff" if VARIANT=="fish2" else "ffffff")
        if VARIANT=="fish1":
            PALETTE.update(back="d26414",fin="ffc83c",fin_dark="935219")
        if VARIANT=="fish3":
            PALETTE.update(cream="ff8c3c",cream_dark="c64a25",fin="ffb41e",fin_light="ffdcb4")
        return
    ROLLOUT = True
    DURATIONS["flee"] = 15
    PALETTE.update(fin="c88a42", fin_dark="97602f", fin_light="e4ab56")


def configure(variant):
    global VARIANT, NAME
    VARIANT=variant
    NAME="Classic Fish " + variant[-1]
    colors={
        "fish1":("281e14","935219","d26414","f0821e","ffc83c","ce6d13","ffcd56","ffc83c","ffd28c"),
        "fish2":("293045","143282","1e46aa","3264dc","7592df","2348a3","89b9e3","729ddd","e6f0ff"),
        "fish3":("391e1b","aa2319","c64a25","d2321e","ff8c3c","a82818","ffb41e","db8c14","ffc16e"),
    }[variant]
    keys=("ink","brown","ochre","gold","gold_light","back","pale","cream","cream_light")
    PALETTE.update(dict(zip(keys,colors)))
    if variant=="fish2":
        PALETTE.update({"fin":"bb9446","fin_light":"ffdc32","fin_dark":"78572c","cream_dark":"477bc3"})
    else:
        PALETTE.update({"fin":colors[3],"fin_light":colors[4],"fin_dark":colors[1]})


def band(normal, choices):
    n=normal.dot(LIGHT)
    return choices[0] if n<-.32 else choices[1] if n<.60 else choices[2]


def joints():
    arr=[
        ("body",CENTER,CENTER+V((0,.47,0)),None),
        ("head",HEAD,HEAD+V((0,.35,0)),"body"),
        ("jaw",JAWS,JAWS+V((0,.23,0)),"head"),
        ("tail",TAIL_ROOT,TAIL_END,"body"),
        ("fan",TAIL_END,TAIL_END+V((0,-.61,0)),"tail"),
    ]
    for label, pivot in FINS.items():
        sign=1 if label=="l" else -1
        arr.append((f"fin.{label}",pivot,pivot+V((sign*.36,-.25,-.01)),"body"))
    return arr


def skin(point, normal):
    if CLASSIC_ROLLOUT:
        light = normal.dot(LIGHT)
        if VARIANT=="fish1" and .16<point.y<.34 and abs(point.x)>.15:
            return "shine" if light>-.12 else "cream"
        if VARIANT=="fish2" and point.z<.31 and abs(point.x)>.11:
            return "cream" if light>-.19 else "ochre"
        if VARIANT=="fish3" and abs(point.x)>.20 and -.40<point.y<.32:
            return "fin_light" if .17<light<.72 else "pale" if light>.34 else "ochre"
        return "brown" if light<-.44 else "gold_light" if light>.64 else "gold"
    if point.z<.28:
        colors=("cream_dark","cream","cream_light")
    elif point.z>.54:
        colors=("brown","back","gold")
    else:
        colors=("brown","gold","gold_light")
    side_bar = abs(point.x)>.155 and .26<point.z<.65 and math.cos(point.y*10+.8)>.41
    if side_bar or (point.y<-.31 and point.z>.49):
        colors=("ink","brown","ochre")
    return band(normal,colors)


def fin_color(point, normal):
    colors=("fin_dark","fin","fin_light") if point.y > -1.31 else ("fin_dark","fin","gold_light")
    return band(normal,colors)


def surface():
    s=CatSurface()
    s.start("Gold body with pale belly and ochre back")
    sections=[]
    for y,z,w,h in (
        (-.963,.415,.033,.051),(-.795,.414,.088,.095),(-.584,.419,.161,.178),
        (-.391,.426,.259,.275),(-.159,.437,.342,.346),(.096,.439,.355,.353),
        (.327,.440,.316,.318),(.531,.433,.236,.265),(.677,.414,.177,.176),
        (.802,.413,.106,.101),(.868,.414,.062,.058),
    ):
        body_factor=1.12 if VARIANT=="fish3" else .83 if VARIANT=="fish2" else 1
        if ROLLOUT:
            w *= 1.13
        ring=[V((w*body_factor*math.cos(math.tau*j/18),y,z+h*body_factor*math.sin(math.tau*j/18)))
              for j in range(18)]
        weights={"body":1}
        if y<-.55:
            alpha=mix(.3,1,min(1,(-y-.55)/.41))
            weights={"body":1-alpha,"tail":alpha}
        elif y>.31:
            alpha=mix(.35,1,min(1,(y-.31)/.51))
            weights={"body":1-alpha,"head":alpha}
        sections.append((ring,weights))
    s.rings(sections,skin)
    s.start("Round mouth and lower lip")
    s.ellipsoid(V((0,.862,.423)),(.084,.043,.038),"head",
                lambda p,n:"mouth" if n.y>.26 else "ochre",sides=10,steps=6)
    s.ellipsoid(V((0,.864,.385)),(.088,.037,.031),"jaw",
                lambda p,n:band(n,("cream_dark","cream","gold_light")),sides=10,steps=5)
    for label,sign in (("l",1),("r",-1)):
        s.start("Eye and gill " + label)
        eye_y = .563 if CLASSIC_ROLLOUT and VARIANT=="fish2" else .611
        eye_x = .164 if CLASSIC_ROLLOUT and VARIANT=="fish2" else .218
        s.ellipsoid(V((sign*eye_x,eye_y,.537)),(.070,.086,.072),"head",
                    lambda p,n:"shine" if n.z>.71 and n.y>.17 else "eye",sides=12,steps=6)
        for i in range(2):
            s.ellipsoid(V((sign*(.296+.009*i),.377-.035*i,.382+.027*i)),
                       (.009,.041,.097),"head",
                       lambda p,n:"ochre" if n.z>.33 else "brown",sides=8,steps=4)
        s.start("Splayed pectoral fin " + label)
        pivot=FINS[label]
        if ROLLOUT:
            pectoral = [(.15,-.102,.043,.094,.091),(.37,-.182,.071,.080,.082),
                        (.57,-.252,.072,.025,.028)]
        else:
            pectoral = [(.15,-.102,-.016,.073,.127),(.30,-.182,-.054,.053,.118),
                        (.45,-.252,-.056,.024,.046)]
        if CLASSIC_ROLLOUT:
            pectoral = [(x*.68,y,z*.68,width*.90,height*.58) for x,y,z,width,height in pectoral]
        fin = {f"fin.{label}":1}
        s.tube([(pivot,.044,.041,fin), *[
            (pivot+V((sign*x,y,z)),width,height,fin)
            for x,y,z,width,height in pectoral
        ]],fin_color,sides=8)
    s.start("Dorsal sail and anal fin")
    s.tube([
        (V((0,.17,.69)),.044,.071,{"body":1}),
        (V((0,-.05,.747 if CLASSIC_ROLLOUT else .825)),.053,.111,{"body":1}),
        (V((0,-.26,.746 if CLASSIC_ROLLOUT else .846)),.035,.091,{"body":1}),
        (V((0,-.452,.697)),.022,.033,{"body":1}),
    ],fin_color,sides=8)
    s.tube([
        (V((0,-.10,.21)),.051,.042,{"body":1}),
        (V((0,-.29,.128)),.056,.061,{"body":1}),
        (V((0,-.51,.120)),.037,.052,{"body":1}),
        (V((0,-.66,.178)),.017,.031,{"body":1}),
    ],fin_color,sides=8)
    s.start("Forked fan tail")
    splay = 2.7 if ROLLOUT else 1.65 if CLASSIC_ROLLOUT else 1
    for sign in (-1,1):
        fan_sections = [
            (TAIL_END+V((0,.024,0)),.052,.063,{"tail":.46,"fan":.54}),
            (TAIL_END+V((sign*.032*splay,-.156,sign*.076)),.071,.127,{"fan":1}),
            (TAIL_END+V((sign*.073*splay,-.335,sign*.170)),.063,.145,{"fan":1}),
            (TAIL_END+V((sign*.111*splay,-.535,sign*.256)),.049,.115,{"fan":1}),
            (TAIL_END+V((sign*.127*splay,-.671,sign*.289)),.023,.047,{"fan":1}),
        ]
        if CLASSIC_ROLLOUT:
            fan_sections = [
                (TAIL_END+V((delta.x*.81,delta.y*.68,delta.z*.58)),w*.81,h*.69,weights)
                for p,w,h,weights in fan_sections for delta in (p-TAIL_END,)
            ]
        s.tube(fan_sections,fin_color,sides=9)
    return s


def pose(rig,rest,clip,t):
    wave=math.tau*t
    travel=clip=="swim"
    nibble=math.sin(math.pi*t)**2 if clip=="action" else 0
    flee=clip=="flee"
    surge=math.sin(wave)+.22*math.sin(2*wave-.6) if flee else math.sin(wave)
    amplitude=.23 if flee else .14 if travel else .04
    bite=math.sin(wave*2)**2*nibble if ROLLOUT else nibble
    q=euler(.035*math.sin(wave)-(.22*nibble if ROLLOUT else 0),
            (.16 if flee else .095)*surge,amplitude*math.sin(wave+.6))
    root=transform(q,CENTER,CENTER+V(((.067 if flee else .034)*surge,.043*nibble,
                                      .036*math.cos(wave))))
    output={"body":root@rest["body"]}
    hq=q@euler(.038*math.sin(wave)-.15*nibble,0,-.61*amplitude*math.sin(wave))
    head=transform(hq,HEAD,root@HEAD)
    output["head"]=head@rest["head"]
    output["jaw"]=transform(hq@euler(-(.66 if ROLLOUT else .42)*bite),JAWS,head@JAWS)@rest["jaw"]
    a=root@TAIL_ROOT
    bend=euler(.045*math.sin(wave),0,(.60 if flee else .47 if travel else .19)*math.sin(wave-.48))
    b=a+q@(bend@(TAIL_END-TAIL_ROOT))
    output["tail"]=aimed(rest["tail"],a,b)
    end=b+q@(euler(.036*math.sin(wave),.09*math.cos(wave),(.73 if flee else .49 if travel else .26)*math.sin(wave-1.08))@V((0,-.61,0)))
    output["fan"]=aimed(rest["fan"],b,end)
    for label,pivot in FINS.items():
        sign=1 if label=="l" else -1
        f=math.sin(wave+(0 if sign==1 else math.pi/3))
        name=f"fin.{label}"
        output[name]=transform(q@euler(sign*f*.18,sign*f*(.10 if flee else .29),
                                        sign*(.51+.09*f if flee else f*.21)),
                               pivot,root@pivot)@rest[name]
    return output
