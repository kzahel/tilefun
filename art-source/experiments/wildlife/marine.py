"""Sprite-guided swimmers with matched body profiles, snouts, flippers and tails."""
import math

from wildlife_build import CatSurface, V, aimed, euler, mix, transform

# Name, torso length/width/height, pectoral fin reach, tail span, features and paint.
# Palette slots are shadow, back, light, flank, belly, marking, eye and tip.
PROFILES = {
    "blue-whale": ("Blue Whale", (2.15,.50,.48),.48,.69,"whale",
                   "374955 516b78 81949b 687e8b a8b1aa c2c8b7 293944 5a7988"),
    "humpback-whale": ("Humpback Whale",(1.96,.49,.51),.94,.73,"humpback",
                       "293943 485b65 74858b 647884 c8c6ab e0debd 202d37 9faeaa"),
    "dolphin": ("Dolphin",(1.57,.35,.35),.45,.54,"dolphin",
                "344751 607981 8d9b92 7b8f92 c8c7a9 b2bcb1 253942 5a707a"),
    "dugong": ("Dugong",(1.65,.49,.39),.45,.52,"dugong",
               "4d514a 7b7e69 9f9c80 898a72 bfb9a0 d2cbb0 313832 696c5e"),
    "manatee": ("West Indian Manatee",(1.51,.55,.42),.43,.62,"manatee",
                "494f48 726f5e 9e977c 8b8472 c1b498 d5cab1 35382e 857d69"),
    "orca": ("Orca",(1.88,.49,.41),.53,.61,"orca",
             "1d2d33 273a42 465a5a 3b4c4c f1ead0 f1ead0 131e22 2a3d44"),
    "narwhal": ("Narwhal",(1.65,.42,.37),.41,.57,"narwhal",
                "394951 65777a a3a999 8e9a95 c6c7ab c8bd8e 2b3b41 e0d4ac"),
    "shark": ("Shark",(1.71,.39,.35),.54,.66,"shark",
              "35464e 627980 879793 7a8e91 c6c9b1 a6b9ab 1e3037 526770"),
    "hammerhead-shark": ("Hammerhead Shark",(1.61,.37,.34),.54,.64,"hammer",
                         "32474d 697e7d 8f9b95 7c9290 c5c8ac c1c7ad 213239 4b686c"),
    "whale-shark": ("Whale Shark",(2.01,.57,.45),.58,.71,"spotted",
                    "31464f 4b6771 758e90 6e8587 bdbe9f cccab0 253138 526e77"),
    "swordfish": ("Swordfish",(1.74,.35,.37),.40,.63,"sword",
                  "263b4a 4e6c82 7c9299 6e8a98 b9c4b3 c8c3a0 263744 596e81"),
    "anglerfish": ("Anglerfish",(1.15,.46,.48),.29,.44,"angler",
                   "303b35 625d4a 8d8164 7b745d b2a27b d3bd77 2b3028 6f694f"),
    "ocean-sunfish": ("Ocean Sunfish",(1.01,.34,.64),.28,.39,"sunfish",
                      "4a5553 7d8982 a6a99a 929d91 c4c7b1 b9c6b9 303c3b 6b7474"),
    "pufferfish": ("Pufferfish",(1.01,.48,.46),.27,.27,"puffer",
                   "6e5a3f 9d8056 cab383 b8a172 e0cc91 b5a075 514332 c29c61"),
    "harbor-seal": ("Harbor Seal",(1.50,.43,.39),.46,.44,"seal",
                    "484b43 786f59 9d9072 93876c c2b390 b6a789 36382d 777361"),
    "sea-lion": ("California Sea Lion",(1.57,.39,.39),.51,.47,"lion",
                 "463931 75604a a08662 8b7254 b6a17c d0b381 372e27 745a47"),
    "walrus": ("Walrus",(1.62,.54,.47),.46,.48,"walrus",
               "544338 8d6c51 b08d67 a18161 ccaa7d d5c7a5 3e342e e5d6ac"),
}
SIDES = (("l",1),("r",-1))
LIGHT = V((-.48,.26,.83)).normalized()
NAME = PALETTE = DURATIONS = STYLE = None
ROLLOUT = False
HUNTER_STYLES = ("dolphin", "orca", "narwhal", "sword", "shark", "hammer", "angler")
SHARK_STYLES = ("shark", "hammer", "spotted")
BODY = HEAD = JAW = TAIL = FLUKE = None
LENGTH = WIDTH = HEIGHT = FIN_LEN = TAIL_SPAN = None
FLIPPERS = None


