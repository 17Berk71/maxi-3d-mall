import numpy as np,cv2,json,re,base64,math
from scipy import ndimage as ndi
from skimage.morphology import skeletonize
exec(open('cats.py').read())
exec(open('fit2.py').read().split("import json")[0])
meta=json.load(open('mos_meta.json'));X0,Y0,CW,CH=meta['X0'],meta['Y0'],meta['CW'],meta['CH']
L=np.load('seg_L2.npy');S2=json.load(open('seg2.json'))
MPX=0.158
walk0=(L==1)
bld=(L!=2)
ys,xs=np.nonzero(bld);CX,CY=(xs.min()+xs.max())/2,(ys.min()+ys.max())/2
def W(x,y):return [round(float((x-CX)*MPX),2),round(float((y-CY)*MPX),2)]
def g(k):return np.mean([p for _,p in mos[k]],0)-[X0,Y0]
# --- names
names={}
for k in mos:
  nm=re.sub(r' 2$','',k)
  names.setdefault(nm,[]).append(g(k))
islands=set(S2['islands'])
for i in list(islands):
  if S2['info'][str(i)]['area_m2']<3.0:
    L[L==i]=1;islands.discard(i)
walk0=(L==1)
dist_room,ind_room=ndi.distance_transform_edt(L<10,return_indices=True)
roomNames={};kioskExtra=[];snap=[]
ents={};escM=[];wcs=[]
KIOSKISH={'Energo','Паровозик','Gold Gum','Rocky Boxer','Happy Cars','Броноскинс','Save Phone','Print Cases','Чехломат','Korf X','Большой стакан','Бери заряд','Vendpresso','Микрозелень','Justmint'}
isl_pts={i:np.array(S2['info'][str(i)]['c']) for i in islands}
isl_taken={}
pts_in={}
for nm,ps in names.items():
  for p in ps:
    x,y=int(round(p[0])),int(round(p[1]))
    if nm.startswith('_ENT'):ents[int(nm[4:])]=(x,y);continue
    if nm.startswith('_WC'):wcs.append((x,y));continue
    if nm.startswith('_'):continue
    if not(0<=x<CW and 0<=y<CH):continue
    r=int(L[y,x])
    if r>=10 and r not in islands and nm not in KIOSKISH:
      if nm not in roomNames.setdefault(r,[]):roomNames[r].append(nm);pts_in.setdefault(r,[]).append((nm,x,y))
      continue
    snap.append((nm,x,y))
for nm,x,y in snap:
  best=None
  for i,c in isl_pts.items():
    if i in isl_taken:continue
    d=math.hypot(c[0]-x,c[1]-y)*MPX
    if d<9 and (best is None or d<best[0]):best=(d,i)
  if best:isl_taken[best[1]]=nm;continue
  if nm not in KIOSKISH:
    R=int(7/MPX);y0_,x0_=max(0,y-R),max(0,x-R);win=L[y0_:y+R+1,x0_:x+R+1]
    wy,wx=np.nonzero(win>=10);cand={}
    for yy1,xx1 in zip(wy,wx):
      rid=int(win[yy1,xx1])
      if rid in islands or roomNames.get(rid):continue
      d=math.hypot(xx1+x0_-x,yy1+y0_-y)
      if rid not in cand or d<cand[rid]:cand[rid]=d
    if cand:
      rid=min(cand,key=cand.get);roomNames.setdefault(rid,[]).append(nm);continue
  kioskExtra.append((nm,x,y))
# brand dedupe
for r,v in roomNames.items():
  vv=[]
  for n_ in v:
    if any(n_ in o or o in n_ for o in vv):continue
    vv.append(n_)
  roomNames[r]=vv
