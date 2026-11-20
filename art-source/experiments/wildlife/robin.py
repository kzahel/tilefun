"""Round woodland robin, with a readable rust breast and landing feet."""
import math
from wildlife_build import CatSurface, V, aimed, euler, rows, transform

NAME = "Robin"
ROLLOUT = False
DURATIONS = {"idle": 48, "hop": 23, "flap": 23, "action": 17, "eat": 29}
PALETTE = {
    "deep": "35312c", "back_dark": "4f4639", "back": "655746", "back_light": "7e7058",
    "wing_dark": "423a31", "wing": "584d3e", "feather": "79674f",
    "red_dark": "9b4c2b", "red": "c86c37", "red_light": "dc8c51",
    "belly_shadow": "a48a64", "belly": "d0b68a", "belly_light": "ead5a5",
    "beak": "69503a", "beak_tip": "3f382f", "eye": "261f1d", "shine": "f6dbad",
    "leg": "9c7859", "toe": "bc9869",
}
LIGHT = V((-.50,.25,.84)).normalized()
BODY = V((0,-.10,.55))
HEAD = V((0,.43,.88))
TAIL = V((0,-.57,.56))
WINGS = {
    label: [V((sign*x,y,z)) for x,y,z in ((.203,.23,.74),(.36,-.16,.67),(.15,-.74,.55))]
    for label, sign in (("l",1),("r",-1))
}
LEGS = {label: V((sign*.113,.02,.100)) for label,sign in (("l",1),("r",-1))}

def configure_rollout():
    global ROLLOUT
    ROLLOUT = True
    PALETTE.update(deep="322825", red="cf7035", red_light="e19549", beak_tip="262025",
                   back="4b3f36", back_light="655345")


def band(normal, choices):
    shade = normal.dot(LIGHT)
    return choices[0] if shade < -.28 else choices[1] if shade < .57 else choices[2]


def joints():
    result = [
        ("body",BODY,BODY+V((0,.41,0)),None),
        ("head",HEAD,HEAD+V((0,.31,0)),"body"),
        ("tail",TAIL,TAIL+V((0,-.53,.13)),"body"),
    ]
    for label,(a,b,c) in WINGS.items():
        result.extend(((f"wing.{label}",a,b,"body"),
                       (f"tip.{label}",b,c,f"wing.{label}")))
    for label, ankle in LEGS.items():
        hip = ankle+V((0,-.09,.32))
        result.extend(((f"leg.{label}",hip,ankle,"body"),
                       (f"foot.{label}",ankle,ankle+V((0,.18,0)),f"leg.{label}")))
    return result


def body_paint(point, normal):
    red = (point.y > .14 and point.z > .32 and normal.y > -.14) if ROLLOUT else (
        point.y>-.005 and point.z>.35 and point.z<.98 and abs(point.x)<.28+max(0, point.y)*.14)
    if red:
        return band(normal,("red_dark","red","red_light"))
    if point.z<.54 or (point.y>.20 and point.z<.67):
        return band(normal,("belly_shadow","belly","belly_light"))
    return band(normal,("back_dark","back","back_light"))


def head_paint(point, normal):
    stripe=(point.z < HEAD.z+.11 and point.y>HEAD.y-.015
            and abs(point.x)<.256 and normal.y>-.37)
    if ROLLOUT:
        stripe = point.y > HEAD.y+.075 and point.z < HEAD.z+.132 and normal.y > .19
    return band(normal,("red_dark","red","red_light") if stripe else ("back_dark","back","back_light"))


