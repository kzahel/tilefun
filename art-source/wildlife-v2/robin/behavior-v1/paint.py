def xy(v):return tuple(int(math.floor(a+.5)) for a in v[:2])
def letter(p):
 rows=p['pixels'];im=Image.new('RGBA',(len(rows[0]),len(rows)))
 for y,row in enumerate(rows):
  assert len(row)==im.width
  for x,k in enumerate(row):
   if k!='.':im.putpixel((x,y),P[k])
 return im
parts={g:{f:letter(M[g][f]) for f in F} for g in ['bodies','heads']}
def paste(im,g,r):
 x,y=xy(r['head'] if g=='heads' else r['body']);a,b=M[g][r['facing']]['offset'];im.alpha_composite(parts[g][r['facing']],(x+a,y+b))
def fan(im,r,s,near):
 d=ImageDraw.Draw(im)
 for group,col in [('secondary','b' if near else 's'),('primary','s')]:
  v=r['volumes'][f'{group}-{s}-volume'];ps=[xy(p) for p in v['hull']];d.polygon(ps,fill=P[col]);d.line(ps+[ps[0]],fill=P['o'])
  d.line([ps[0],ps[len(ps)//2]],fill=P['h'])
  if group=='primary':
   a=xy(r['wings'][str(s)]['elbow']);b=xy([(v['bbox'][0]+v['bbox'][2])/2,(v['bbox'][1]+v['bbox'][3])/2]);d.line([a,b],fill=P['b'])
 v=r['volumes'][f'bar-{s}-volume'];d.line([xy(p) for p in v['hull'][:2]],fill=P['l'])
def foot(im,r,s,near):
 d=ImageDraw.Draw(im);c=r['contacts'][str(s)];ps=[xy(c['screen'][k]) for k in ['hip','knee','hock','ankle']];d.line(ps,fill=P['t'] if near else P['s'])
 if r['clip']=='flap':return
 for j in range(4):
  v=r['volumes'][f'toe-{s}-{j}-volume'];ps=[xy(p) for p in v['hull']];d.polygon(ps,fill=P['t'] if near else P['s'])
def tail(im,r):
 d=ImageDraw.Draw(im);ps=[xy(p) for p in r['volumes']['tail-volume']['hull']];d.polygon(ps,fill=P['s']);d.line(ps+[ps[0]],fill=P['o']);a=xy(r['landmarks']['TAIL-cock']);b=xy(r['landmarks']['tail-tip']);d.line([a,b],fill=P['b'])
def bill(im,r):
 if r['facing']=='up':return
 idle=next(g for g in G['records'] if g['clip']=='idle' and g['facing']==r['facing']);h0,h=xy(idle['head']),xy(r['head']);delta=(h[0]-h0[0],h[1]-h0[1]);p0,q0=xy(idle['landmarks']['bill-tip']),xy(idle['landmarks']['lower-bill-tip']);p=(p0[0]+delta[0],p0[1]+delta[1]);q=(q0[0]+delta[0],q0[1]+delta[1])
 if r['clip']=='action':q=xy(r['landmarks']['lower-bill-tip'])
 d=ImageDraw.Draw(im)
 if r['facing']=='down':d.point(p,fill=P['k']);d.point(q,fill=P['k'])
 else:
  # Fine bill stays beyond the complete face patch; no eye/head morphing.
  step=-1 if r['facing']=='left' else 1;d.line([(p[0]-step,p[1]),p],fill=P['k']);d.point(q,fill=P['k'])
def compose(r):
 im=Image.new('RGBA',(W,W));order=sorted([-1,1],key=lambda s:r['contacts'][str(s)]['screen']['hip'][2],reverse=True)
 foot(im,r,order[0],False)
 if r['clip']=='flap':
  wo=sorted([-1,1],key=lambda s:r['volumes'][f'secondary-{s}-volume']['depthRange'][0],reverse=True);fan(im,r,wo[0],False)
 tail(im,r);paste(im,'bodies',r);foot(im,r,order[1],True);paste(im,'bodies',r)
 if r['facing']=='up':tail(im,r)
 if r['clip']=='flap':fan(im,r,wo[1],True)
 paste(im,'heads',r);bill(im,r);return im