# split rooms having >=2 inside names
nextId=int(L.max())+1
yy_,xx_=np.mgrid[0:CH,0:CW]
for r,v in list(roomNames.items()):
  P=[(n_,x,y) for n_,x,y in pts_in.get(r,[]) if n_ in v]
  if len(P)<2:continue
  m=L==r;area=m.sum()*MPX*MPX
  if area<30*len(P):continue
  ys_,xs_=np.nonzero(m)
  d=np.stack([np.maximum(abs(xs_-x),abs(ys_-y)) for _,x,y in P],0);nr=d.argmin(0)
  for j,(n_,x,y) in enumerate(P):
    sel=nr==j
    if j==0:roomNames[r]=[n_];continue
    L[ys_[sel],xs_[sel]]=nextId;roomNames[nextId]=[n_];nextId+=1
print('named rooms',len(roomNames),'multi',{k:v for k,v in roomNames.items() if len(v)>1},'kioskExtra',kioskExtra,'islandNames',len(isl_taken))
# REG
# ---- магазины без выхода в коридор: присоединяем соседнее безымянное помещение с витриной
_isl0=set(islands)
def _front(r):
  m=L==r;return (cv2.dilate(m.astype(np.uint8),np.ones((3,3),np.uint8)).astype(bool)&(L==1)).sum()
for _it in range(3):
  merged=0
  for r,nm in list(roomNames.items()):
    if r in _isl0 or not (L==r).any() or _front(r)>=6:continue
    m=(L==r);ring=cv2.dilate(m.astype(np.uint8),np.ones((5,5),np.uint8)).astype(bool)&~m
    cand=[int(q) for q in np.unique(L[ring]) if q>=10 and int(q) not in _isl0 and not roomNames.get(int(q))]
    cand=[(_front(q),q) for q in cand];cand=[c for c in cand if c[0]>=6]
    if not cand:continue
    q=max(cand)[1];L[L==q]=r;merged+=1
  if not merged:break
print('merged rooms for shop access')
# ---- расширение коридоров (~35%) и выпрямление их контура
exec(open('regular.py').read())
GROW=0.215
_isl=list(islands)
corrM=(L==1)|np.isin(L,_isl)
dtc,indc=ndi.distance_transform_edt(corrM,return_indices=True)
# ширина коридора в каждой его точке: 2 * максимум расстояния до стены в окрестности
wloc=ndi.maximum_filter(dtc,size=int(6/MPX))*2
dr,indr=ndi.distance_transform_edt(~corrM,return_indices=True)
roomPx=(L>=10)&~np.isin(L,_isl)
grow=roomPx&(dr<=GROW*wloc[indr[0],indr[1]])
# не съедать помещение больше чем наполовину
for r in np.unique(L[grow]):
  m=L==r;g_=grow&m
  if g_.sum()>0.5*m.sum():
    dd=dr[g_];thr=np.percentile(dd,50);grow[g_&(dr>thr)]=False
L=L.copy();L[grow]=1
corrM=(L==1)|np.isin(L,_isl)
FAMS=families(L,[int(i) for i in np.unique(L[L>=10]) if int(i) not in islands]);print('wall families',FAMS)
# контур коридора: крупное упрощение + привязка к осям здания
cs,hier=cv2.findContours(corrM.astype(np.uint8),cv2.RETR_CCOMP,cv2.CHAIN_APPROX_NONE)
c2=np.zeros(L.shape,np.uint8);holes=np.zeros(L.shape,np.uint8)
for i,c in enumerate(cs):
  if cv2.contourArea(c)<60:continue
  ap=cv2.approxPolyDP(c,5.0,True)[:,0,:].astype(float)+0.5
  if len(ap)>=3:ap=regularize(ap,FAMS,tol=12.0,minEdge=14.0,maxMove=25.0)
  pts=[np.round(np.array(ap)-0.5).astype(np.int32)]
  if hier[0][i][3]<0:cv2.fillPoly(c2,pts,1)
  else:cv2.fillPoly(holes,pts,1)
