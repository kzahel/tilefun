def snap(x):return math.floor(x+.5)
def xy(p):return tuple(snap(x) for x in p[:2])
def pattern(group,facing=None):
    e=M[group][facing] if facing else M[group]
    rows=M[group][e['mirror']]['pixels'] if 'mirror' in e else e['pixels']
    if 'mirror' in e:rows=[r[::-1] for r in rows]
    assert len(set(map(len,rows)))==1,(group,facing)
    im=Image.new('RGBA',(len(rows[0]),len(rows)))
    for y,row in enumerate(rows):
        for x,ch in enumerate(row):
            if ch!='.':im.putpixel((x,y),PAL[ch])
    return im,e['offset']
def paste(im,group,facing,anchor):
    p,off=pattern(group,facing);a=xy(anchor);im.alpha_composite(p,(a[0]+off[0],a[1]+off[1]))
def center(r,name):
    b=r['volumes'][name]['bounds'];return [(b[0]+b[2])/2,(b[1]+b[3])/2]
def limb(im,name,c,near,facing):
    d=ImageDraw.Draw(im);hip,knee,foot=[xy(c['screen'][k]) for k in ['hip','knee','foot']]
    hind=name.startswith('hind')
    if hind:
        d.line([hip,knee],fill=PAL['S' if not near else 'B'],width=3)
        d.line([knee,foot],fill=PAL['K'],width=2)
        d.line([knee,foot],fill=PAL['S' if not near else 'B'],width=1)
    else:d.line([hip,knee,foot],fill=PAL['S' if not near else 'B'],width=1)
    # Paw silhouettes follow the independently projected long-foot mesh hull.
    # Head-facing white muzzle is never applied to rear feet.
    paste(im,'hindpaw' if hind else 'forepaw',None,c['screen']['foot'])
def ears(im,r):
    f=r['facing'];items=[(n,r['landmarks']['ear-hinge'+str(n)]) for n in [-1,1]]
    items.sort(key=lambda p:p[1][2],reverse=True)
    for index,(side,a) in enumerate(items):
        key=f if f in ['up','down'] else f+('-far' if index==0 else '-near')
        if r['clip']=='action' and r['index'] in [1,2,3,4]:
            # Use the SAME authored ear letters. Independent rigid guide-tip
            # changes warp the integer clusters, retaining idle stylization.
            # A second rendering treatment made ears falsely grow in drawing03.
            idle=next(x for x in G['records'] if x['facing']==f and x['clip']=='idle')
            old=idle['landmarks']['ear-tip'+str(side)];tip=r['landmarks']['ear-tip'+str(side)]
            delta=[tip[i]-old[i] for i in range(2)];p,off=pattern('ears',key);base=xy(a)
            for y in range(p.height):
                weight=1-y/(p.height-1)
                for x in range(p.width):
                    color=p.getpixel((x,y))
                    if color[3]:im.putpixel((base[0]+off[0]+x+snap(delta[0]*weight),base[1]+off[1]+y+snap(delta[1]*weight)),color)
        else:paste(im,'ears',key,a)
def compose(r):
    im=Image.new('RGBA',(W,W));f=r['facing']
    contacts=sorted(r['contacts'].items(),key=lambda p:p[1]['screen']['hip'][2],reverse=True)
    for n,c in contacts[:2]:limb(im,n,c,False,f)
    if f=='up':ears(im,r);paste(im,'heads',f,r['landmarks']['HEAD-stable-volume'])
    paste(im,'rump',f,center(r,'rump'));paste(im,'chest',f,center(r,'chest'))
    for n,c in contacts[2:]:limb(im,n,c,True,f)
    if f!='down':paste(im,'tail',None,r['landmarks']['round-tail'])
    if f!='up':ears(im,r);paste(im,'heads',f,r['landmarks']['HEAD-stable-volume'])
    return im
