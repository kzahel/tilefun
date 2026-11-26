"""Fresh avian models with species-specific proportions, plumage and bills."""
import math
from wildlife_build import CatSurface, V, aimed, euler, mix, stride, transform

# Label, body width/depth/height, head radius, leg and neck height,
# bill length/shape, wing reach, tail reach, distinctive features, palette.
# Palette slots: ink, mantle, mantle light, breast, mask, bill, feet, accent.
PROFILES = {
    "atlantic-puffin": ("Atlantic Puffin",(.37,.53,.44),.24,.23,.07,.31,"puffin",.82,.19,"face",
                        "18252c 293941 415260 eee8cf e6e1cf df8c40 c8783c c34c3b"),
    "eagle": ("Bald Eagle",(.38,.59,.40),.23,.33,.16,.20,"hook",1.27,.38,"white-head",
              "283034 594c40 8e7960 75624d e6e2cc dcb448 b38c37 ebe5ce"),
    "blue-footed-booby": ("Blue-footed Booby",(.33,.56,.37),.20,.30,.17,.38,"spear",1.09,.31,"white-head",
                          "23323a 5e574c 8b7f67 e2e4d5 f0ead7 b6a378 67abc1 c5bca0"),
    "chicken": ("Buff Hen",(.48,.56,.46),.19,.30,.14,.17,"cone",.68,.33,"comb",
                "473526 916537 c49a5a e6cb91 c49a5a d6a642 d6a642 b94331"),
    "crow": ("Carrion Crow",(.34,.59,.40),.215,.30,.11,.27,"cone",1.03,.45,"plain",
             "151c20 30373a 485154 2b3235 374246 293236 333839 5b6264"),
    "cassowary": ("Cassowary",(.44,.60,.47),.18,.68,.59,.21,"cone",.46,.22,"casque",
                  "232d32 2e383c 485257 363e42 477d9b 66736b 827763 ad554c"),
    "dove": ("Dove",(.37,.54,.37),.19,.22,.10,.16,"cone",.88,.40,"plain",
             "494338 c7bd9e e8dfbf e1d4ae e8dfbf d9a247 b14e3d f1e6cc"),
    "emu": ("Emu",(.44,.66,.49),.18,.71,.58,.23,"cone",.46,.27,"plain",
            "35352f 7b6c57 a08c6e 8e7b60 6d7068 b3a276 8a8572 c2ad74"),
    "flamingo": ("Flamingo",(.34,.60,.37),.171,1.05,.76,.34,"bend",1.02,.30,"pink",
                 "552e37 b96d62 eabdb0 d7a4a0 efc8b8 1f2b32 be847c 8d5554"),
    "great-blue-heron": ("Great Blue Heron",(.34,.58,.39),.18,.77,.59,.42,"spear",1.16,.26,"crest",
                         "1f2b32 6c7a80 7a929d a3b5b5 cfd1b9 c9aa66 85795d 263945"),
    "great-frigatebird": ("Great Frigatebird",(.33,.54,.36),.20,.21,.12,.29,"hook",1.49,.70,"throat",
                          "192b30 29363c 53656a 303a40 33454b 647378 61695d bc5345"),
    "great-hornbill": ("Great Hornbill",(.36,.56,.38),.22,.28,.18,.54,"horn",1.24,.46,"wing-band",
                       "252c2b 303c40 65716e e6d8b2 e6d8b2 d9a247 8c8b63 f0d17a"),
    "kakapo": ("Kakapo",(.47,.53,.46),.24,.24,.10,.19,"hook",.65,.29,"mottle",
               "35422b 71824b a3ad65 9fa565 c8be87 c2ad74 8d8f61 515c3c"),
    "kiwi": ("Kiwi",(.38,.58,.38),.17,.29,.14,.43,"spear",.36,.12,"plain",
             "42372d 8a7154 b19a74 9b805a 907957 c2ad74 797760 635c49"),
    "marabou-stork": ("Marabou Stork",(.42,.68,.44),.21,.76,.62,.43,"spear",1.17,.29,"throat",
                      "1f2b32 465156 6c7b7a d4d2b8 b28e7e c1a874 8e8270 b96d62"),
    "ostrich": ("Ostrich",(.48,.67,.51),.18,.87,.79,.25,"cone",.74,.33,"wing-band",
                "232d32 30383b 515a5c e7e0ca bb9b87 c2ad74 ac967d e7e0ca"),
    "parrot": ("Parrot",(.34,.52,.37),.225,.24,.12,.20,"hook",.92,.48,"parrot",
               "252c2b 4b965c 84bf66 b14e3d c75b45 d9a247 828763 c75b45"),
    "peacock": ("Peacock",(.36,.54,.37),.175,.35,.38,.17,"cone",.72,1.12,"fan",
                "26393a 66834f 829962 3d6c7e 477d9b c2ad74 77765d bca76c"),
    "pelican": ("Pelican",(.46,.64,.46),.22,.29,.25,.56,"pouch",1.27,.25,"wing-band",
                "23323a aaa996 e4e2cc efead4 efead4 d6bd7e a78653 454b4a"),
    "penguin": ("Penguin",(.36,.40,.55),.23,.16,.17,.23,"cone",.64,.20,"tuxedo",
                "1e302f 2b3939 475555 dedbd0 475555 d7bb6b 9d855b a6afa6"),
    "raven": ("Raven",(.39,.64,.44),.235,.30,.14,.31,"cone",1.16,.55,"plain",
              "141b25 26333d 43515b 25313d 344452 23303a 485251 536373"),
    "hawk": ("Red-tailed Hawk",(.35,.56,.38),.20,.29,.15,.18,"hook",1.18,.44,"red-tail",
             "27302f 7c6049 ac8b62 ddc89c 9c7954 d4ad51 b29752 b75c3b"),
    "pigeon": ("Rock Pigeon",(.35,.54,.42),.20,.23,.15,.15,"cone",.89,.37,"neck",
               "252c2b 717c83 a0a8aa 8b9397 616e73 595c59 b14e3d 8c6b92"),
    "ruby-throated-hummingbird": ("Ruby-throated Hummingbird",(.27,.51,.32),.185,.17,.078,.44,"spear",1.10,.40,"throat",
                                  "192b30 437b58 78a176 c7cdb3 53635a 23323a 46594d be5c56"),
    "secretary-bird": ("Secretary Bird",(.35,.60,.40),.18,.84,.40,.20,"hook",1.00,.53,"crest",
                       "1f2b32 737f77 b4bcb1 d6d5bd d6d5bd d6a071 b96d62 303b37"),
    "shoebill": ("Shoebill",(.41,.61,.44),.21,.74,.44,.48,"shoe",.93,.29,"plain",
                 "1f2b32 7b8882 afb9ad 899796 afb9ad a6a174 667a6c 56655f"),
    "sparrow": ("Sparrow",(.33,.49,.36),.21,.22,.08,.13,"cone",.82,.34,"mottle",
                "252c2b 72533b 8b6e49 d4c3a0 bca37a d9a247 8c7453 a88c68"),
    "owl": ("Tawny Owl",(.41,.49,.47),.29,.21,.06,.14,"hook",1.16,.31,"disk",
            "242a2b 806148 ae8e63 cbb389 ede0b8 ab9260 8d7852 967851"),
    "toucan": ("Toucan",(.33,.55,.37),.225,.24,.125,.54,"horn",.91,.45,"white-neck",
               "252c2b 303b3f 5d696a e5d4a3 e5d4a3 d9a247 767b60 bf8240"),
    "wild-turkey": ("Wild Turkey",(.51,.59,.49),.174,.35,.29,.17,"cone",.73,.76,"fan",
                    "342922 6f4b39 9b7150 a97958 a07168 a8845c 895f48 bb8a65"),
    "classic-chicken": ("Classic Chicken",(.39,.47,.42),.21,.20,.17,.14,"cone",.62,.34,"comb",
                         "795b58 c49a6c e8cfa6 f3f2c0 f2e8be d4c169 b88966 c58086"),
    "classic-pigeon": ("Classic Pigeon",(.35,.48,.39),.17,.20,.13,.14,"cone",.81,.31,"neck",
                        "3a3a50 7d7f99 b1bac8 9da3b7 868aa1 ad9b78 77778e 565972"),
    "classic-pigeon2": ("Classic Pigeon 2",(.34,.52,.37),.18,.21,.13,.14,"cone",.84,.34,"neck",
                         "38394b 646982 9da3b7 a1a8bc 7d7f99 ad9b78 77778e 50576f"),
    "classic-crow": ("Classic Crow",(.32,.58,.33),.19,.22,.12,.29,"cone",.98,.51,"plain",
                      "3a3a50 46465e 6c6e85 565972 777891 3a3a50 575b73 8b8bab"),
    "classic-seagull": ("Classic Seagull",(.34,.53,.35),.18,.23,.14,.23,"cone",1.15,.37,"wing-band",
                         "3a3a50 c6bdd5 d8d0e0 ebe4f2 ebe4f2 c9ad72 aa9488 565972"),
}
SIDES = (("l",1),("r",-1))
LIGHT = V((-.46,.22,.86)).normalized()
NAME = PALETTE = DURATIONS = None
BODY = HEAD = TAIL = None
WINGS = FEET = None
BODY_RADII = BEAK_LEN = BEAK_STYLE = HEAD_R = STYLE = TAIL_LEN = None
HEN_ROLLOUT = False
CLASSIC_BIRD_ROLLOUT = False
FLIGHT_ROLLOUT = None
GROUND_ROLLOUT = None