corr2=(c2>0)&(holes==0)&(L!=2)
nc,cl,cst,_=cv2.connectedComponentsWithStats(corr2.astype(np.uint8),connectivity=4)
corr2=cl==(1+np.argmax(cst[1:,4]))
# помещения: то, что стало коридором, — коридор; бывший коридор вне нового контура — ближайшему помещению
roomsOnly=(L>=10)&~np.isin(L,_isl)
_,ind=ndi.distance_transform_edt(~roomsOnly,return_indices=True)
lost=corrM&~corr2&(L!=2)
L[lost]=L[ind[0][lost],ind[1][lost]]
isl_keep=np.isin(L,_isl)&corr2
L[corr2&~isl_keep]=1
walk0=(L==1)
print('corridor grown px',int(grow.sum()),'straightened')
# ---- выпрямление помещений: стороны по основным осям здания, коридор = здание минус помещения
exec(open('regular.py').read())
rids=[int(i) for i in np.unique(L[L>=10]) if int(i) not in islands]
regPoly={}
order=sorted(rids,key=lambda r:-(L==r).sum())
Lr=np.where(L==2,2,1).astype(np.int32)
for r in order:
  m=L==r
  if m.sum()<12:continue
  P=trace(m,2.2)
  if P is None or len(P)<3:continue
  Q=regularize(P,FAMS)
  regPoly[r]=Q
  cv2.fillPoly(tmp:=np.zeros(L.shape,np.uint8),[np.round(Q-0.5).astype(np.int32)],1)
  Lr[(tmp>0)&(L!=2)]=r
# коридор оставляем только там, где он был коридором (или островком); щели между помещениями отдаём соседям
wasCorr=(L==1)|np.isin(L,list(islands))
gap=(Lr==1)&~wasCorr
corr=(Lr==1)&wasCorr
corr=cv2.morphologyEx(corr.astype(np.uint8),cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5))).astype(bool)
nc,cl,cst,_=cv2.connectedComponentsWithStats(corr.astype(np.uint8),connectivity=4)
corr=cl==(1+np.argmax(cst[1:,4]))
fill=(Lr!=2)&~corr&(Lr<10)
roomsM=Lr>=10
_,ind=ndi.distance_transform_edt(~roomsM,return_indices=True)
Lr[fill]=Lr[ind[0][fill],ind[1][fill]]
Lr[corr]=1
for i in islands:Lr[(L==i)&corr]=i
L=Lr;walk0=(L==1)
print('regularized rooms',len(regPoly))
rooms=[int(i) for i in np.unique(L[L>=10])]
dtw=ndi.distance_transform_edt(walk0)*MPX
# --- escalators (icon points, M frame)
escPts=[(477,433),(595,530),(540,600),(TEM([(532,467)])[0]),(TEM([(567,546)])[0]),(TEM([(390,587)])[0]),(TWM([(968,733)])[0])]
escPts=[np.array(p,float)-[X0,Y0] for p in escPts]
# --- corridor geometry
# islands: kiosks (obstacles) ; very small -> corridor
kiosks=[]
for i in list(islands):
  m=L==i;info=S2['info'][str(i)]
  ys_,xs_=np.nonzero(m);cx,cy=xs_.mean(),ys_.mean()
  rect=cv2.minAreaRect(np.c_[xs_,ys_].astype(np.float32))
  (rx,ry),(rw,rh),ang=rect
  kiosks.append({'id':i,'x':cx,'y':cy,'w':max(rw,rh)*MPX,'h':min(rw,rh)*MPX,'a':math.radians(float(ang) if rw>=rh else float(ang)+90),'name':None})
for nm,x,y in kioskExtra:
  if L[y,x]!=1:
    wy,wx=np.nonzero(walk0[max(0,y-40):y+40,max(0,x-40):x+40])
    if len(wx):j=np.argmin((wx-40)**2+(wy-40)**2);x,y=wx[j]+max(0,x-40),wy[j]+max(0,y-40)
  if dtw[y,x]<2.6:
    r=int(L[ind_room[0][y,x],ind_room[1][y,x]])
    if r not in islands:roomNames.setdefault(r,[]).append(nm)
    continue
  kiosks.append({'id':None,'x':x,'y':y,'w':2.4,'h':1.4,'a':0,'name':nm})
