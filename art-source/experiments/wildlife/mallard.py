"""Fresh drake with a folded blue speculum, webbed feet and articulated wings."""
import math
from wildlife_build import CatSurface, V, aimed, euler, mix, smooth, stride, transform

NAME = "Mallard Drake"
DURATIONS = {"idle": 48, "waddle": 31, "swim": 31, "flap": 31, "action": 23, "flight": 19}
PALETTE = {
    "ink": "253034", "tail_light": "45524f", "grey_deep": "444d48",
    "grey": "7b8177", "grey_light": "a3a795", "feather": "c7c8af",
    "white": "f5f1db", "ring_shadow": "ddd4b7", "chest_dark": "754a35",
    "chest": "935f45", "chest_light": "ac7952", "head_dark": "15483e",
    "head_mid": "236650", "head_light": "438465", "head_hi": "68a777",
    "bill_dark": "ad7627", "bill": "daaa41", "bill_light": "e8c365",
    "toe_dark": "b96634", "toe": "db8f40", "toe_light": "e2a052",
    "spec_deep": "334565", "spec": "485977", "eye": "15232a", "shine": "f4e6bb",
}
LIGHT = V((-.49, .26, .83)).normalized()
BODY = V((0, -.12, .66))
HEAD = V((0, .69, 1.14))
BILL = HEAD + V((0,.21,-.075))
TAIL = V((0,-.94,.73))
WINGS = {}
FEET = {}
for label, sign in (("l",1),("r",-1)):
    WINGS[label] = [V((sign*x,y,z)) for x,y,z in ((.30,.33,.87),(.54,-.22,.90),(.31,-1.05,.84))]
    FEET[label] = V((sign*.276,-.018,.105))


def bands(normal, choices):
    shade = normal.dot(LIGHT)
    return choices[0] if shade < -.28 else choices[1] if shade < .64 else choices[2]


def joints():
    entries = [
        ("body",BODY,BODY+V((0,.73,0)),None),("head",HEAD,HEAD+V((0,.46,0)),"body"),
        ("bill",BILL,BILL+V((0,.47,-.035)),"head"),
        ("tail",TAIL,TAIL+V((0,-.44,.11)),"body"),
    ]
    for label, points in WINGS.items():
        entries.extend(((f"wing.{label}",points[0],points[1],"body"),
                        (f"tip.{label}",points[1],points[2],f"wing.{label}")))
    for label, ankle in FEET.items():
        root = ankle+V((0,-.09,.39))
        entries.extend(((f"leg.{label}",root,ankle,"body"),
                        (f"foot.{label}",ankle,ankle+V((0,.30,0)),f"leg.{label}")))
    return entries


def body_color(p,n):
    if p.y>.25 and p.z<1.09 and abs(p.x)<.43:
        return bands(n,("chest_dark","chest","chest_light"))
    if p.y<-.83 and p.z>.69:
        return bands(n,("ink","grey_deep","tail_light"))
    return bands(n,("grey_deep","grey","grey_light"))


def head_color(p,n):
    if p.z < .953 and p.y < .80:
        return "ring_shadow" if n.dot(LIGHT) < -.2 else "white"
    return bands(n,("head_dark","head_mid","head_light"))