# Wing reach in the cruise and escape strokes, peck depth and escape pitch.
FLIGHT_POSES = {
    "atlantic-puffin": (.88, 1.0, .42, .23),
    "blue-footed-booby": (.97, 1.0, .52, .16),
    "crow": (.96, 1.0, .58, .19),
    "dove": (.88, 1.0, .68, .18),
    "great-frigatebird": (1.0, 1.0, -.37, .13),
    "great-hornbill": (.96, 1.0, .51, .13),
    "pelican": (.96, 1.0, .57, .16),
    "sparrow": (.79, .94, .86, .22),
    "toucan": (.89, 1.0, .51, .17),
    "pigeon": (.94, 1.0, .75, .18),
    "raven": (.96, 1.0, .53, .18),
    "ruby-throated-hummingbird": (.92, 1.0, .43, .21),
    "parrot": (.85, .98, .53, .15),
}
# Ground birds use a stronger escape stride and an individual neck gesture.
# Values are normal stride reach, running reach, head reach, drop and pitch.
GROUND_POSES = {
    "cassowary": (.37, .58, .72, .71, .46),
    "emu": (.39, .68, .65, 1.01, .72),
    "flamingo": (.46, .72, .76, 1.37, .86),
    "great-blue-heron": (.43, .63, .81, 1.01, .43),
    "kakapo": (.25, .36, .21, .25, .51),
    "kiwi": (.20, .33, .22, .22, .61),
    "marabou-stork": (.54, .77, .72, 1.16, .60),
    "ostrich": (.49, .85, .60, 1.23, .80),
    "peacock": (.33, .53, .18, .28, .44),
    "shoebill": (.50, .71, .65, .88, .63),
    "wild-turkey": (.42, .61, .10, .045, -.11),
}
WORK_ACTIONS = {
    "crow": {"pickup": 19, "build": 19},
    "raven": {"pickup": 20, "bury": 30},
    "ruby-throated-hummingbird": {"sip": 15, "guard": 15},
    "peacock": {"open": 29, "display": 48, "close": 29},
}


