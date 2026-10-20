def snap(v):return math.floor(v+.5)
def xy(p):return tuple(snap(v) for v in p[:2])
def pattern(group,f):
    part=M[group][f];rows=part.get('pixels')
    if rows is None:rows=[r[::-1] for r in M[group][part['mirror']]['pixels']]
    im=Image.new('RGBA',(len(rows[0]),len(rows)))
    for y,row in enumerate(rows):
        for x,ch in enumerate(row):
            if ch!='.':im.putpixel((x,y),P[ch])
    return im,part['offset']
def part_image(group,f):
    im=Image.new('RGBA',(W,W));paint,offset=pattern(group,f)
    ref=G['references'][f];anchor=ref['body' if group=='bodies' or not horse else 'head']
    im.alpha_composite(paint,(snap(anchor[0])+offset[0],snap(anchor[1])+offset[1]));return im
templates={(group,f):part_image(group,f) for group in (['bodies','heads','necks'] if species=='goat' else ['bodies','heads']) for f in F}
def painted_part(im,group,r):
    if group=='necks':
        ps=hull(r['neckHull']);d=ImageDraw.Draw(im);d.polygon(ps,fill=P['B']);d.line(ps+[ps[0]],fill=P['R']);return
    f=r['facing'];ref=G['references'][f];name='body' if group in ['bodies','necks'] else 'head'
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
def leg(im,name,c,near,f):
    d=ImageDraw.Draw(im);points=[xy(p) for p in c['screen']]
    colors=[P['B' if near else 'S']]*4
    for i,(a,b) in enumerate(zip(points,points[1:])):
        d.line([a,b],fill=colors[i],width=2 if i==0 else 1)
    x,y=points[-1]
    if horse:
        hoof,off=pattern('hooves','rear' if f=='up' else ('near' if near else 'far'))
        im.alpha_composite(hoof,(x+off[0],y+off[1]))
    else:
        d.polygon([(x-1,y-1),(x+1,y-1),(x+2,y),(x+1,y+1),(x-1,y+1)],fill=P['o'])
        if near:d.line([(x-1,y),(x+1,y)],fill=P['s'])
        if f!='up':d.point((x,y+1),fill=P['k'])
def hull(points):
    ps=sorted(set(xy(p) for p in points));lo=[];hi=[]
    def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    for p in ps:
        while len(lo)>1 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
        lo.append(p)
    for p in reversed(ps):
        while len(hi)>1 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
        hi.append(p)
    return lo[:-1]+hi[:-1]
def ears(im,r,near):
    if species!='goat':return
    d=ImageDraw.Draw(im)
    for e in sorted(r['ears'].values(),key=lambda e:e['base'][2],reverse=True):
        if (e['base'][2]<r['head'][2])!=near:continue
        ps=hull(e['points']);d.polygon(ps,fill=P['B']);d.line(ps+[ps[0]],fill=P['R'])
        a,b=xy(e['base']),xy(e['tip']);d.point(((a[0]+b[0])//2,(a[1]+b[1])//2),fill=P['Q'])

def horns(im,r):
    if species!='goat':return
    d=ImageDraw.Draw(im)
    for ps in r['horns'].values():
        ps=[xy(p) for p in ps];d.line(ps,fill=P['F']);d.point(ps[-1],fill=P['W'])

def tail(im,r):
    d=ImageDraw.Draw(im);ps=[xy(p) for p in r['tail']]
    if species=='goat':d.line(ps,fill=P['R']);d.point(ps[-1],fill=P['B'])
    else:
        a,b=ps;d.line(ps,fill=P['K'],width=4);d.line(ps,fill=P['B'],width=3)
        if r['facing']=='up' or (r['clip']=='action' and 2<=r['index']<=6):d.line([((a[0]+b[0])//2,(a[1]+b[1])//2),b],fill=P['C'],width=2)
        elif r['facing'] in ['left','right']:d.point((b[0],b[1]+1),fill=P['L'])

def compose(r):
    im=Image.new('RGBA',(W,W));order=sorted(r['contacts'].items(),key=lambda q:q[1]['screen'][0][2],reverse=True)
    for n,c in order[:2]:leg(im,n,c,False,r['facing'])
    if r['facing']!='up':tail(im,r)
    if r['facing']=='up':
        if species=='goat':painted_part(im,'necks',r);ears(im,r,False)
        painted_part(im,'heads',r)
    painted_part(im,'bodies',r)
    for n,c in order[2:]:leg(im,n,c,True,r['facing'])
    painted_part(im,'bodies',r)
    if r['facing']=='up':tail(im,r)
    if r['facing']!='up':
        if species=='goat':painted_part(im,'necks',r);horns(im,r);ears(im,r,False)
        painted_part(im,'heads',r)
        if species=='goat':ImageDraw.Draw(im).line([xy(p) for p in r['beard']],fill=P['N'])
    else:horns(im,r)
    ears(im,r,True)
    return im
