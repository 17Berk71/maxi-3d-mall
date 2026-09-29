import json,math,colorsys
from PIL import Image,ImageDraw,ImageFont
d=json.load(open('maxi_data2.json'))
xs=[p[0] for b in d['bld'] for p in b];zs=[p[1] for b in d['bld'] for p in b]
x0,z0=min(xs)-5,min(zs)-5;S=5
W,H=int((max(xs)-x0+5)*S),int((max(zs)-z0+5)*S)
im=Image.new('RGB',(W,H),(30,32,40));g=ImageDraw.Draw(im)
P=lambda p:((p[0]-x0)*S,(p[1]-z0)*S)
for b in d['bld']:g.polygon([P(p) for p in b],fill=(226,226,232))
for v in d['voids']:g.polygon([P(p) for p in v],outline=(120,170,220))
CAT={'fashion':210,'food':12,'beauty':335,'acc':170,'tech':205,'kids':275,'gifts':45,'furn':28,'home':85,'sport':25,'serv':215,'misc':235}
fnt='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
for i,s in enumerate(d['stores']):
  if s['cat']=='tbd':col=(200,204,210)
  else:
    h=CAT[s['cat']]/360+((i*37)%21-10)/360;l=.55+((i*53)%7-3)*.03;sat=.55
    r,g_,b=colorsys.hls_to_rgb(h%1,l,sat);col=(int(r*255),int(g_*255),int(b*255))
  g.polygon([P(p) for p in s['poly']],fill=col,outline=(255,255,255))
for s in d['stores']:
  if not s['name']:continue
  f=ImageFont.truetype(fnt,40);bb=f.getbbox(s['name']);ta=(bb[2]-bb[0])/(bb[3]-bb[1])
  ks=sorted((float(k),v) for k,v in s['fit'].items())
  # interpolate h for aspect ta
  best=None
  for k,(h,a) in ks:
    if k>=ta:best=(h*min(1,k/ta) if False else h,a);break
  if best is None:k,(h,a)=ks[-1];best=(h*k/ta,a)
  h,a=best;h=min(h,4.5)
  if h*S<6:continue
  fs=max(6,int(h*S));f=ImageFont.truetype(fnt,fs);bb=f.getbbox(s['name'])
  tw,th=bb[2]-bb[0],bb[3]-bb[1];t=Image.new('RGBA',(tw+4,th+6),(0,0,0,0));tg=ImageDraw.Draw(t);tg.text((2-bb[0],3-bb[1]),s['name'],font=f,fill=(255,255,255,255),stroke_width=max(1,fs//10),stroke_fill=(20,30,40,200))
  t=t.rotate(-math.degrees(a),expand=True,resample=Image.BICUBIC);cx,cy=P(s['lp']);im.paste(t,(int(cx-t.size[0]/2),int(cy-t.size[1]/2)),t)
for k in d['kiosks']:
  x,y=P(k['p']);g.rectangle([x-k['w']*S/2,y-k['h']*S/2,x+k['w']*S/2,y+k['h']*S/2],fill=(90,90,100) if not k.get('flat') else (200,120,120))
for c in d['cols']:x,y=P(c);g.ellipse([x-3,y-3,x+3,y+3],fill=(255,255,255),outline=(0,0,0))
for e in d['esc']:
  ca,sa=math.cos(e['a']),math.sin(e['a']);pts=[]
  for u,v in [(-4.9,-1.55),(4.9,-1.55),(4.9,1.55),(-4.9,1.55)]:pts.append(P([e['p'][0]+u*ca-v*sa,e['p'][1]+u*sa+v*ca]))
  g.polygon(pts,fill=(0,90,255),outline=(255,255,255))
  tx,ty=P([e['p'][0]+4.9*ca,e['p'][1]+4.9*sa]);g.ellipse([tx-5,ty-5,tx+5,ty+5],fill=(255,255,0))
for e in d['ents']:x,y=P(e['p']);g.ellipse([x-8,y-8,x+8,y+8],fill=(0,200,80));g.text((x+10,y-8),'Вход %d'%e['n'],fill=(0,255,120),font=ImageFont.truetype(fnt,18))
im.save('preview.png');print(im.size)
im.crop((0,0,W//2,H)).resize((W//4,H//2)).save('pv1.png');im.crop((W//2,0,W,H)).resize((W//4,H//2)).save('pv2.png')