def configure(variant):
    global NAME, PALETTE, DURATIONS, BODY, HEAD, TAIL, WINGS, FEET
    global BODY_RADII, BEAK_LEN, BEAK_STYLE, HEAD_R, STYLE, TAIL_LEN
    NAME,BODY_RADII,HEAD_R,leg,neck,BEAK_LEN,BEAK_STYLE,wing,TAIL_LEN,STYLE,colors=PROFILES[variant]
    slots=("ink","mantle","light","breast","mask","bill","feet","accent")
    PALETTE=dict(zip(slots,colors.split()))
    DURATIONS={name:frames for name,frames in (
        ("idle",48),("walk",30),("fly",18),("swim",26),("action",23),("feed",25),
        ("display",28),("sleep",42),("pickup",21),("sip",28),("scratch",24),("open",27),("close",27),
    )}
    w,d,h = BODY_RADII
    BODY = V((0,-.11,max(.40,leg+h*.60)))
    HEAD = BODY + V((0,d*.61 + min(.12,neck*.16),h*.41 + neck))
    TAIL = BODY + V((0,-d*.74,h*.16))
    WINGS = {
        label: [BODY + V((sign*w*.68,d*.48,.15)),
                BODY + V((sign*w,.02-d*.26,.114)),
                BODY + V((sign*w*.71,-d*.72-wing*.26,.078))]
        for label,sign in SIDES
    }
    FEET = {label:V((sign*w*.53,d*.055,.085)) for label,sign in SIDES}


