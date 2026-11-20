"""Pose a broad puffer and a tall sunfish from their distinct sprite silhouettes."""
import math

from mathutils import Matrix
from wildlife_build import CatSurface, V, euler, transform

SIDES = (("L", -1), ("R", 1))
LIGHT = V((-.43,.38,.83)).normalized()
DURATIONS = {"idle": 48, "swim": 31, "action": 19, "flee": 15}
NAME = PALETTE = BODY = BONES = None
ANIMATES_SCALE = False


def configure(variant):
    global NAME, PALETTE, BODY, BONES, ANIMATES_SCALE
    ANIMATES_SCALE = variant == "pufferfish"
    if ANIMATES_SCALE:
        NAME = "Pufferfish"
        colors = "4d4228 77663b a99053 c3ad68 e0c989 ece0aa 614c2b 30261c"
        BODY = V((0,0,.65))
        BONES = {
            "tail": (V((0,-.56,.65)),V((0,-1.15,.66))),
            "dorsal": (V((0,-.29,1.14)),V((0,-.54,1.45))),
        }
        fin_x, fin_z = .608, .631
    else:
        NAME = "Ocean Sunfish"
        colors = "455b5d 627c7c 789494 91a9a3 b8c5b6 dcdbbb 607470 273938"
        BODY = V((0,0,.89))
        BONES = {
            "tail": (V((0,-.59,.89)),V((0,-.96,.89))),
            "dorsal": (V((0,-.16,1.41)),V((0,-.33,2.12))),
            "anal": (V((0,-.17,.43)),V((0,-.34,.018))),
        }
        fin_x, fin_z = .244, .83
    for side, sign in SIDES:
        BONES["side."+side] = (V((sign*fin_x,.22,fin_z)),
                               V((sign*(fin_x+.24),-.03,fin_z-.10)))
    PALETTE = dict(zip(("dark","shadow","coat","light","belly","cream","mask","eye"),
                       colors.split()))


def joints():
    return [("body",BODY,BODY+V((0,.48,0)),None)] + [
        (name,pivot,tip,"body") for name,(pivot,tip) in BONES.items()
    ]


def skin(p, n):
    z = p.z-BODY.z
    if ANIMATES_SCALE:
        if p.y > .42 and (abs(p.x) < .36 or z < -.18):
            return "cream" if z < .13 else "light"
        if z < -.16:
            return "belly"
        u = (p.x*4.6+p.z*3.8) % 1-.5
        v = (p.y*4.8+math.floor(p.x*4.6)*.22) % 1-.5
        if u*u+v*v < .056:
            return "shadow"
    elif z < -.25 or n.z < -.48:
        return "cream" if n.z > -.55 else "belly"
    light = n.dot(LIGHT)
    return "light" if light > .59 else "shadow" if light < -.39 else "coat"


def fin_skin(_, n):
    return "light" if n.dot(LIGHT) > .42 else "shadow"


