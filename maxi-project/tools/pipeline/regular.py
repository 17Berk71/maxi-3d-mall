import numpy as np,cv2,math
FAM=None
def families(L,ids):
  H=np.zeros(900)
  for r in ids:
    m=(L==r).astype(np.uint8)
    cs,_=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    for c in cs:
      ap=cv2.approxPolyDP(c,2.5,True)[:,0,:].astype(float)
      for i in range(len(ap)):
        a,b=ap[i],ap[(i+1)%len(ap)];d=b-a;l=np.hypot(*d)
        if l<8:continue
        H[int((math.degrees(math.atan2(d[1],d[0]))%90)*10)%900]+=l
  k=np.ones(31);Hs=np.convolve(np.r_[H[-15:],H,H[:15]],k,'same')[15:-15]
  peaks=[]
  for i in np.argsort(-Hs):
    if Hs[i]<Hs.max()*0.12:break
    if all(min(abs(i-p),900-abs(i-p))>60 for p in peaks):peaks.append(i)
  return [p/10 for p in peaks]
def _snap_dir(ang,fams,tol):
  best=None
  for f in fams:
    for base in (f,f+90):
      d=((ang-base+90)%180)-90
      if abs(d)<=tol and (best is None or abs(d)<abs(best[0])):best=(d,ang-d)
  return best[1] if best else None
def regularize(pts,fams,tol=9.0,minEdge=3.0,maxMove=10.0):
  """pts: Nx2 polygon (px). Snap edges to wall families, rebuild corners as line intersections."""
  P=np.array(pts,float)
  # drop tiny edges by merging
  changed=True
  while changed and len(P)>3:
    changed=False
    for i in range(len(P)):
      a,b=P[i],P[(i+1)%len(P)]
      if np.hypot(*(b-a))<minEdge:
        P[i]=(a+b)/2;P=np.delete(P,(i+1)%len(P),0);changed=True;break
  n=len(P)
  if n<3:return pts
  lines=[]
  for i in range(n):
    a,b=P[i],P[(i+1)%n];d=b-a;l=np.hypot(*d);ang=math.degrees(math.atan2(d[1],d[0]))
    s=_snap_dir(ang,fams,tol) if l>=minEdge else None
    th=math.radians(s if s is not None else ang)
    lines.append(((a+b)/2,np.array([math.cos(th),math.sin(th)]),l))
  # merge consecutive parallel lines
  out=[]
  for i in range(n):
    (p1,d1,_),(p2,d2,_)=lines[i-1],lines[i]
    cr=d1[0]*d2[1]-d1[1]*d2[0]
    if abs(cr)<0.08:
      # parallel: corner = projection of original vertex onto average line (keep step small)
      v=P[i];q=(v-p1)@d1*d1+p1;q2=(v-p2)@d2*d2+p2;out.append((q+q2)/2);continue
    t=((p2-p1)[0]*d2[1]-(p2-p1)[1]*d2[0])/cr;x=p1+d1*t
    if np.hypot(*(x-P[i]))>maxMove:x=P[i]
    out.append(x)
  Q=np.array(out)
  # remove collinear / duplicate vertices
  keep=[]
  for i in range(len(Q)):
    a,b,c=Q[i-1],Q[i],Q[(i+1)%len(Q)]
    if np.hypot(*(b-a))<0.5:continue
    u,v=b-a,c-b;cr=abs(u[0]*v[1]-u[1]*v[0])/(np.hypot(*u)*np.hypot(*v)+1e-9)
    if cr<0.02 and u@v>0:continue
    keep.append(b)
  Q=np.array(keep) if len(keep)>=3 else P
  a0=abs(cv2.contourArea(np.array(pts,np.float32)));a1=abs(cv2.contourArea(Q.astype(np.float32)))
  if a0>0 and abs(a1-a0)/a0>0.2:return P
  return Q
def trace(mask,eps):
  cs,_=cv2.findContours(mask.astype(np.uint8),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
  if not cs:return None
  c=max(cs,key=cv2.contourArea)
  return cv2.approxPolyDP(c,eps,True)[:,0,:].astype(float)+0.5
def cleanup(P,minLen=0.8,spikeCos=0.85):
  P=[np.array(p,float) for p in P]
  for _ in range(60):
    n=len(P);changed=False
    if n<=3:break
    for i in range(n):
      a,b,c=P[i-1],P[i],P[(i+1)%n];u,v=a-b,c-b
      cos=u@v/(np.linalg.norm(u)*np.linalg.norm(v)+1e-9)
      if cos>spikeCos or np.linalg.norm(u)<1e-3:P.pop(i);changed=True;break
    if changed:continue
    for i in range(n):
      a,b,c,d_=P[i-1],P[i],P[(i+1)%n],P[(i+2)%n]
      if np.linalg.norm(c-b)<minLen:
        d1,d2=b-a,d_-c;cr=d1[0]*d2[1]-d1[1]*d2[0]
        x=None
        if abs(cr)>1e-6:
          t=((c-a)[0]*d2[1]-(c-a)[1]*d2[0])/cr;x=a+d1*t
          if np.linalg.norm(x-(b+c)/2)>1.2:x=None
        if x is None:x=(b+c)/2
        P[i]=x;P.pop((i+1)%n);changed=True;break
    if not changed:break
  return P