for k in kiosks:
  if k['id'] in isl_taken:k['name']=isl_taken[k['id']]
# walkable = corridor (islands stay non-walkable)
walk=walk0.copy()
for i in islands:walk|=(L==i)
# --- voids (gallery openings)
v=dtw>2.9
v=cv2.morphologyEx(v.astype(np.uint8),cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(15,15)))
v=cv2.morphologyEx(v,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(9,9)))
n,vl,vs,_=cv2.connectedComponentsWithStats(v,connectivity=4)
void=np.zeros_like(walk)
for j in range(1,n):
  if vs[j,4]*MPX*MPX>40:void|=(vl==j)
def polys(mask,eps,minA,reg=False,minEdge=3.0):
  cs,_=cv2.findContours(mask.astype(np.uint8),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
  out=[]
  for c in cs:
    if cv2.contourArea(c)<minA:continue
    ap=cv2.approxPolyDP(c,eps,True)[:,0,:].astype(float)+0.5
    if reg:ap=regularize(ap,FAMS,tol=9.0,minEdge=minEdge)
    out.append([[round(float(q[0]),2),round(float(q[1]),2)] for q in cleanup([W(x,y) for x,y in ap],minLen=0.8)])
  return out
voids=polys(void,3.0,200,reg=True,minEdge=8.0)
# --- junctions: skeleton of corridor with islands filled, spurs pruned
cm=walk0.copy()
for i in islands:cm|=(L==i)
cm=cv2.morphologyEx(cm.astype(np.uint8),cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(7,7))).astype(bool)
sk=skeletonize(cm)
K=np.ones((3,3));
for it in range(int(9/MPX)):
  nb=ndi.convolve(sk.astype(np.uint8),K,mode='constant')-1
  endp=sk&(nb<=1)
  if not endp.any():break
  sk=sk&~endp
nb=ndi.convolve(sk.astype(np.uint8),K,mode='constant')-1
jp=np.argwhere(sk&(nb>=3))
dcm=ndi.distance_transform_edt(cm)*MPX
jn=[]
for y,x in jp:
  if dcm[y,x]<3.2:continue
  if all(math.hypot(x-a_,y-b_)*MPX>14 for a_,b_ in jn):jn.append((int(x),int(y)))
# atrium zones
zone=np.zeros_like(walk0)
yy_,xx_=np.mgrid[0:CH,0:CW]
def disk(x,y,r):
  R=int(r/MPX);y0_,x0_=max(0,y-R),max(0,x-R);sub=(yy_[y0_:y+R+1,x0_:x+R+1]-y)**2+(xx_[y0_:y+R+1,x0_:x+R+1]-x)**2<=R*R;zone[y0_:y+R+1,x0_:x+R+1]|=sub
for x,y in jn:disk(x,y,12)
for p in escPts:disk(int(p[0]),int(p[1]),13)
zone|=ndi.binary_dilation(dcm>7.0,iterations=int(4/MPX))
cols=[]
for vp in voids:
  P=np.array(vp);n_=len(P);acc=0.0;tpos=4.0
  for i in range(n_):
    a_,b_=P[i],P[(i+1)%n_];l=float(np.linalg.norm(b_-a_))
    while tpos<=acc+l:
      q=a_+(b_-a_)*((tpos-acc)/max(l,1e-6));tpos+=9.0
      px,py=int(q[0]/MPX+CX),int(q[1]/MPX+CY)
      if 0<=px<CW and 0<=py<CH and zone[py,px] and all(math.hypot(q[0]-c[0],q[1]-c[1])>6.5 for c in cols):
        cols.append([round(float(q[0]),2),round(float(q[1]),2)])
    acc+=l