def configure(variant):
    global NAME, PALETTE, DURATIONS, STYLE, LENGTH, WIDTH, HEIGHT, FIN_LEN, TAIL_SPAN
    NAME,(LENGTH,WIDTH,HEIGHT),FIN_LEN,TAIL_SPAN,STYLE,colors=PROFILES[variant]
    PALETTE=dict(zip(("shadow","back","light","flank","belly","mark","eye","tip"),colors.split()))
    DURATIONS={"idle":48,"swim":30,"walk":31,"feed":27,"display":25,"action":24,"dive":26}
    register_joints()


def configure_rollout():
    global ROLLOUT, LENGTH, WIDTH, HEIGHT, FIN_LEN, TAIL_SPAN
    ROLLOUT = True
    proportions = {
        "whale": (1.30, 1.23, .91, 1.45, 1.36),
        "humpback": (1.27, 1.20, 1.03, 1.12, 1.34),
        "dugong": (1.22, 1.06, .86, 1.21, 1.16),
        "manatee": (1.24, 1.14, .89, 1.25, 1.22),
        "dolphin": (1.22, 1.06, .91, 1.22, 1.28),
        "orca": (1.18, 1.23, 1.04, 1.37, 1.29),
        "narwhal": (1.21, 1.07, .98, 1.14, 1.21),
        "sword": (1.02, .88, .86, 1.15, 1.24),
        "shark": (1.14, 1.12, 1.03, 2.12, 1.13),
        "hammer": (1.12, 1.04, .91, 1.78, 1.13),
        "spotted": (1.21, 1.14, .85, 1.71, 1.17),
        "angler": (.94, 1.35, 1.21, 1.59, .75),
    }
    length, width, height, pectoral, tail_span = proportions[STYLE]
    LENGTH *= length
    WIDTH *= width
    HEIGHT *= height
    FIN_LEN *= pectoral
    TAIL_SPAN *= tail_span
    if STYLE in HUNTER_STYLES:
        DURATIONS.update(swim=31, feed=19, display=19, chase=16)
    else:
        DURATIONS["flee"] = 15
    if STYLE == "narwhal":
        PALETTE.update(shadow="3e4f58", back="617481", light="91a5ae",
                       flank="798d97", belly="c4ccc5", tip="6c828d", mark="eadbb2")
    if STYLE == "dolphin":
        PALETTE.update(back="506978", flank="75929e", light="92aab2", belly="cad8d2")
    if STYLE == "sword":
        PALETTE.update(back="2b475e", flank="527b9b", belly="b9cad0", tip="6088a5")
    if STYLE == "spotted":
        PALETTE.update(back="3a5363", flank="526d7a", mark="e0dcc2", light="6f8790")
    if STYLE == "hammer":
        PALETTE.update(shadow="4b4541", back="75695e", light="9d8b77",
                       flank="938471", belly="c6baa0", tip="8d7a65")
    if STYLE == "angler":
        PALETTE.update(shadow="2d2335", back="53405a", light="856c86", flank="654c6a",
                       belly="bb9faf", mark="f5e8bd", eye="251c2d", tip="b47a9d")
    register_joints()


def register_joints():
    global BODY, HEAD, JAW, TAIL, FLUKE, FLIPPERS
    BODY=V((0,.08,HEIGHT+.22))
    head_lift=.19 if STYLE=="lion" else .05 if STYLE in ("seal","walrus") else 0
    HEAD=BODY+V((0,LENGTH*.49,head_lift))
    JAW=HEAD+V((0,LENGTH*.10,-HEIGHT*.32))
    TAIL=BODY+V((0,-LENGTH*.50,-HEIGHT*.028))
    fluke_origin = -.96 if ROLLOUT and STYLE in ("dugong","manatee","dolphin") else -.83
    FLUKE=BODY+V((0,LENGTH*fluke_origin,-HEIGHT*.18))
    FLIPPERS={
        label:BODY+V((sign * WIDTH*.79,LENGTH*.34,-HEIGHT*.42))
        for label,sign in SIDES
    }


