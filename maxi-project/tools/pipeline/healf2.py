"""Чистка карты прохода 2 этажа: залатать «воздушные карманы» —
незанятый пол (внутри здания, не проём, не магазин, не островок и не колонна),
который в маске прохода оказался непроходимым. Это и есть «невидимые стены».
Запуск: python3 tools/pipeline/healf2.py (идемпотентно; правит src/data/maxi-floor2.json)."""
import json,base64,numpy as np,cv2,sys
from scipy import ndimage as ndi
R=sys.argv[1] if len(sys.argv)>1 else '.'
d=json.load(open(R+'/src/data/maxi-data.json'));fp=R+'/src/data/maxi-floor2.json';d2=json.load(open(fp))
g=d['grid'];GW,GH,C=g['W'],g['H'],g['cell'];x0,z0=g['x0'],g['z0']
walk=np.unpackbits(np.frombuffer(base64.b64decode(d2['walk']['b64']),np.uint8))[:GW*GH].reshape(GH,GW).copy()
def P(p):return np.round((np.array(p)-[x0,z0])/C-0.5).astype(np.int32)
def fill(ps):
    m=np.zeros((GH,GW),np.uint8)
    for p in ps:cv2.fillPoly(m,[P(p)],1)
    return m
bld=fill(d2['bld']);void=fill(d2['voids']);st=fill([s['poly'] for s in d2['stores']])
non=(bld==0)|(void==1)|(st==1)
dist=ndi.distance_transform_edt(~non)*C
cand=(~non)&(walk==0)&(dist>=0.45)
lab,n=ndi.label(cand)
cols=np.array(d['cols'],float)[:,:2];ks=np.array([k['p'] for k in d2['kiosks']],float)
esc=np.array([e['p'] for e in d2['esc']],float)
fixed=0
for i in range(1,n+1):
    ys,xs=np.where(lab==i);a=len(xs)*C*C
    if a>12:continue
    cx,cz=xs.mean()*C+x0+C/2,ys.mean()*C+z0+C/2
    if np.min(np.hypot(cols[:,0]-cx,cols[:,1]-cz))<1.6 or np.min(np.hypot(ks[:,0]-cx,ks[:,1]-cz))<1.6 or np.min(np.hypot(esc[:,0]-cx,esc[:,1]-cz))<7:continue
    walk[ys,xs]=1;fixed+=len(xs)
d2['walk']['b64']=base64.b64encode(np.packbits(walk.reshape(-1))).decode()
json.dump(d2,open(fp,'w'),ensure_ascii=False,separators=(',',':'))
print('healed cells',fixed,'≈',round(fixed*C*C,1),'m2')