def surface():
    s = CatSurface()
    s.start("Round body and russet bib")
    rings=[]
    for y,z,w,h in [
        (-.79,.54,.053,.07),(-.67,.54,.161,.142),(-.52,.545,.259,.244),
        (-.28,.561,.315,.294),(-.03,.59,.316,.310),(.19,.61,.287,.307),
        (.40,.66,.230,.271),(.54,.70,.140,.202),(.61,.71,.060,.104),
    ]:
        ring=[V((w*math.cos(math.tau*i/16),y,z+h*math.sin(math.tau*i/16)))
              for i in range(16)]
        rings.append((ring,{"body":1} if y<.38 else {"body":.83,"head":.17}))
    s.rings(rings,body_paint)
    s.start("Rust face and short pointed bill")
    s.ellipsoid(HEAD,(.244,.265,.243),"head",head_paint,sides=16,steps=10)
    s.tube([
        (HEAD+V((0,.207,-.023)),.079,.061,{"head":1}),
        (HEAD+V((0,.295,-.042)),.047,.035,{"head":1}),
        (HEAD+V((0,.432 if ROLLOUT else .395,-.066)),.007,.011,{"head":1}),
    ],lambda p,n:"beak_tip" if p.y>HEAD.y+(.24 if ROLLOUT else .29) or n.z < -.19 else "beak",sides=8)
    for sign in (-1,1):
        s.ellipsoid(HEAD+V((sign*.188,.150,.058)),(.062,.059,.060),"head",
                    lambda p,n:"shine" if n.z>.74 and n.y>.21 else "eye",sides=10,steps=6)
    for side,(a,b,c) in WINGS.items():
        s.start("Pointed wing " + side)
        wing,tip=f"wing.{side}",f"tip.{side}"
        fan = 1.45 if ROLLOUT else 1
        s.tube([
            (a,.099,.070,{wing:1}),
            (a.lerp(b,.43),.182*fan,.083,{wing:1}),
            (a.lerp(b,.86),.199*fan,.089,{wing:.78,tip:.22}),
            (b.lerp(c,.27),.176*fan,.071,{wing:.22,tip:.78}),
            (b.lerp(c,.58),.140*fan,.060,{tip:1}),
            (b.lerp(c,.79),.106,.047,{tip:1}),(c,.038,.026,{tip:1}),
        ],lambda p,n:band(n,("wing_dark","wing","feather")) if p.y>-.57 else
           band(n,("deep","wing_dark","wing")),sides=10)
        ankle=LEGS[side]
        s.start("Perching toes " + side)
        s.tube([
            (ankle+V((0,-.09,.32)),.033,.029,{f"leg.{side}":1}),
            (ankle+V((0,-.03,.16)),.027,.025,{f"leg.{side}":1}),
            (ankle,.026,.028,{f"leg.{side}":.61,f"foot.{side}":.39}),
        ],lambda p,n:"toe" if n.dot(LIGHT)>.44 else "leg",sides=7)
        for toe in (-1,0,1):
            s.tube([
                (ankle+V((toe*.021,.008,-.026)),.025,.026,{f"foot.{side}":1}),
                (ankle+V((toe*.061,.105,-.056)),.019,.021,{f"foot.{side}":1}),
                (ankle+V((toe*.072,.166-abs(toe)*.035,-.070)),.010,.013,{f"foot.{side}":1}),
            ],lambda p,n:"toe" if n.z>.15 else "leg",sides=6)
    s.start("Narrow fan tail")
    for i in range(-1,2):
        s.ellipsoid(TAIL+V((i*(.107 if ROLLOUT else .083),-.263,.096-abs(i)*.016)),
                    (.104 if ROLLOUT else .074,.329-.044*abs(i),.068 if ROLLOUT else .048),"tail",
                    lambda p,n:band(n,("deep","wing_dark","feather")),sides=10,steps=6)
    return s


HOP=[(0,0,0,0),(.16,-.073,-.035,-.14),(.32,.017,.044,.14),
     (.50,.097,.034,.12),(.68,.071,.021,-.07),(.84,-.06,.034,-.12),(1,0,0,0)]
DIP=[(0,0),(.20,.07),(.42,1),(.56,.28),(.70,.74),(.85,.19),(1,0)]


def pose(rig,rest,clip,t):
    wave = math.tau*t
    hopping, flying = clip=="hop", clip=="flap"
    peck=rows(DIP,t)[0] if clip=="eat" else .45*math.sin(math.pi*t)**2 if clip=="action" else 0
    trill=.19*math.sin(math.pi*t)**2 if ROLLOUT and clip=="action" else 0
    if ROLLOUT and clip=="action":
        peck=0
    rise,forward,pitch=rows(HOP,t) if hopping else (.012*math.sin(wave),.045*peck,-.12*peck)
    if flying:
        rise+=.057*math.sin(wave)
    bodyq=euler(pitch,0,.049*math.sin(wave)*(clip=="idle"))
    body=transform(bodyq,BODY,BODY+V((0,forward,rise)))
    output={"body":body@rest["body"]}
    hq=bodyq@euler(-(.96 if ROLLOUT else .85)*peck-.35*pitch+trill,0,.15*math.sin(wave)*(clip=="idle")+trill*math.sin(2*wave))
    h=transform(hq,HEAD,body@HEAD+V((0,.15*peck,-(.45 if ROLLOUT else .34)*peck)))
    output["head"]=h@rest["head"]
    output["tail"]=transform(bodyq@euler(.2*math.sin(wave)*(hopping or flying)-.16*peck),TAIL,body@TAIL)@rest["tail"]
    for label,(a,b,c) in WINGS.items():
        sign=1 if label=="l" else -1
        wing,tip=f"wing.{label}",f"tip.{label}"
        if flying:
            beat=math.cos(wave)
            sweep = .28 + .24 * math.sin(wave) if ROLLOUT else .26
            mid = a+V((sign*.85,-sweep,.38*beat)).normalized()*(b-a).length
            end = mid+V((sign*.85,-.48,.60*beat)).normalized()*(c-b).length
        else:
            mid,end=b,c
        output[wing]=aimed(rest[wing],body@a,body@mid)
        output[tip]=aimed(rest[tip],body@mid,body@end)
    for label, ankle in LEGS.items():
        leg,foot=f"leg.{label}",f"foot.{label}"
        hip=body@rest[leg].translation
        advance=.16*math.sin(math.pi*t)**2 if hopping else -.21 if flying else 0
        lift=.14*math.sin(math.pi*t)**2 if hopping else .29 if flying else 0
        target=ankle+V((0,advance,lift))
        output[leg]=aimed(rest[leg],hip,target)
        output[foot]=transform(euler(.44*lift),V((0,0,0)),target)
    return output