def fishlike():
    return STYLE in ("shark","hammer","spotted","sword","angler","sunfish","puffer")


def lure_base():
    return HEAD + V((0,.06,HEIGHT*.71))


def joints():
    items=[
        ("body",BODY,BODY+V((0,.64,0)),None),
        ("head",HEAD,HEAD+V((0,.45,0)),"body"),
        ("jaw",JAW,JAW+V((0,.39,0)),"head"),
        ("tail",TAIL,FLUKE,"body"),
        ("fluke",FLUKE,FLUKE+V((0,-LENGTH*.33,0)),"tail"),
    ]
    for label,sign in SIDES:
        a=FLIPPERS[label]
        items.append((f"fin.{label}",a,a+V((sign * FIN_LEN,-FIN_LEN*.33,-FIN_LEN*.12)),"body"))
    if ROLLOUT and STYLE == "angler":
        base = lure_base()
        items.append(("lure",base,base+V((0,.39,.63)),"head"))
    return items


def paint(p,n):
    q=p-BODY
    if ROLLOUT and STYLE == "spotted" and -.82 < q.y/LENGTH < .77 and n.z > -.27:
        # Paint the mesh facets themselves, including the dorsal midline.
        arc = math.atan2(q.x/WIDTH, q.z/HEIGHT)
        row = q.y/LENGTH*5.45 + .12*math.cos(arc*2)
        along = row % 1 - .5
        across = (arc*2.75 + .15*(math.floor(row) % 2)) % 1 - .5
        if (along/.24)**2 + (across/.25)**2 < 1 or (
            math.floor(row)%3==0 and abs(along)<.065 and abs(across)<.36
        ):
            return "mark"
    base="back" if q.z>HEIGHT*.22 else "flank"
    if n.z < -.30 or q.z < -HEIGHT*.36:
        base="belly"
    if ROLLOUT and abs(q.x) > WIDTH*.48 and q.y > -LENGTH*.65:
        # Keep the light belly seam visible from the elevated game camera.
        seam = -HEIGHT*(.14 if STYLE in ("whale","humpback","dolphin","sword") else .27)
        if STYLE == "orca" and -.28 < q.y/LENGTH < .83:
            seam = -.10*HEIGHT + .21*HEIGHT*math.cos((q.y/LENGTH - .46)*math.pi)
        if q.z < seam:
            return "belly"
        if q.z < seam + HEIGHT*.16 and STYLE in ("whale","humpback"):
            return "shadow"
    if STYLE=="orca":
        eye_patch = ((q.y/LENGTH - .49)/.16)**2 + ((q.z/HEIGHT - .58)/.43)**2
        if ROLLOUT and abs(q.x) > WIDTH*.57 and eye_patch < 1:
            return "mark"
        return "belly" if base=="belly" else ("light" if n.dot(LIGHT)>.80 else "back")
    if STYLE in ("puffer","sunfish") and p.y>BODY.y+LENGTH*.60:
        return "flank"
    spotted=STYLE in ("spotted","narwhal","seal","puffer") and not (ROLLOUT and STYLE=="spotted")
    if spotted and q.z>-.21 and abs(q.x)>WIDTH*.35:
        u=(q.y*5.11+q.z*1.43)%1-.5
        v=(q.z*7.0+q.x*2.11+math.floor(q.y*5.11)*.33)%1-.5
        if u*u+v*v<(.10 if STYLE=="spotted" else .072):
            return "mark" if STYLE=="spotted" else "shadow"
    if STYLE=="humpback" and q.y>LENGTH*.16 and -.53<q.z<-HEIGHT*.20 and math.cos(q.x*37)>.39:
        return "mark"
    if STYLE=="angler" and q.y>LENGTH*.30 and -.36<q.z<.14:
        if ROLLOUT:
            return "shadow" if q.y>LENGTH*.66 else "flank"
        return "light" if n.dot(LIGHT)>.45 else "flank"
    facing=n.dot(LIGHT)
    return "shadow" if facing<-.56 and base!="belly" else "light" if facing>.61 and base=="back" else base