print('voids',len(voids),'junctions',len(jn),'columns',len(cols))
# --- rooms
out=[]
cat_count={}
for r in rooms:
  if r in islands:continue
  m=L==r;area=m.sum()*MPX*MPX
  if area<2:continue
  if r not in regPoly:continue
  P=[[round(float(q[0]),2),round(float(q[1]),2)] for q in cleanup([W(x,y) for x,y in regPoly[r]])]
  nm_list=roomNames.get(r,[])
  nm=nm_list[0] if nm_list else None
  cat,what=C.get(nm_list[0],('misc','Магазин')) if nm_list else ('tbd','Название не найдено')
  # label placement: pole + orientation + fit sizes for aspects
  dt=cv2.distanceTransform(np.pad(m.astype(np.uint8),1),cv2.DIST_L2,5)[1:-1,1:-1]
  py_,px_=np.unravel_index(np.argmax(dt),dt.shape)
  ys_,xs_=np.nonzero(m)
  (rx,ry),(rw,rh),ang=cv2.minAreaRect(np.c_[xs_,ys_].astype(np.float32))
  long_ang=math.radians(ang if rw>=rh else ang+90)
  elong=max(rw,rh)/max(1,min(rw,rh))
  if elong<1.5:long_ang=0.0
  # normalise to (-90,90]
  while long_ang>math.pi/2:long_ang-=math.pi
  while long_ang<=-math.pi/2:long_ang+=math.pi
  me=cv2.erode(m.astype(np.uint8),np.ones((5,5),np.uint8)).astype(bool)
  def fits(h,k,cx,cy,a):
    w=k*h;ca,sa=math.cos(a),math.sin(a)
    for u in np.linspace(-w/2,w/2,9):
      for vv in np.linspace(-h/2,h/2,5):
        x=cx+u*ca-vv*sa;y=cy+u*sa+vv*ca;ix,iy=int(round(x)),int(round(y))
        if not(0<=ix<CW and 0<=iy<CH) or not me[iy,ix]:return False
    return True
  fitsz={}
  for k in (1.5,2.5,4,6,9,13):
    best=(0,0)
    for a in ([long_ang,0.0] if abs(long_ang)>0.05 else [0.0]):
      lo,hi=0.0,min(80.0,dt.max()*2)
      for _ in range(14):
        mid=(lo+hi)/2
        if fits(mid,k,px_,py_,a):lo=mid
        else:hi=mid
      if lo>best[0]:best=(lo,a)
    fitsz[k]=[round(best[0]*MPX,2),round(best[1],3)]
  out.append({'name':nm or '','names':nm_list,'cat':cat,'what':what,'poly':P,'area':round(float(area)),'c':W(xs_.mean()+.5,ys_.mean()+.5),'lp':W(px_+.5,py_+.5),'fit':fitsz})
print('rooms out',len(out),'named',sum(1 for o in out if o['name']))
# kiosks out
KS=[]
for k in kiosks:
  nm=k['name']
  cat,what=C.get(nm,('misc','Островок')) if nm else ('tbd','Островок в галерее')
  KS.append({'name':nm or '','cat':cat,'what':what,'p':W(k['x'],k['y']),'w':round(max(1.6,k['w']),2),'h':round(max(1.0,k['h']),2),'a':round(k['a'],3)})
# названия, чьи помещения исчезли при расширении коридоров, — становятся инфо-колоннами
placed=set();[placed.update(o['names']) for o in out];placed|=set(k['name'] for k in KS if k['name'])
wyA,wxA=np.nonzero(walk)
for nm,ps in names.items():
  if nm.startswith('_') or nm in placed:continue
  if any(nm in p or p in nm for p in placed):continue
  x,y=ps[0]
  j=np.argmin((wxA-x)**2+(wyA-y)**2);x,y=wxA[j],wyA[j]
  cat,what=C.get(nm,('misc','Магазин'))
  KS.append({'name':nm,'cat':cat,'what':what,'p':W(x+.5,y+.5),'w':2.4,'h':1.4,'a':0});placed.add(nm)