def configure_rollout():
    global HEN_ROLLOUT, CLASSIC_BIRD_ROLLOUT, DURATIONS
    if NAME.startswith("Classic "):
        CLASSIC_BIRD_ROLLOUT = True
        DURATIONS.update({"walk":28,"fly":23})
        if NAME.startswith("Classic Pigeon"):
            PALETTE.update(bill="c18452",feet="c18452",accent="76689e")
        elif NAME=="Classic Seagull":
            PALETTE.update(bill="b36e3f",feet="b36e3f",ink="3a3a50")
        return
    assert NAME=="Buff Hen"
    HEN_ROLLOUT = True
    DURATIONS = {"idle":48,"walk":32,"action":23,"flee":19,"scratch":36,"peck":20,"eat":26}


def configure_flight_rollout(variant):
    global FLIGHT_ROLLOUT, DURATIONS
    configure(variant)
    FLIGHT_ROLLOUT = FLIGHT_POSES[variant]
    DURATIONS = {"idle":48,"fly":19,"action":19,"flee":10}
    DURATIONS.update(WORK_ACTIONS.get(variant, {}))


def configure_ground_rollout(variant):
    global GROUND_ROLLOUT, DURATIONS
    configure(variant)
    GROUND_ROLLOUT = GROUND_POSES[variant]
    DURATIONS = {"idle":48,"walk":23 if variant=="kiwi" else 31,"action":19,"flee":12 if variant=="kiwi" else 15}
    DURATIONS.update(WORK_ACTIONS.get(variant, {}))


def joints():
    entries=[
        ("body",BODY,BODY+V((0,.49,0)),None),
        ("head",HEAD,HEAD+V((0,.31,0)),"body"),
        ("tail",TAIL,TAIL+V((0,-max(.17,TAIL_LEN),.10)),"body"),
    ]
    for label,(a,b,c) in WINGS.items():
        entries.extend(((f"wing.{label}",a,b,"body"),
                        (f"tip.{label}",b,c,f"wing.{label}")))
    for label, ankle in FEET.items():
        hip=V((ankle.x,ankle.y-.098,BODY.z-.19))
        knee=hip.lerp(ankle,.58)+V((0,-.13,0))
        leg,lower,foot=f"leg.{label}",f"lower.{label}",f"foot.{label}"
        entries.extend(((leg,hip,knee,"body"),(lower,knee,ankle,leg),
                        (foot,ankle,ankle+V((0,.21,0)),lower)))
    return entries


def shade(n, main, dark="ink", bright="light"):
    shade_amount=n.dot(LIGHT)
    return dark if shade_amount < -.36 else bright if shade_amount > .66 else main


def body_paint(p,n):
    w,d,h=BODY_RADII
    q=p-BODY
    if CLASSIC_BIRD_ROLLOUT and NAME=="Classic Chicken":
        return "breast" if n.dot(LIGHT)>-.29 else "light"
    if (STYLE in ("throat","neck") and q.y>d*.50 and q.z>0 and abs(q.x)<w*.82):
        return "accent"
    if STYLE in ("face","tuxedo","white-neck") and q.y>d*.04 and q.z<h*.51:
        return "breast" if n.dot(LIGHT) > -.44 else "mantle"
    if STYLE in ("fan","parrot") and q.y>d*.30:
        return "accent" if STYLE=="parrot" else "breast"
    if STYLE=="mottle" and q.z>-.05 and math.cos(q.y*19+abs(q.x)*14)>.54:
        return "accent"
    if q.z<-.08 or (q.y > d*.16 and q.z < .15):
        return shade(n,"breast","mantle","breast")
    return shade(n,"mantle")


def head_paint(p,n):
    q=p-HEAD
    if STYLE in ("white-head","casque","crest","fan","pink"):
        return "mask" if n.dot(LIGHT)>-.36 else "mantle"
    if STYLE in ("face","disk","white-neck") and q.y>-.031:
        return "mask" if n.dot(LIGHT)>-.44 else "breast"
    if STYLE in ("parrot","comb") and q.y>-.09:
        return "mask" if n.dot(LIGHT)>-.37 else "mantle"
    if STYLE=="mottle" and q.y > HEAD_R*.28:
        return "mask"
    return shade(n,"mantle")