def surface():
    s=CatSurface()
    s.start("Species torso profile")
    body=[]
    sections = [
        (-.92,.14,.15),(-.75,.27,.23),(-.59,.45,.40),(-.42,.66,.66),(-.20,.88,.89),
        (.05,1,1),(.28,.98,.96),(.48,.89,.83),(.66,.73,.69),(.80,.49,.49),(.90,.28,.23),(.96,.09,.08),
    ]
    detailed_markings = ROLLOUT and STYLE == "spotted"
    if detailed_markings:
        sections = [
            tuple(mix(a, b, step/4) for a, b in zip(start, end))
            for start, end in zip(sections, sections[1:]) for step in range(4)
        ] + [sections[-1]]
    sides = 36 if detailed_markings else 20
    for y,rz,rx in sections:
        if ROLLOUT and y < -.40:
            narrowing = 1 - min(.37,(-y-.40)*.66)
            rz *= narrowing
            rx *= narrowing
            if STYLE in ("dugong","manatee","dolphin"):
                y -= .12 * (-y-.40)/.52
        if ROLLOUT and STYLE in ("dolphin", "sword") and y > .64:
            rz *= .79 if STYLE == "dolphin" else .57
            rx *= .87 if STYLE == "dolphin" else .67
        if ROLLOUT and STYLE == "narwhal" and .42 < y < .86:
            rz *= 1.14
            rx *= 1.14
        if ROLLOUT and STYLE in SHARK_STYLES and y > .48:
            rx *= 1.28 if STYLE == "spotted" else 1.13
            rz *= .71 if STYLE == "spotted" else .84
        if ROLLOUT and STYLE == "angler":
            if y < -.60:
                rx *= .63
                rz *= .65
            if .35 < y < .87:
                rz *= 1.13
                rx *= 1.19
        lift=.15*HEIGHT*y if y>0 and STYLE in ("lion","seal","walrus") else 0
        if STYLE in ("dugong","manatee","walrus") and y>.45:
            rx*=1.19
        center=BODY+V((0,LENGTH*y,lift))
        ring=[center+V((WIDTH*rx*math.cos(math.tau*j/sides),0,HEIGHT*rz*math.sin(math.tau*j/sides)))
              for j in range(sides)]
        if y<-.49:
            alpha=min(1,(-y-.49)*2.5+.18)
            weights={"body":1-alpha,"tail":alpha}
        elif y>.39:
            alpha=min(1,(y-.39)*1.8+.24)
            weights={"body":1-alpha,"head":alpha}
        else:
            weights={"body":1}
        body.append((ring,weights))
    s.rings(body,paint)
    s.start("Head shape, mouth and face")
    nose=HEAD+V((0,LENGTH*.18,-HEIGHT*.13))
    snout_params={
        "dolphin":(.39,.39,.17), "dugong":(.67,.29,.41), "manatee":(.72,.30,.35),
        "walrus":(.77,.31,.35), "seal":(.57,.28,.34), "lion":(.60,.28,.32),
        "hammer":(1.71,.18,.25), "sword":(.46,.43,.27), "angler":(.76,.32,.37),
    }
    rw,rd,rh=snout_params.get(STYLE,(.53,.29,.33))
    if ROLLOUT and STYLE in ("dugong","manatee"):
        nose.z -= HEIGHT * (.41 if STYLE=="dugong" else .25)
        rw *= 1.18
        rd *= .85
    if ROLLOUT and STYLE == "dolphin":
        # Stay attached at the forehead and taper to a thin beak and lower jaw.
        nose.y += LENGTH * .16
        nose.z -= HEIGHT * .21
        rw, rd, rh = .38, .31, .18
    if ROLLOUT and STYLE == "narwhal":
        rw, rd, rh = .62, .32, .46
    if ROLLOUT and STYLE == "hammer":
        rw, rd, rh = 2.28, .205, .26
        nose.y += LENGTH*.09
    if ROLLOUT and STYLE == "spotted":
        rw, rd, rh = .94, .255, .35
        nose.y += LENGTH*.105
    if ROLLOUT and STYLE == "shark":
        rw, rd, rh = .69, .30, .39
    if ROLLOUT and STYLE == "angler":
        rw, rd, rh = .92, .33, .47
    s.ellipsoid(nose,(rw*WIDTH,rd*LENGTH,rh*HEIGHT),
                "head",paint,sides=16,steps=8)
    if ROLLOUT and STYLE == "hammer":
        for sign in (-1,1):
            center = nose + V((sign*WIDTH*1.72,-.072,.004))
            s.ellipsoid(center,(WIDTH*.79,LENGTH*.148,HEIGHT*.23),"head",
                        lambda p,n:"shadow" if n.y>.22 else paint(p,n),sides=18,steps=9)
    jaw_width = .35 if ROLLOUT and STYLE=="hammer" else .80
    s.ellipsoid(nose+V((0,LENGTH*.033,-HEIGHT*.24)),(rw*WIDTH*jaw_width,rd*LENGTH*.72,rh*HEIGHT*.54),
                "jaw",lambda p,n:"belly" if n.dot(LIGHT)>.02 else "flank",sides=14,steps=7)
    if ROLLOUT and STYLE == "spotted":
        mouth = nose + V((0,rd*LENGTH*.85,-.092))
        s.ellipsoid(mouth,(rw*WIDTH*.58,.071,.051),"jaw",lambda p,n:"shadow",sides=15,steps=8)
    if ROLLOUT and STYLE in ("shark","hammer"):
        mouth = nose + V((0,rd*LENGTH*.57,-HEIGHT*.27))
        s.ellipsoid(mouth,(rw*WIDTH*jaw_width*.62,.104,.046),"head",
                    lambda p,n:"eye",sides=14,steps=7)
    if ROLLOUT and STYLE=="dugong":
        s.ellipsoid(nose+V((0,rd*LENGTH*.77,.02)),(rw*WIDTH*.66,.13,rh*HEIGHT*.72),
                    "head",lambda p,n:"shadow" if n.y>.43 else "belly",sides=14,steps=7)
    for label,sign in SIDES:
        eye_y=LENGTH*(.21 if STYLE=="hammer" else .13)
        eye=HEAD+V((sign*WIDTH*(1.68 if STYLE=="hammer" else .67),eye_y,HEIGHT*.39))
        if ROLLOUT and STYLE == "hammer":
            eye = nose + V((sign*WIDTH*2.46,-.041,.027))
        if STYLE=="orca" and not ROLLOUT:
            s.ellipsoid(eye+V((-sign*.060,-.165,.036)),(.093,.22,.116),
                        "head",lambda p,n:"mark",sides=14,steps=8)
        eye_size = 1.20 if ROLLOUT else 1
        s.ellipsoid(eye,(.058*eye_size,.065*eye_size,.065*eye_size),"head",
                    lambda p,n:"mark" if n.z>.87 and n.y>.17 else "eye",sides=10,steps=6)
        if ROLLOUT and STYLE in SHARK_STYLES:
            for row in range(4):
                y = HEAD.y - LENGTH*(.15 + row*.05)
                x = sign*WIDTH*(.90 + row*.023)
                s.ellipsoid(V((x,y,BODY.z-.064)),(.027,.021,.11),"body",
                            lambda p,n:"shadow",sides=9,steps=6)
        if STYLE=="walrus":
            tusk=nose+V((sign*WIDTH*.35,.18,-.02))
            s.tube([(tusk,.062,.061,{"head":1}),(tusk+V((0,-.021,-.28)),.047,.047,{"head":1}),
                    (tusk+V((sign*.036,-.093,-.515)),.013,.016,{"head":1})],
                   lambda p,n:"tip" if n.dot(LIGHT) > -.31 else "mark",sides=9)
        if STYLE=="lion":
            s.ellipsoid(eye+V((sign*.037,-.31,.081)),(.052,.074,.087),
                        "head",lambda p,n:"flank",sides=8,steps=5)
    if STYLE in ("narwhal","sword"):
        s.start("Tusk" if STYLE=="narwhal" else "Sword")
        p=nose+V((0,rd*LENGTH*.65,HEIGHT*.16))
        reach=.84 if STYLE=="narwhal" else .80
        if ROLLOUT:
            reach = 1.46 if STYLE=="narwhal" else 1.94
        thickness = .70 if ROLLOUT and STYLE=="sword" else 1
        s.tube([(p,.070*thickness,.067*thickness,{"head":1}),
                (p+V((0,reach*.46,.018)),.044*thickness,.039*thickness,{"head":1}),
                (p+V((0,reach,.043)),.008,.014,{"head":1})],
               lambda p,n:"mark" if ROLLOUT and STYLE=="narwhal"
               else "tip" if STYLE=="narwhal" else "back",sides=10)
    if STYLE=="angler":
        s.start("Lure")
        if ROLLOUT:
            p = lure_base()
            glow = p+V((0,.92,.51))
            s.tube([
                (p,.061,.059,{"lure":1}),
                (p+V((0,.066,.43)),.052,.057,{"lure":1}),
                (p+V((0,.31,.74)),.044,.050,{"lure":1}),
                (p+V((0,.62,.74)),.039,.044,{"lure":1}),
                (glow,.034,.033,{"lure":1}),
            ],lambda p,n:"tip" if n.z>.1 else "back",sides=10)
            s.ellipsoid(glow,(.151,.148,.129),"lure",lambda p,n:"mark",sides=12,steps=8)
            mouth = nose + V((0,.24,-.20))
            s.ellipsoid(mouth,(WIDTH*.68,.104,.127),"head",
                        lambda p,n:"eye",sides=16,steps=8)
            for side in (-1,1):
                for x,y,size in ((.22,.086,.24),(.42,.064,.19),(.60,.023,.14)):
                    root = mouth+V((side*WIDTH*x,y,.095))
                    s.tube([(root,.063,.054,{"head":1}),
                            (root+V((side*.028,.061,-size)),.010,.013,{"head":1})],
                           lambda p,n:"mark",sides=8)
                    lower = root+V((0,-.028,-.23))
                    s.tube([(lower,.048,.046,{"jaw":1}),
                            (lower+V((0,.014,.15)),.009,.009,{"jaw":1})],
                           lambda p,n:"mark",sides=8)
        else:
            p=HEAD+V((0,.04,HEIGHT*.77))
            glow=p+V((0,.48,.39))
            s.tube([(p,.034,.035,{"head":1}),(p+V((0,.23,.45)),.028,.028,{"head":1}),
                    (glow,.018,.017,{"head":1})],lambda p,n:"tip",sides=8)
            s.ellipsoid(glow,(.091,.093,.085),"head",lambda p,n:"mark",sides=10,steps=6)
    if STYLE=="puffer":
        s.start("Puffer spines")
        for row in range(3):
            for i in range(8):
                theta=i*math.tau/8+row*.23
                p=BODY+V((WIDTH*.86*math.cos(theta),-.34+row*.34,HEIGHT*.81*math.sin(theta)))
                end=p+V((.16*math.cos(theta),-.03,.15*math.sin(theta)))
                s.tube([(p,.056,.055,{"body":1}),(end,.011,.010,{"body":1})],
                       lambda p,n:"tip",sides=6)
    s.start("Dorsal fin")
    if STYLE in ("orca","dolphin","shark","hammer","sword","spotted","humpback","sunfish"):
        start=BODY+V((0,-LENGTH*.21,HEIGHT*.76))
        reach=.13 if ROLLOUT and STYLE=="humpback" else .64 if STYLE=="orca" else .44 if fishlike() else .32
        if ROLLOUT and STYLE in ("sword","orca"):
            reach = .70 if STYLE=="sword" else .78
        if ROLLOUT and STYLE in ("shark", "hammer"):
            reach = .65 if STYLE=="shark" else .54
        s.tube([
            (start,.099,LENGTH*.23,{"body":1}),
            (start+V((0,-.09,reach*.36)),.079,LENGTH*.16,{"body":1}),
            (start+V((0,-.24,reach*.79)),.043,LENGTH*.083,{"body":1}),
            (start+V((0,-.36,reach)),.017,.027,{"body":1}),
        ],lambda p,n:"tip" if n.dot(LIGHT)>.32 else "back",sides=10)
    for label,sign in SIDES:
        s.start("Pectoral fin " + label)
        pivot=FLIPPERS[label]
        bone=f"fin.{label}"
        sections = [
            (pivot,.094,.127,{bone:1}),
            (pivot+V((sign*FIN_LEN*.37,-.12,-.02)),.113,.174,{bone:1}),
            (pivot+V((sign*FIN_LEN*.78,-.23,-.064)),.077,.141,{bone:1}),
            (pivot+V((sign*FIN_LEN,-.35,-.102)),.022,.031,{bone:1}),
        ]
        if ROLLOUT and STYLE in SHARK_STYLES:
            sections = [
                (pivot,.226,.092,{bone:1}),
                (pivot+V((sign*FIN_LEN*.37,-.19,-.02)),.302,.074,{bone:1}),
                (pivot+V((sign*FIN_LEN*.78,-.36,-.035)),.140,.044,{bone:1}),
                (pivot+V((sign*FIN_LEN,-.55,-.06)),.022,.031,{bone:1}),
            ]
        s.tube(sections,lambda p,n:"belly" if STYLE=="humpback" and n.z>-.27 else "tip" if n.dot(LIGHT)>.32 else "back",
           sides=10)
        if ROLLOUT and STYLE=="manatee":
            continue
        s.start("Tail lobe " + label)
        axis=V((0,0,sign)) if fishlike() else V((sign,0,0))
        span=TAIL_SPAN*(.73 if STYLE in ("shark","hammer","spotted") and sign<0 else 1)
        fat = .70 if ROLLOUT and STYLE in ("dolphin","orca") else .46 if ROLLOUT and not fishlike() else .84 if ROLLOUT else 1
        sweep = .40 if ROLLOUT and STYLE=="orca" else 1
        s.tube([
            (FLUKE,.087*fat,.14,{"tail":.57,"fluke":.43}),
            (FLUKE+axis*span*.31+V((0,-LENGTH*.135*sweep,0)),.092*fat,.175,{"fluke":1}),
            (FLUKE+axis*span*.69+V((0,-LENGTH*.212*sweep,0)),.066*fat,.146,{"fluke":1}),
            (FLUKE+axis*span+V((0,-LENGTH*.292*sweep,0)),.022*fat,.031,{"fluke":1}),
        ],lambda p,n:"tip" if n.dot(LIGHT)>.30 else "back",sides=10)
    if ROLLOUT and STYLE=="manatee":
        s.start("Continuous rounded horizontal paddle")
        s.ellipsoid(FLUKE+V((0,-LENGTH*.14,.005)),(TAIL_SPAN*.83,LENGTH*.22,.086),
                    "fluke",lambda p,n:"tip" if n.z>.34 else "back",sides=22,steps=10)
    return s


