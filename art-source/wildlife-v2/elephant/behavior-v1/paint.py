def snap(v):return math.floor(v+.5)
def xy(p):return tuple(snap(v) for v in p[:2])
def pattern(group,f):
    part=M[group][f] if f else M[group];rows=part.get('pixels')
    if rows is None:rows=[r[::-1] for r in M[group][part['mirror']]['pixels']]
    im=Image.new('RGBA',(len(rows[0]),len(rows)))
    for y,row in enumerate(rows):
        for x,ch in enumerate(row):
            if ch!='.':im.putpixel((x,y),P[ch])
    return im,part['offset']
def part_image(group,f):
    im=Image.new('RGBA',(W,W));paint,offset=pattern(group,f)
    ref=G['references'][f];anchor=G['anchor']
    im.alpha_composite(paint,(snap(anchor[0])+offset[0],snap(anchor[1])+offset[1]));return im
templates={(group,f):part_image(group,f) for group in ['bodies','heads'] for f in F}
def painted_part(im,group,r):
    f=r['facing'];ref=G['references'][f];name='body' if group=='bodies' else 'head'
    # Reproject a rigid painted plane through the actual Blender body/head
    # transform. This includes camera foreshortening, never geometry scaling.
    def inverse(m):
        a,b=m[0];c,d=m[1];det=a*d-b*c;assert abs(det)>1e-8
        return [[d/det,-b/det],[-c/det,a/det]]
    a=ref[name+'Basis'];b=inverse(r[name+'Basis'])
    m=[[sum(a[i][k]*b[k][j] for k in range(2)) for j in range(2)] for i in range(2)]
    old=ref[name];new=r[name]
    transform=(m[0][0],m[0][1],old[0]-m[0][0]*new[0]-m[0][1]*new[1],m[1][0],m[1][1],old[1]-m[1][0]*new[0]-m[1][1]*new[1])
    paint=templates[group,f].transform((W,W),Image.Transform.AFFINE,transform,Image.Resampling.NEAREST)
    im.alpha_composite(paint)
def ribbon(im,points,radii,base='g',highlight=True):
    d=ImageDraw.Draw(im);normals=[]
    for i,p in enumerate(points):
        a,b=points[max(0,i-1)],points[min(len(points)-1,i+1)]
        dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy) or 1
        normals.append((-dy/length*radii[i],dx/length*radii[i]))
    contour=[(snap(p[0]+n[0]),snap(p[1]+n[1])) for p,n in zip(points,normals)]
    contour += [(snap(p[0]-n[0]),snap(p[1]-n[1])) for p,n in reversed(list(zip(points,normals)))]
    d.polygon(contour,fill=P[base]);d.line(contour+[contour[0]],fill=P['o'],width=1)
    if highlight:
        d.line(points,fill=P['h'],width=2)
        d.line([(p[0]+1,p[1]) for p in points],fill=P[base],width=1)
def leg(im,name,c,near,f):
    ps=[xy(p) for p in c['screen']]
    ribbon(im,ps,[3.4,3.2,2.9,2.6,2.5],base='g' if near else 's',highlight=near)
    foot,offset=pattern('rearHeel' if f=='up' else 'foot',None)
    if not near:
        for y in range(foot.height):
            for x in range(foot.width):
                if foot.getpixel((x,y)) in [P['g'],P['h']]:foot.putpixel((x,y),P['e'])
    x,y=ps[-1];im.alpha_composite(foot,(x+offset[0],y+offset[1]))

def trunk(im,r):
    points=[xy(p) for p in r['trunk']]
    ribbon(im,points,[3,2.8,2.4,2,1.6,1],highlight=True)
    d=ImageDraw.Draw(im)
    # Restrained 1px transverse folds; no noisy per-frame color sampling.
    for i in [1,2,3]:
        a,b=points[i-1],points[i+1];dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy) or 1
        nx,ny=-dy/length,dx/length;p=points[i]
        d.line([(snap(p[0]-nx),snap(p[1]-ny)),(snap(p[0]+nx),snap(p[1]+ny))],fill=P['e'])
def tail(im,r):
    if r['facing']=='down':return
    a,b=[xy(p) for p in r['tail']];d=ImageDraw.Draw(im)
    d.line([a,b],fill=P['o'],width=2);d.line([a,b],fill=P['e'],width=1)
    d.ellipse((b[0]-1,b[1]-1,b[0]+1,b[1]+2),fill=P['s'])

def compose(r):
    im=Image.new('RGBA',(W,W));order=sorted(r['contacts'].items(),key=lambda q:q[1]['screen'][0][2],reverse=True)
    for n,c in order[:2]:leg(im,n,c,False,r['facing'])
    if r['facing']=='up':trunk(im,r)
    if r['facing'] in ['up','left','right']:painted_part(im,'heads',r)
    painted_part(im,'bodies',r)
    for n,c in order[2:]:leg(im,n,c,True,r['facing'])
    painted_part(im,'bodies',r);tail(im,r)
    if r['facing']!='up':trunk(im,r);painted_part(im,'heads',r)
    return im