def surface():
    s=CatSurface()
    s.start("Species body and plumage")
    w,d,h=BODY_RADII
    s.ellipsoid(BODY,BODY_RADII,"body",body_paint,sides=18,steps=12)
    s.start("Neck, face and eye patches")
    neckbase=BODY+V((0,d*.41,h*.42))
    approach=neckbase.lerp(HEAD,.50)+V((0,-.12*(HEAD.z-BODY.z),.045))
    neck=[(neckbase,w*.58,h*.56,{"body":.84,"head":.16}),
          (approach,max(.093,HEAD_R*.53),max(.095,HEAD_R*.54),{"body":.44,"head":.56}),
          (HEAD+V((0,-.048,-HEAD_R*.20)),HEAD_R*.79,HEAD_R*.74,{"head":1})]
    s.tube(neck,head_paint if STYLE in ("casque","pink","fan","white-head") else body_paint,sides=14)
    head_width=HEAD_R*1.16 if STYLE in ("face","disk") else HEAD_R*.99
    s.ellipsoid(HEAD,(head_width,HEAD_R*1.12,HEAD_R),"head",head_paint,sides=16,steps=10)
    for sign in (-1,1):
        eye=HEAD+V((head_width*.79*sign,HEAD_R*.65,HEAD_R*.21))
        if STYLE=="disk":
            s.ellipsoid(eye,(HEAD_R*.31,HEAD_R*.26,HEAD_R*.43),"head",
                        lambda p,n:"breast" if n.dot(LIGHT)>.33 else "mantle",sides=10,steps=7)
        offset = V((sign*(.012 if HEN_ROLLOUT else .031),.026,.013))
        s.ellipsoid(eye+offset,(HEAD_R*.26,HEAD_R*.21,HEAD_R*.25),"head",
                    lambda p,n:"mask" if n.z>.83 and n.y>.21 else "ink",sides=10,steps=6)
    s.start("Sculpted bill")
    start=HEAD+V((0,HEAD_R*.76,-HEAD_R*.14))
    profiles={
        "cone":((0,0,.44,.38),(.49,-.025,.30,.23),(1,-.06,.05,.05)),
        "hook":((0,0,.57,.48),(.46,.01,.42,.43),(.86,-.17,.21,.34),(1,-.32,.07,.12)),
        "spear":((0,0,.39,.36),(.42,-.024,.25,.18),(.83,-.05,.12,.10),(1,-.067,.023,.027)),
        "puffin":((0,0,.60,.48),(.49,-.02,.55,.57),(.81,-.18,.38,.48),(1,-.29,.12,.21)),
        "bend":((0,0,.52,.41),(.39,-.08,.44,.36),(.76,-.30,.303,.29),(1,-.49,.12,.15)),
        "horn":((0,0,.58,.73),(.41,.074,.59,.64),(.77,-.035,.40,.49),(1,-.25,.13,.11)),
        "shoe":((0,0,.70,.63),(.44,-.06,.69,.56),(.80,-.08,.53,.45),(1,-.15,.21,.18)),
        "pouch":((0,0,.50,.46),(.49,-.12,.51,.64),(.88,-.20,.246,.25),(1,-.23,.12,.15)),
    }
    bill=[(start+V((0,forward*BEAK_LEN,vertical*BEAK_LEN)),HEAD_R*rx,HEAD_R*rz,{"head":1})
          for forward,vertical,rx,rz in profiles[BEAK_STYLE]]
    s.tube(bill,lambda p,n:"ink" if p.y > start.y+BEAK_LEN*.78 and BEAK_STYLE in ("bend","horn")
           else "accent" if BEAK_STYLE=="puffin" and p.y>start.y+BEAK_LEN*.37 else "bill",sides=10)
    if STYLE in ("comb","casque","crest","fan"):
        s.start("Crown or crest")
        for i in range(3):
            height=(.16 if STYLE=="casque" else .12) - i*.028
            crest = HEAD + V((0,-HEAD_R*(.20+i*.23),HEAD_R+height*.45))
            s.ellipsoid(crest,(HEAD_R*.21,.071,height),"head",
                        lambda p,n:"accent" if STYLE!="casque" else "bill",sides=8,steps=6)
    if CLASSIC_BIRD_ROLLOUT and NAME=="Classic Chicken":
        s.start("Warm cheek")
        for sign in (-1,1):
            s.ellipsoid(HEAD+V((sign*.129,.104,-.067)),(.051,.044,.055),"head",
                        lambda p,n:"accent" if n.z>-.39 else "light",sides=9,steps=5)
    if HEN_ROLLOUT:
        s.start("Wattle")
        for sign in (-1,1):
            s.ellipsoid(HEAD+V((sign*.059,.109,-.154)),(.055,.072,.099),"head",
                        lambda p,n:"accent",sides=11,steps=8)
    if STYLE=="throat":
        s.start("Colorful throat patch")
        s.ellipsoid(HEAD+V((0,.042,-HEAD_R*.82)),(HEAD_R*.82,.174,.153),"head",
                    lambda p,n:"accent",sides=12,steps=7)
    for label,(a,b,c) in WINGS.items():
        s.start("Layered wing " + label)
        wing,tip=f"wing.{label}",f"tip.{label}"
        span=d*.34
        s.tube([
            (a,span*.51,.057,{wing:1}),(a.lerp(b,.47),span,.068,{wing:1}),
            (a.lerp(b,.85),span*1.14,.062,{wing:.77,tip:.23}),
            (b.lerp(c,.21),span*.96,.060,{wing:.19,tip:.81}),
            (b.lerp(c,.59),span*.78,.046,{tip:1}),
            (b.lerp(c,.84),span*.56,.034,{tip:1}),(c,.026,.017,{tip:1}),
        ],lambda p,n: "ink" if CLASSIC_BIRD_ROLLOUT and STYLE=="neck" and
           -.68*d < p.y-BODY.y < -.48*d else
           "breast" if STYLE=="wing-band" and BODY.y-d*.68 < p.y < BODY.y-d*.36 else
           shade(n,"mantle") if p.y>BODY.y-d*.42 else shade(n,"ink","ink","mantle"),
           sides=10)
    for label,ankle in FEET.items():
        s.start("Leg and toes "+label)
        hip=V((ankle.x,ankle.y-.098,BODY.z-.19))
        knee=hip.lerp(ankle,.58)+V((0,-.13,0))
        upper,lower,foot=f"leg.{label}",f"lower.{label}",f"foot.{label}"
        radius=.057 if BODY.z>.84 else .043
        s.tube([(hip,radius*1.53,radius*1.37,{upper:1}),
                (hip.lerp(knee,.69),radius,radius,{upper:1}),
                (knee,radius*.91,radius*.86,{upper:.5,lower:.5}),
                (knee.lerp(ankle,.62),radius*.76,radius*.72,{lower:1}),
                (ankle,radius*.75,radius*.75,{lower:.52,foot:.48})],
               lambda p,n:"feet" if n.dot(LIGHT)>-.28 else "mantle",sides=8)
        for i in range(-1,2):
            s.tube([(ankle+V((i*.022,.01,-.021)),.035,.025,{foot:1}),
                    (ankle+V((i*.063,.107,-.051)),.025,.020,{foot:1}),
                    (ankle+V((i*.079,.219-abs(i)*.046,-.064)),.011,.013,{foot:1})],
                   lambda p,n:"feet",sides=6)
    s.start("Tail feather fan")
    count=7 if STYLE=="fan" else 5 if STYLE=="wing-band" else 3
    for i in range(count):
        spread=(i-(count-1)/2)/max(1,(count-1)/2)
        x=spread*w*(.91 if STYLE=="fan" else .46)
        y=-TAIL_LEN*(.66+.24*(1-abs(spread)))
        z=.26 if HEN_ROLLOUT else .14 if STYLE=="fan" else .064
        start=TAIL+V((x*.26,-.032,0))
        end=TAIL+V((x,y,z))
        feather_width=w*(.34 if STYLE=="fan" else .26)
        s.tube([(start,.043,.041,{"tail":1}),(start.lerp(end,.49),feather_width,.043,{"tail":1}),
                (start.lerp(end,.86),feather_width*.70,.039,{"tail":1}),(end,.022,.014,{"tail":1})],
               lambda p,n:"accent" if STYLE in ("red-tail","fan") and p.y<TAIL.y-TAIL_LEN*.58 else shade(n,"mantle"),
               sides=8)
    return s