def hunter_pose(rest, clip, t):
    """The fast pursuit is a separate stroke. Feeding and display have their own poses."""
    phase = math.tau * t
    beat = math.sin(phase)
    chase = clip == "chase"
    feeding = clip == "feed"
    warning = math.sin(math.pi * t)**2 if clip == "display" else 0
    feeding_bite = math.sin(phase)**4 if feeding else 0
    travelling = clip == "swim" or chase
    thrust, warn_pitch, warn_yaw, warn_jaw = {
        "dolphin": (.43, .26, .18, .35),
        "orca": (.36, .24, .10, .56),
        "narwhal": (.29, .14, .33, .24),
        "sword": (.47, .06, .41, .23),
        "shark": (.47, .13, .20, .58),
        "hammer": (.42, .11, .47, .38),
        "angler": (.32, .26, .24, .68),
    }[STYLE]
    surge = beat + .31 * math.sin(2 * phase - .7) if chase else beat
    pitch = 0 if fishlike() else (.15 * surge - .08 if chase else .044 * beat)
    pitch += warn_pitch * warning - .10 * feeding_bite
    yaw = (.12 * surge if chase else .07 * beat) if fishlike() and travelling else 0
    yaw += warn_yaw * warning * math.sin(phase)
    bank = .16 * warning if STYLE == "orca" else .10 * warning * math.sin(phase)
    q = euler(pitch, bank, yaw)
    rise = .07 * surge if chase else .028 * math.cos(phase)
    body = transform(q, BODY, BODY + V((0, .068 * feeding_bite, rise)))
    output = {"body": body @ rest["body"]}
    headq = q @ euler(-.23 * feeding_bite + .11 * warning, 0, .10 * warning * math.sin(phase))
    head = transform(headq, HEAD, body @ HEAD)
    output["head"] = head @ rest["head"]
    bite_size = .76 if STYLE == "angler" else .61 if STYLE in ("orca","shark") else .46
    gape = bite_size * feeding_bite + warn_jaw * warning
    output["jaw"] = transform(headq @ euler(-gape), JAW, head @ JAW) @ rest["jaw"]
    if STYLE == "angler":
        base = lure_base()
        nod = -.25*feeding_bite + .26*warning + (.21 if chase else .098)*math.sin(phase-.62)
        lure = headq @ euler(nod,0,.13*math.sin(phase-.89))
        output["lure"] = transform(lure,base,head @ base) @ rest["lure"]

    def flex(angle):
        return euler(0, 0, angle) if fishlike() else euler(angle)

    stroke = thrust if chase else .20 if travelling else .055
    stock_angle = stroke * math.sin(phase - .44) + warning * (.20 if fishlike() else .14)
    if chase:
        stock_angle += .11 * math.sin(2 * phase - .92)
    flap = stroke * 1.51 * math.sin(phase - 1.05) - .14 * warning
    anchor = body @ TAIL
    tip = anchor + q @ (flex(stock_angle) @ (FLUKE - TAIL))
    tail_end = tip + q @ (flex(flap) @ V((0, -LENGTH * .33, 0)))
    output["tail"] = aimed(rest["tail"], anchor, tip)
    output["fluke"] = aimed(rest["fluke"], tip, tail_end)
    for label, sign in SIDES:
        name = f"fin.{label}"
        pivot = FLIPPERS[label]
        sweep = -.22 if chase else .22 * warning
        kick = .10 * math.sin(phase + sign * .68)
        fin = q @ euler(kick, sign * (.21 * warning + .12 * beat), sign * (sweep + kick))
        output[name] = transform(fin, pivot, body @ pivot) @ rest[name]
    return output