def surface():
    s = CatSurface()
    s.start("Round body" if ANIMATES_SCALE else "Tall disc")
    if ANIMATES_SCALE:
        s.ellipsoid(BODY,(.695,.664,.575),"body",skin,sides=34,steps=20)
        s.start("Spines")
        for row, y_share in enumerate((-.81,-.55,-.26,.05,.34,.61,.80)):
            radius = math.sqrt(1-y_share*y_share)
            for index in range(14):
                phase = math.tau*(index+row*.5)/14
                x, z = math.cos(phase), math.sin(phase)
                root = BODY + V((.68*radius*x,.658*y_share,.563*radius*z))
                tip = root + .143 * V((x*radius,y_share+.09,z*radius))
                s.tube([(root,.034,.038,{"body":1}),(tip,.006,.006,{"body":1})],
                       lambda p,n:"cream" if n.z>-.3 else "belly",sides=6)
        s.start("Fan tail")
        s.tube([(V((0,-.56,.65)),.075,.083,{"tail":1}),
                (V((0,-.79,.65)),.069,.112,{"tail":1}),
                (V((0,-1.07,.71)),.043,.236,{"tail":1}),
                (V((0,-1.19,.72)),.019,.18,{"tail":1})],fin_skin,sides=13)
        front = V((0,.625,.595))
        eye_z, eye_y, eye_x = .798, .537, .395
    else:
        # The rear of the disc is truncated rather than tapering like a bony fish.
        s.ellipsoid(BODY,(.319,.658,.701),"body",skin,sides=30,steps=18)
        s.start("Blunt clavus")
        s.ellipsoid(V((0,-.57,.895)),(.170,.360,.482),"tail",fin_skin,sides=18,steps=10)
        front = V((0,.642,.846))
        eye_z, eye_y, eye_x = 1.006,.480,.203
    s.start("Mouth")
    s.ellipsoid(front,(.153,.110,.079),"body",lambda p,n:"cream",sides=16,steps=9)
    s.ellipsoid(front+V((0,.09,-.004)),(.089,.030,.041),"body",
                lambda p,n:"mask",sides=12,steps=7)
    for side, sign in SIDES:
        s.start("Eye "+side)
        eye = V((sign*eye_x,eye_y,eye_z))
        eye_size = 1 if ANIMATES_SCALE else .80
        offset = V((sign*.047,.040,.013))*eye_size
        s.ellipsoid(eye,(.110*eye_size,.103*eye_size,.098*eye_size),"body",
                    lambda p,n:"mask",sides=13,steps=8)
        s.ellipsoid(eye+offset,(.074*eye_size,.077*eye_size,.075*eye_size),"body",
                    lambda p,n:"eye",sides=12,steps=7)
        s.ellipsoid(eye+V((sign*.096,.082,.043))*eye_size,(.024,.022,.022),"body",
                    lambda p,n:"cream",sides=8,steps=5)
    for name, (root, tip) in BONES.items():
        if name == "tail":
            continue
        s.start(name)
        tall = name in ("dorsal", "anal") and not ANIMATES_SCALE
        s.tube([(root,.099,.155 if tall else .102,{name:1}),
                (root.lerp(tip,.45),.068,.241 if tall else .123,{name:1}),
                (root.lerp(tip,.81),.045,.134 if tall else .071,{name:1}),
                (tip,.018,.021,{name:1})],
               (lambda p,n:"light" if n.dot(LIGHT)>.03 else "coat") if tall else fin_skin,
               sides=12)
    return s


def pose(_, rest, clip, t):
    phase = math.tau*t
    cruising = clip == "swim"
    panic = clip == "flee"
    action = math.sin(math.pi*t)**2 if clip == "action" else 0
    pulse = math.sin(phase)
    fish_pitch = -.09*action + (.115 if panic else .035)*pulse
    roll = (.14 if ANIMATES_SCALE else .46)*action*math.sin(phase)
    yaw = (.098 if panic else .047 if cruising else .023)*pulse
    q = euler(fish_pitch,roll,yaw)
    position = BODY + V((0,.049*action,.031*pulse+.082*action))
    if ANIMATES_SCALE:
        # Inflate around the centre. The appendage transforms inherit the same
        # scale so the fins and spines remain attached during contraction.
        pose_matrix = q.to_matrix().to_4x4() @ Matrix.Scale(1+.29*action,4)
        pose_matrix.translation = position - pose_matrix.to_3x3() @ BODY
    else:
        pose_matrix = transform(q,BODY,position)
    out = {"body":pose_matrix @ rest["body"]}
    stroke = .42 if panic else .23 if cruising else .09
    for name,(pivot,_) in BONES.items():
        offset = 1 if name.endswith(".L") or name=="anal" else -1
        beat = math.sin(phase+offset*.65)
        if name=="tail":
            fin = euler(.056*beat,0,stroke*math.sin(phase-.86)+.13*panic*math.sin(phase*2))
        elif name in ("dorsal","anal"):
            fin = euler(0,offset*(stroke*1.4*beat+.24*action),.12*beat)
        else:
            fin = euler(.145*beat,0,offset*(stroke*beat-.30*panic+.155*action))
        out[name] = pose_matrix @ transform(fin,pivot,pivot) @ rest[name]
    return out