def pose(rig,rest,clip,t):
    wave=math.tau*t
    escape=FLIGHT_ROLLOUT is not None and clip=="flee"
    running=GROUND_ROLLOUT is not None and clip=="flee"
    hummingbird = FLIGHT_ROLLOUT is not None and NAME=="Ruby-throated Hummingbird"
    hovering = hummingbird and clip in ("sip", "guard")
    flying,swim,walk=clip=="fly" or escape or hovering,clip=="swim",clip=="walk" or running
    head_dip=(math.sin(math.pi*t)**2)*(.80 if clip=="feed" else .73 if clip in ("pickup","sip") else
              .34 if clip=="action" else .29 if clip=="sleep" else 0)
    if HEN_ROLLOUT:
        walk = walk or clip=="flee"
        dip = math.sin(math.pi*t)**2
        if clip=="peck":
            head_dip = 1.13*dip**1.1
        elif clip=="eat":
            head_dip = dip*(.87+.19*math.sin(3*wave))
        elif clip=="scratch":
            head_dip = .19*dip+.083*math.sin(2*wave)
        elif walk:
            head_dip = .12*math.sin(2*wave)
    if FLIGHT_ROLLOUT is not None and clip=="action":
        peck = math.sin(math.pi*t)**2
        head_dip = FLIGHT_ROLLOUT[2]*peck*(.70+.30*math.cos(2*wave))
    if GROUND_ROLLOUT is not None and clip=="action":
        head_dip = 0
    if clip in ("build", "bury"):
        strength = .67 if clip=="build" else 1.02
        head_dip = strength * math.sin(math.pi*t)**2 * (.77+.23*math.cos(2*wave))
    display = math.sin(math.pi*t)**.75 if clip=="display" else t if clip=="open" else 1-t if clip=="close" else 0
    if "fan.0" in rest:
        if clip=="display":
            display = 1
        else:
            display = display**2 * (3-2*display)
    if GROUND_ROLLOUT is not None and NAME=="Wild Turkey" and clip=="action":
        display = math.sin(math.pi*t)**1.25
    trunkq=euler(-.17*head_dip+.045*math.sin(wave)*(walk or flying),
                 .067*math.sin(wave)*walk,0)
    shift=V((.027*math.sin(wave)*walk,.042*head_dip,
             .019*math.sin(wave)+.035*math.sin(wave*2)*walk-.13*swim))
    if CLASSIC_BIRD_ROLLOUT and flying:
        shift.z += .056+.033*math.cos(wave)
    if FLIGHT_ROLLOUT is not None and flying:
        trunkq = euler((-.035 if not escape else -FLIGHT_ROLLOUT[3]) + .08*math.sin(wave))
        shift.z = (.022 if not escape else .043)*math.sin(wave)
    if running:
        trunkq = euler(-.14 + .055*math.sin(2*wave), .075*math.sin(wave))
        shift.z += .028 + .047*math.sin(2*wave)
    body=transform(trunkq,BODY,BODY+shift)
    result={"body":body@rest["body"]}
    headq=trunkq@euler(-.78*head_dip+.075*display,0,.085*math.sin(wave)*(clip=="idle"))
    head_position=body@HEAD+V((0,.22*head_dip,-(HEAD.z-BODY.z+.28)*head_dip*.66))
    if GROUND_ROLLOUT is not None:
        _, _, reach, drop, pitch = GROUND_ROLLOUT
        if clip=="action":
            gesture = math.sin(math.pi*t)**2
            headq = trunkq@euler(-pitch*gesture)
            head_position += V((0, reach*gesture, -drop*gesture))
        elif walk:
            nod = math.sin(2*wave)
            headq = trunkq@euler(.055*nod)
            head_position += V((0,.11+.045*nod,-.12)) if running else V((0,.03*nod,.021*nod))
    if clip in ("build", "bury"):
        headq = headq@euler(0, 0, .20*head_dip*math.sin(wave))
    if hovering:
        reach = math.sin(math.pi*t)**2
        if clip=="sip":
            headq = trunkq@euler(-.29*reach)
            head_position = body@HEAD+V((0,.14*reach,-.085*reach))
        else:
            headq = trunkq@euler(.18*reach, .08*math.sin(wave), .28*math.sin(wave))
            head_position = body@HEAD+V((0,-.05*reach,.07*reach))
    head=transform(headq,HEAD,head_position)
    result["head"]=head@rest["head"]
    if "jaw" in rest:
        hinge = rest["jaw"].translation
        gape = (math.sin(math.pi*t)**4)*(.34 if NAME=="Pelican" else .26) if clip=="action" else 0
        result["jaw"]=transform(headq@euler(-gape),hinge,head@hinge)@rest["jaw"]
    tail_pitch=-display*(1.37 if "fan.0" in rest else 1.17 if STYLE=="fan" else .28)+.062*math.sin(wave)
    if FLIGHT_ROLLOUT is not None:
        tail_pitch += -.32*head_dip + (.22+.10*math.sin(wave) if escape else 0)
    if hovering:
        tail_pitch += -.12 if clip=="sip" else .25*math.sin(math.pi*t)**2
    tail=transform(trunkq@euler(tail_pitch),TAIL,body@TAIL)
    result["tail"]=tail@rest["tail"]
    if "fan.0" in rest:
        spread = display * (.86 if clip=="close" else 1)
        for index in range(7):
            feather = f"fan.{index}"
            pivot = rest[feather].translation
            splay = (index-3) * .29 * spread
            sway = .035 * display * math.sin(wave+index*.64)
            result[feather] = tail@transform(euler(sway,0,splay),pivot,pivot)@rest[feather]
    for label,(a,b,c) in WINGS.items():
        sign=1 if label=="l" else -1
        wing,tip=f"wing.{label}",f"tip.{label}"
        beat=math.cos(wave*(3 if "Hummingbird" in NAME else 1))
        beat_span=.35 if STYLE in ("wing-band","tuxedo") else .48
        spread=1 if flying else .45*display
        if CLASSIC_BIRD_ROLLOUT and flying:
            spread=.55 if NAME=="Classic Seagull" else .49
            beat_span=.28
        if FLIGHT_ROLLOUT is not None and flying:
            # Fold through the recovery and open both wings at mid-stroke.
            cruise, burst, _, _ = FLIGHT_ROLLOUT
            opening = math.sin(math.pi*t)**2
            spread = .26+(cruise-.26)*opening
            if escape:
                spread = .36+(burst-.36)*opening**.57
            beat = math.sin(wave*(4 if hummingbird else 1))
            beat_span = .65 if escape else .50
            if hovering:
                spread = .69 if clip=="sip" else .96
                beat_span = .59
            if NAME=="Great Frigatebird":
                spread = .29+(.71*opening**(.42 if escape else .65))
                beat_span *= .84
        if swim and STYLE=="tuxedo":
            spread=.73
            beat_span=.23
        d1=(b-a).normalized().lerp(V((sign*.86,-.25,.22+beat*beat_span)).normalized(),spread).normalized()
        d2=(c-b).normalized().lerp(V((sign*.90,-.43,.13+beat*beat_span)).normalized(),spread).normalized()
        mid=a+d1*(b-a).length
        end=mid+d2*(c-b).length
        result[wing]=aimed(rest[wing],body@a,body@mid)
        result[tip]=aimed(rest[tip],body@mid,body@end)
    for label, ankle in FEET.items():
        phase=0 if label=="l" else .5
        upper,lower,foot=f"leg.{label}",f"lower.{label}",f"foot.{label}"
        if walk:
            forward,lift=stride(t,phase,.22+min(.24,BODY.z*.15),.125+min(.10,BODY.z*.05))
            if GROUND_ROLLOUT is not None:
                reach = GROUND_ROLLOUT[1 if running else 0]
                forward,lift=stride(t,phase,reach,reach*(.49 if running else .42))
            if HEN_ROLLOUT and clip=="flee":
                forward,lift=stride(t,phase,.341,.191)
        elif flying or swim:
            forward,lift=(-.29,.35) if escape else (-.18,.28)
        elif clip in ("scratch", "bury") and label=="l":
            forward,lift=(-.29*math.sin(math.pi*t)**2,.14*math.sin(math.pi*t))
            if HEN_ROLLOUT:
                rake=(.50-.50*math.cos(wave*2))*math.sin(math.pi*t)
                forward,lift=(-.31*rake,.148*math.sin(math.pi*t)*(1-.57*rake))
        else:
            forward,lift=(0,0)
        hip=body@rest[upper].translation
        knee=body@rest[lower].translation + V((0,.43*forward,.44*lift))
        target=ankle+V((0,forward,lift))
        result[upper]=aimed(rest[upper],hip,knee)
        result[lower]=aimed(rest[lower],knee,target)
        result[foot]=transform(euler(.73*lift),V((0,0,0)),target)
    return result