def pose(rig,rest,clip,t):
    if ROLLOUT and STYLE in HUNTER_STYLES:
        return hunter_pose(rest, clip, t)
    wave=math.tau*t
    swim,walk=clip=="swim",clip=="walk"
    flee=clip=="flee"
    display = math.sin(math.pi*t)**2 if ROLLOUT and clip=="action" else 0
    mode_pitch, bow, flick = {
        "whale": (.31, .06, .26), "humpback": (.22, .10, .31),
        "dugong": (-.30, -.24, .13), "manatee": (-.18, -.16, .26),
        "spotted": (.18, .12, .21),
    }.get(STYLE,(0,0,0))
    greeting=math.sin(math.pi*t)**2 if clip in ("feed","display","action") else 0
    dive=math.sin(math.pi*t)**2 if clip=="dive" else 0
    pitch=.055*math.sin(wave)*int(swim)+.067*math.cos(wave)*int(walk)-.32*dive
    pitch += .16*math.sin(wave+.15)*int(flee)+mode_pitch*display
    q=euler(pitch,.069*math.sin(wave)*int(swim)+.10*display*math.sin(wave),
            .076*math.sin(wave)*int(fishlike() and swim))
    body=transform(q,BODY,BODY+V((0,.056*greeting,.047*math.cos(wave))))
    output={"body":body@rest["body"]}
    headq=q@euler((-.16 if clip=="feed" else .15)*greeting+bow*display,
                  0,.081*math.sin(wave)*(clip=="idle"))
    h=transform(headq,HEAD,body@HEAD)
    output["head"]=h@rest["head"]
    output["jaw"]=transform(headq@euler(-.32*greeting),JAW,h@JAW)@rest["jaw"]
    amplitude=.53 if flee else .37 if swim else .20 if walk else .087
    a=body@TAIL
    tailangle=amplitude*math.sin(wave-.36)+.10*math.sin(wave*2-.6)*int(flee)+flick*display
    bend=euler(0,0,tailangle) if fishlike() else euler(tailangle)
    b=a+q@(bend@(FLUKE-TAIL))
    output["tail"]=aimed(rest["tail"],a,b)
    drift=amplitude*1.37*math.sin(wave-.93)+flick*display if ROLLOUT else amplitude*1.50*math.sin(wave-.93)
    flutter=euler(0,0,drift) if fishlike() else euler(drift)
    end=b+q@(flutter@V((0,-LENGTH*.33,0)))
    output["fluke"]=aimed(rest["fluke"],b,end)
    for label,sign in SIDES:
        name=f"fin.{label}"
        pivot=FLIPPERS[label]
        beat=math.sin(wave+(math.pi if walk and sign<0 else 0))
        f=euler(.12*beat,sign*(.31*beat if swim else .23*beat*walk),
                sign*(.53+.070*beat if flee else .19*beat if swim else .55*beat*walk)+sign*display*.32)
        output[name]=transform(q@f,pivot,body@pivot)@rest[name]
    return output