# entrances: snap to corridor pixel touching outside, direction outward
outside=(L==2)
ob=cv2.dilate(outside.astype(np.uint8),np.ones((3,3),np.uint8)).astype(bool)&walk
oy,ox=np.nonzero(ob)
E=[]
for n_,(x,y) in sorted(ents.items()):
  j=np.argmin((ox-x)**2+(oy-y)**2);x,y=ox[j],oy[j]
  yy,xx=np.mgrid[y-12:y+13,x-12:x+13];mm=outside[yy,xx];d=np.array([(xx[mm]-x).mean(),(yy[mm]-y).mean()]);d/=np.linalg.norm(d)+1e-9
  # door width: count corridor pixels along boundary near point
  E.append({'n':n_,'p':W(x+.5,y+.5),'d':[round(float(d[0]),3),round(float(d[1]),3)]})
# escalators: direction from local corridor PCA
ES=[]
RUN=9.8;HWc=(1.6+2.2)/MPX;HLc=(RUN/2+1.2)/MPX
atriaAll=[(x,y) for x,y in jn if dcm[y,x]>=6.0]
entPx=[np.array(v,float) for v in ents.values()]
def rect_ok(cx,cy,aa):
  ca,sa=math.cos(aa),math.sin(aa);ok=tot=0
  for u in np.linspace(-HLc,HLc,19):
    for v in np.linspace(-HWc,HWc,7):
      px_,py_=int(cx+u*ca-v*sa),int(cy+u*sa+v*ca);tot+=1
      if 0<=px_<CW and 0<=py_<CH and walk[py_,px_]:ok+=1
  return ok/tot
def local_max(x,y,r):
  R=int(r/MPX);y0,x0=max(0,y-R),max(0,x-R);sub=dcm[y0:y+R+1,x0:x+R+1];j=np.unravel_index(np.argmax(sub),sub.shape);return x0+j[1],y0+j[0]
for p in escPts:
  x,y=int(p[0]),int(p[1])
  if not(0<=x<CW and 0<=y<CH):continue
  near=sorted(((math.hypot(ax-x,ay-y)*MPX,ax,ay) for ax,ay in atriaAll))
  if near and near[0][0]<30:_,x,y=near[0]
  x,y=local_max(x,y,6)
  if any(math.hypot(x-q['cx'],y-q['cy'])*MPX<40 for q in ES):continue
  # ближайший вход — туда и «смотрит» эскалатор
  ed=min(entPx,key=lambda e:math.hypot(e[0]-x,e[1]-y));toE=math.atan2(ed[1]-y,ed[0]-x)
  best=None
  for k in range(72):
    th=2*math.pi*k/72;dx,dy=math.cos(th),math.sin(th);free=0
    for st_ in range(1,int(45/MPX)):
      px_,py_=int(x+dx*st_),int(y+dy*st_)
      if not(0<=px_<CW and 0<=py_<CH and walk[py_,px_]):break
      free=st_
    free*=MPX
    if free<RUN+5:continue
    cx,cy=x+dx*(RUN/2+1.5)/MPX,y+dy*(RUN/2+1.5)/MPX
    fr=rect_ok(cx,cy,th)
    if fr<0.995:continue
    sc=0.6*math.cos(th-toE)+0.4*min(1,free/40)
    if best is None or sc>best[0]:best=(sc,cx,cy,th)
  if best is None:print('drop escalator at',x,y);continue
  _,cx,cy,th=best
  ES.append({'px':int(cx),'py':int(cy),'cx':int(x),'cy':int(y),'p':W(cx+.5,cy+.5),'a':round(float(th),3)})
