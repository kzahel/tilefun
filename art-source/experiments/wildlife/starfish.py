"""Low, five-rayed starfish with separate swimming and escape performances."""
import math

from wildlife_build import CatSurface, V, aimed, euler, transform

NAME = "Starfish"
PALETTE = {"dark":"675641","coat":"c28158","light":"e2ab73","pale":"efc690"}
DURATIONS = {"idle":48,"swim":32,"action":24,"flee":17}
LIGHT = V((-.39,.36,.84)).normalized()
ROOT = V((0,0,.18))
RAYS = []
for i in range(5):
    theta = i*math.tau/5
    x,y = math.sin(theta),math.cos(theta)
    RAYS.append([V((x*r,y*r,z)) for r,z in ((.142,.17),(.48,.147),(.74,.094),(1.02,.064))])


def part(ray,joint):
    return f"ray.{ray}.{joint}"


def joints():
    nodes = [("body",ROOT,ROOT+V((0,.37,0)),None)]
    for i, ray in enumerate(RAYS):
        for joint,(a,b) in enumerate(zip(ray,ray[1:])):
            parent = part(i,joint-1) if joint else "body"
            nodes.append((part(i,joint),a,b,parent))
    return nodes


def paint(p,n):
    if n.z<-.30:
        return "dark" if n.dot(LIGHT)<-.41 else "coat"
    cell_u = (p.x*11.8+p.y*4.1)%1-.5
    cell_v = (p.y*13.8-p.x*2.2)%1-.5
    if cell_u*cell_u+cell_v*cell_v < .04:
        return "pale"
    return "light" if n.dot(LIGHT)>.22 else "coat"


def surface():
    s = CatSurface()
    s.start("Central disc")
    s.ellipsoid(ROOT,(.327,.32,.153),"body",paint,sides=20,steps=13)
    for i, ray in enumerate(RAYS):
        s.start(f"Ray {i+1}")
        rings = []
        for joint,(a,b) in enumerate(zip(ray,ray[1:])):
            for share in (0,.43,.76):
                progress = (joint+share)/3
                width = .213*(1-progress)**.81+.013
                depth = .126*(1-progress)**.80+.009
                name = part(i,joint)
                weights = {part(i,joint-1):.52,name:.48} if joint and not share else {name:1}
                rings.append((a.lerp(b,share),width,depth,weights))
        rings.append((ray[-1],.019,.014,{part(i,2):1}))
        s.tube(rings,paint,sides=12)
    return s


def pose(_,rest,clip,t):
    wave = math.tau*t
    swim = clip=="swim"
    escape = clip=="flee"
    curl = math.sin(math.pi*t)**2 if clip=="action" else 0
    rise = .018*math.cos(wave)+.095*curl+.040*escape*math.sin(2*wave)
    attitude = euler(.034*math.sin(wave)+.09*escape*math.cos(wave),
                     .046*math.cos(wave),.058*math.sin(wave)*swim)
    body = transform(attitude,ROOT,ROOT+V((0,0,rise)))
    result = {"body":body@rest["body"]}
    for i, ray in enumerate(RAYS):
        cursor = body@ray[0]
        along = ray[-1]-ray[0]
        twist = math.atan2(along.x,along.y)
        align = euler(0,0,-twist)
        for joint,(a,b) in enumerate(zip(ray,ray[1:])):
            phase = wave*(2 if escape else 1)+i*math.tau/5-.74*joint
            lift = (.31 if swim else .49 if escape else .071)*math.sin(phase)
            lift += curl*(.47+.10*joint)*(.85 if i%2 else 1.14)
            drift = .16*math.cos(phase)*escape+.061*math.cos(phase)*swim
            tilt = align@euler(lift,0,drift)@align.inverted()
            delta = attitude@(tilt@(b-a))
            name = part(i,joint)
            result[name] = aimed(rest[name],cursor,cursor+delta)
            cursor += delta
    return result
