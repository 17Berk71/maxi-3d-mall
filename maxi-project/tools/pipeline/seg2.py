import numpy as np,cv2,json,re
from scipy import ndimage as ndi
exec(open('cats.py').read())
exec(open('fit2.py').read().split("import json")[0])
meta=json.load(open('mos_meta.json'));X0,Y0,CW,CH=meta['X0'],meta['Y0'],meta['CW'],meta['CH']
L=np.load('seg_L.npy')
MPX=0.158
# building = largest component of non-outside (after opening to cut thin outside lines)
nb=(L!=2).astype(np.uint8)
nbo=cv2.morphologyEx(nb,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(9,9)))
n,cc,st_,_=cv2.connectedComponentsWithStats(nbo,connectivity=4)
big=1+np.argmax(st_[1:,4]);bld=(cc==big)
bld=cv2.morphologyEx(bld.astype(np.uint8),cv2.MORPH_CLOSE,np.ones((5,5),np.uint8)).astype(bool)
bld=ndi.binary_fill_holes(bld)
L[~bld]=2
# pixels inside bld labelled outside -> nearest non-outside
bad=bld&(L==2)
_,ind=ndi.distance_transform_edt(L==2,return_indices=True)
L[bad]=L[ind[0][bad],ind[1][bad]]
# corridor: keep largest component; small corridor bits -> nearest room
C=(L==1)
n,cl,cs,_=cv2.connectedComponentsWithStats(C.astype(np.uint8),connectivity=4)
bigc=1+np.argmax(cs[1:,4]);
stray=C&(cl!=bigc)
rooms=L>=10
_,ind=ndi.distance_transform_edt(~rooms,return_indices=True)
L[stray]=L[ind[0][stray],ind[1][stray]]
# relabel rooms compactly, drop tiny ones into neighbours
ids=np.unique(L[L>=10])
areas={i:(L==i).sum() for i in ids}
for i,a in areas.items():
  if a<25:
    m=L==i;L[m]=0
z=L==0
_,ind=ndi.distance_transform_edt(z,return_indices=True);L[z]=L[ind[0][z],ind[1][z]]
walk=(L==1)
dt=ndi.distance_transform_edt(walk)*MPX
# islands: rooms fully surrounded by corridor (boundary neighbours are all corridor) and small
ids=np.unique(L[L>=10]);info={}
for i in ids:
  m=L==i;a=int(m.sum());ys,xs=np.nonzero(m)
  ring=cv2.dilate(m.astype(np.uint8),np.ones((3,3),np.uint8)).astype(bool)&~m
  nbr=L[ring];fc=(nbr==1).mean() if len(nbr) else 0
  info[int(i)]={'area_m2':a*MPX*MPX,'corrfrac':float(fc),'bbox':[int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())],'c':[float(xs.mean()),float(ys.mean())]}
islands=[i for i,v in info.items() if v['corrfrac']>0.92 and v['area_m2']<60]
print('rooms',len(ids),'islands',len(islands))
np.save('seg_L2.npy',L);json.dump({'info':info,'islands':islands},open('seg2.json','w'))
from PIL import Image
rng=np.random.default_rng(2);cols=rng.integers(50,230,(L.max()+1,3)).astype(np.uint8)
vis=cols[L];vis[L==1]=(225,225,232);vis[L==2]=(40,40,50)
for i in islands:vis[L==i]=(255,0,0)
Image.fromarray(vis).resize((CW//2,CH//2),Image.NEAREST).save('seg2.png')
