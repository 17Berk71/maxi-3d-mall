import numpy as np,json,cv2,math,base64
d=json.load(open('maxi_data2.json'));G=d['grid'];cell=G['cell']
bits=np.frombuffer(base64.b64decode(G['b64']),np.uint8);wk=np.unpackbits(bits)[:G['W']*G['H']].reshape(G['H'],G['W']).astype(bool)
def rect_mask(cx,cz,a,hl,hw):
  m=np.zeros_like(wk);r=int(math.hypot(hl,hw)/cell)+2;ci,cj=int((cx-G['x0'])/cell),int((cz-G['z0'])/cell)
  for j in range(cj-r,cj+r+1):
    for i in range(ci-r,ci+r+1):
      if 0<=i<G['W'] and 0<=j<G['H']:
        px,pz=G['x0']+(i+.5)*cell-cx,G['z0']+(j+.5)*cell-cz;lx=px*math.cos(a)+pz*math.sin(a);lz=-px*math.sin(a)+pz*math.cos(a)
        if abs(lx)<=hl and abs(lz)<=hw:m[j,i]=1
  return m
obs=[]
for e in d['esc']:obs.append(('e',e,rect_mask(e['p'][0],e['p'][1],e['a'],5.2,1.8)))
for c in d['cols']:obs.append(('c',c,rect_mask(c[0],c[1],0,.6,.6)))
rad=int(math.ceil(0.4/cell));ker=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(2*rad+1,2*rad+1))
def comps(active):
  free=wk.copy()
  for t,o,m in active:free&=~m
  fe=cv2.erode(free.astype(np.uint8),ker)
  n,l,st,_=cv2.connectedComponentsWithStats(fe,connectivity=4);return n,l,st
active=list(obs);removed=[]
for it in range(40):
  n,l,st=comps(active)
  big=1+np.argmax(st[1:,4]);smalls=[j for j in range(1,n) if j!=big and st[j,4]*cell*cell>2.0]
  if not smalls:break
  # obstacle touching most small-comp cells (dilated)
  sm=np.isin(l,smalls);smd=cv2.dilate(sm.astype(np.uint8),np.ones((2*rad+5,2*rad+5),np.uint8)).astype(bool)
  bd=cv2.dilate((l==big).astype(np.uint8),np.ones((2*rad+5,2*rad+5),np.uint8)).astype(bool)
  cand=[(int((m&smd).sum()>0)+int((m&bd).sum()>0),(m&smd).sum(),i) for i,(t,o,m) in enumerate(active) if t!='e' or True]
  cand=[c for c in cand if c[0]==2]
  if not cand:break
  cand.sort(key=lambda c:(-c[1]))
  i=cand[0][2];removed.append((active[i][0],active[i][1].get('name') if isinstance(active[i][1],dict) else active[i][1]));active.pop(i)
n,l,st=comps(active)
print('removed',removed,'final comps',n-1,sorted(st[1:,4]*cell*cell,reverse=True)[:5])
keepK=[o for t,o,m in active if t=='k'];keepE=[o for t,o,m in active if t=='e'];keepC=[o for t,o,m in active if t=='c']
# removed kiosks with names -> keep as flat floor stand (non-blocking) flag
d['esc']=keepE;d['cols']=keepC
json.dump(d,open('maxi_data2.json','w'),ensure_ascii=False,separators=(',',':'))