# проём в перекрытии над каждым эскалатором (верхний край остаётся площадкой выхода)
for e in ES:
  th=e['a'];ca,sa=math.cos(th),math.sin(th);cx,cy=e['px'],e['py']
  L0,L1,Hw=-(RUN/2+0.8)/MPX,(RUN/2-1.1)/MPX,1.8/MPX
  pts=np.array([[cx+u*ca-v*sa,cy+u*sa+v*ca] for u,v in [(L0,-Hw),(L1,-Hw),(L1,Hw),(L0,Hw)]],np.int32)
  cv2.fillPoly(vmask:=void.astype(np.uint8),[pts],1);void=vmask.astype(bool)
voids=polys(void,3.0,200,reg=True,minEdge=8.0)
# колонны: только атриумы (широкие перекрёстки) и места эскалаторов
zone=np.zeros_like(walk0)
atria=[(x,y) for x,y in jn if dcm[y,x]>=6.0]
for x,y in atria:disk(x,y,10)
for e in ES:disk(e['px'],e['py'],9)
cols=[]
for vp in voids:
  P=np.array(vp);n_=len(P);acc=0.0;tpos=3.0
  for i in range(n_):
    a_,b_=P[i],P[(i+1)%n_];l=float(np.linalg.norm(b_-a_))
    while tpos<=acc+l:
      q=a_+(b_-a_)*((tpos-acc)/max(l,1e-6));tpos+=9.0
      px,py=int(q[0]/MPX+CX),int(q[1]/MPX+CY)
      if 0<=px<CW and 0<=py<CH and zone[py,px] and all(math.hypot(q[0]-c[0],q[1]-c[1])>7.5 for c in cols):
        cols.append([round(float(q[0]),2),round(float(q[1]),2)])
    acc+=l
def near_esc(q):
  for e in ES:
    ca,sa=math.cos(e['a']),math.sin(e['a']);dx,dz=q[0]-e['p'][0],q[1]-e['p'][1];lx=dx*ca+dz*sa;lz=-dx*sa+dz*ca
    if abs(lx)<=RUN/2+2.0 and abs(lz)<=1.6+1.6:return True
  return False
cols=[c for c in cols if not near_esc(c)]
for e in ES:e.pop('cx',None);e.pop('cy',None)
print('atria',len(atria),'columns',len(cols),'escalators',len(ES))
WC=[]
for x,y in wcs:
  wy,wx=np.nonzero(walk)
  j=np.argmin((wx-x)**2+(wy-y)**2);WC.append(W(wx[j]+.5,wy[j]+.5))
# walk grid downsampled x2, cropped to building bbox
x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
wk=walk[y0:y1,x0:x1]
for k in kiosks:
  pass
H2,W2=(wk.shape[0]+1)//2,(wk.shape[1]+1)//2
pad=np.zeros((H2*2,W2*2),bool);pad[:wk.shape[0],:wk.shape[1]]=wk
wk2=pad.reshape(H2,2,W2,2).mean((1,3))>=0.5
bits=np.packbits(wk2.astype(np.uint8).ravel())
bp=polys(bld,2.0,5000,reg=True,minEdge=4.0)
data={'grid':{'W':int(W2),'H':int(H2),'cell':MPX*2,'x0':round(float((x0-CX)*MPX),3),'z0':round(float((y0-CY)*MPX),3),'b64':base64.b64encode(bits.tobytes()).decode()},
 'bld':bp,'voids':voids,'cols':cols,'stores':out,'kiosks':KS,'esc':ES,'ents':E,'wc':WC}
s=json.dumps(data,ensure_ascii=False,separators=(',',':'),default=float)
open('maxi_data2.json','w').write(s)
np.save('walk_full.npy',walk);json.dump({'CX':float(CX),'CY':float(CY),'jn':[list(map(int,p)) for p in jn]},open('gen4_meta.json','w'));np.save('zone.npy',zone);np.save('L_final.npy',L)
print('bytes',len(s),'kiosks',len(KS),'ents',[e['n'] for e in E],'esc',len(ES))