def surface():
    s=CatSurface()
    s.start("Teardrop drake and chestnut breast")
    rings=[]
    for y,z,wide,high in (
        (-1.12,.70,.07,.05),(-.99,.65,.19,.16),(-.77,.64,.34,.27),(-.49,.64,.465,.33),
        (-.18,.66,.55,.37),(.12,.69,.509,.39),(.37,.72,.417,.37),
        (.56,.77,.30,.32),(.69,.83,.19,.26),(.78,.87,.08,.14),
    ):
        ring=[V((wide*math.cos(math.tau*i/18),y,z+high*math.sin(math.tau*i/18))) for i in range(18)]
        rings.append((ring,{"body":1} if y<.56 else {"body":.82,"head":.18}))
    s.rings(rings,body_color)
    s.start("Emerald head and white neck ring")
    s.ellipsoid(HEAD+V((0,-.073,-.12)),(.231,.238,.242),"head",head_color,sides=16,steps=9)
    s.ellipsoid(HEAD+V((0,.036,.058)),(.281,.318,.251),"head",
                lambda p,n:bands(n,("head_dark","head_mid","head_light")),sides=18,steps=10)
    s.start("Ochre upper and hinged lower bill")
    s.ellipsoid(BILL+V((0,.240,.071)),(.185,.30,.071),"head",lambda p,n:bands(n,("bill_dark","bill","bill_light")),sides=12,steps=7)
    s.ellipsoid(BILL+V((0,.237,.009)),(.165,.272,.036),"bill",lambda p,n:bands(n,("bill_dark","bill","bill")),sides=12,steps=7)
    for side,sign in (("l",1),("r",-1)):
        s.ellipsoid(HEAD+V((sign*.228,.159,.104)),(.054,.060,.061),"head",
                    lambda p,n:"shine" if n.z > .77 and n.x*sign > .32 else "eye",sides=10,steps=6)
        s.ellipsoid(BILL+V((sign*.10,.145,.133)),(.019,.028,.008),"head",
                    lambda p,n:"bill_dark",sides=8,steps=4)
        s.start("Layered wing feathers " + side)
        a,b,c=WINGS[side]
        upper,tip="wing."+side,"tip."+side
        s.tube([
            (a,.135,.091,{upper:1}),(a.lerp(b,.34),.231,.102,{upper:1}),
            (a.lerp(b,.81),.235,.100,{upper:.86,tip:.14}),
            (b.lerp(c,.22),.200,.089,{upper:.20,tip:.80}),
            (b.lerp(c,.54),.168,.064,{tip:1}),(b.lerp(c,.81),.126,.054,{tip:1}),
            (c,.028,.031,{tip:1}),
        ],lambda p,n:bands(n,("grey_deep","grey","grey_light")) if p.y>-.34
            else bands(n,("ink","spec_deep","spec")) if p.y>-.77 and n.z>-.25
            else ("ink" if p.y<-.84 else bands(n,("ink","grey_deep","tail_light"))),sides=10)
        # Three pale feather ends make the flank marking read when folded.
        for i in range(3):
            dx=sign*(i-.8)*.043
            y=-.66-i*.093
            s.ellipsoid(V((sign*.44+dx,y,.861-i*.018)),(.048,.18,.035),tip,
                        lambda p,n:"feather" if n.z > .14 else "grey_deep",sides=8,steps=4)
        s.start("Webbed foot " + side)
        ankle=FEET[side]
        s.tube([
            (ankle+V((0,-.09,.39)),.064,.061,{f"leg.{side}":1}),
            (ankle+V((0,-.06,.25)),.052,.055,{f"leg.{side}":1}),
            (ankle,.046,.051,{f"leg.{side}":.59,f"foot.{side}":.41}),
        ],lambda p,n:bands(n,("toe_dark","toe","toe_light")),sides=8)
        s.ellipsoid(ankle+V((0,.112,-.059)),(.146,.213,.047),f"foot.{side}",
                    lambda p,n:bands(n,("toe_dark","toe","toe_light")),sides=12,steps=5)
        for toe in (-1,0,1):
            s.ellipsoid(ankle+V((toe*.069,.239-abs(toe)*.027,-.071)),
                        (.048,.094,.033),f"foot.{side}",
                        lambda p,n:bands(n,("toe_dark","toe","toe_light")),sides=8,steps=5)
    s.start("Dark short drake tail")
    for i in range(-1,2):
        tip=TAIL+V((i*.124,-.14,.092-abs(i)*.038))
        s.ellipsoid(tip,(.109,.268,.082),"tail",
                    lambda p,n: "white" if p.y< -1.24 and n.z>0 else
                    bands(n,("ink","ink","tail_light")),sides=10,steps=8)
    curl = [(.015,-.00,.105,.071),(.009,-.17,.130,.070),
            (0,-.28,.232,.056),(0,-.255,.322,.044),(0,-.178,.326,.017)]
    s.tube([(TAIL+V((x,y,z)),r,r*.72,{"tail":1}) for x,y,z,r in curl],
           lambda p,n: bands(n,("ink","ink","tail_light")),sides=9)
    return s


def pose(rig,rest,clip,t):
    wave=t*math.tau
    waddle=clip=="waddle"
    swim=clip=="swim"
    flap=clip in ("flap","flight")
    quack=math.sin(math.pi*t)**2 if clip=="action" else 0
    sway=(.064 if waddle else .013)*math.sin(wave)
    roll=(.096 if waddle else .023)*math.sin(wave)
    lift=.052*(1-math.cos(wave*2)) if waddle else .018*math.sin(wave)
    if swim:
        lift-=.12
    if flap:
        lift+=.14*math.sin(math.pi*t)
    q=euler(.035*math.sin(wave)-.07*quack,roll,0)
    body=transform(q,BODY,BODY+V((sway,.07*quack,lift)))
    output={"body":body@rest["body"]}
    hq=q@euler(.042*math.sin(wave)-.29*quack,0,.10*math.sin(wave)*(1 if clip=="idle" else .32))
    head=transform(hq,HEAD,body@HEAD+V((0,.028*math.sin(wave)+.115*quack,-.14*quack)))
    output["head"]=head@rest["head"]
    output["bill"]=transform(hq@euler(-.48*quack),BILL,head@BILL)@rest["bill"]
    output["tail"]=transform(q@euler(.10*math.sin(wave),0,.08*math.sin(wave)),TAIL,body@TAIL)@rest["tail"]
    wing_spread=1 if clip=="flight" else math.sin(math.pi*t)**.70 if flap else 0
    for label, (a,b,c) in WINGS.items():
        sign=1 if label=="l" else -1
        upper,tip=f"wing.{label}",f"tip.{label}"
        beat=math.cos(wave+.55)
        abduct=V((sign*(.94-beat*.13),-.10,.25+.65*beat)).normalized()
        distal=V((sign*(.94-beat*.18),-.29,.14+.59*beat)).normalized()
        elbow=a+(b-a).normalized().lerp(abduct,wing_spread).normalized()*(b-a).length
        end=elbow+(c-b).normalized().lerp(distal,wing_spread).normalized()*(c-b).length
        output[upper]=aimed(rest[upper],body@a,body@elbow)
        output[tip]=aimed(rest[tip],body@elbow,body@end)
        ankle=FEET[label]
        leg,foot=f"leg.{label}",f"foot.{label}"
        root=body@rest[leg].translation
        displacement=wave if label=="l" else wave+math.pi
        foot_pitch=0
        if waddle:
            forward,up=stride(t,0 if label=="l" else .5,.30,.17)
            foot_target=ankle+V((0,forward,up))
        elif swim:
            foot_target=ankle+V((0,-.21+.22*math.cos(displacement),.16+.073*math.sin(displacement)))
            foot_pitch=.49*math.sin(displacement)
        elif flap:
            foot_target=ankle+V((0,-.42*wing_spread,.29*wing_spread+lift))
            foot_pitch=.62*wing_spread
        else:
            foot_target=ankle
        output[leg]=aimed(rest[leg],root,foot_target)
        output[foot]=transform(euler(foot_pitch),V((0,0,0)),foot_target)
    return output
