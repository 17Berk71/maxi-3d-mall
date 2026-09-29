import numpy as np,cv2,json,re
from scipy import ndimage as ndi
exec(open('fit2.py').read().split("import json")[0])
meta=json.load(open('mos_meta.json'));X0,Y0,CW,CH=meta['X0'],meta['Y0'],meta['CW'],meta['CH']
lab=np.load('mos_lab.npy')
def g(k):return np.mean([p for _,p in mos[k]],0)
anc={'_KK':(437,213),'_ENT3':(430,270),'_ENT4':(485,339),'_ENT5':(582,337),'Heart of Coffee':(172,213)}
TMP,aMP=st([g(k) for k in anc],list(anc.values()),rot=True)
# plan -> M affine (inverse similarity)
Pm=np.array([[0,0],[700,0],[0,350]],float);Pp=TMP(Pm)
Aff=cv2.getAffineTransform(Pp.astype(np.float32),(Pm-[X0,Y0]).astype(np.float32))
bldP=np.load('bld15.npy').astype(np.uint8)
planB=cv2.warpAffine(bldP,Aff,(CW,CH),flags=cv2.INTER_NEAREST)>0
ek=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3))
corr=cv2.morphologyEx((lab==1).astype(np.uint8),cv2.MORPH_OPEN,ek)>0
outside=cv2.morphologyEx((lab==2).astype(np.uint8),cv2.MORPH_OPEN,ek)>0
roomc=(lab==3)
n,rl,stt,_=cv2.connectedComponentsWithStats(roomc.astype(np.uint8),connectivity=4)
L=np.zeros((CH,CW),np.int32)  # 0 unfilled, 1 corridor, 2 outside, >=10 rooms
L[corr]=1;L[outside]=2
keep=np.nonzero(stt[1:,4]>=40)[0]+1
idmap=np.zeros(n,np.int32);idmap[keep]=np.arange(len(keep))+10
rr=idmap[rl];L[(rr>0)]=rr[rr>0]
nodata=(lab==255)
# nodata outside plan building -> outside; inside -> rooms only
L[nodata&~planB]=2
fillR=nodata&planB&(L==0)
todo=(L==0)&~fillR
_,ind=ndi.distance_transform_edt(L==0,return_indices=True)
L2=L.copy();L2[todo]=L[ind[0][todo],ind[1][todo]]
roomsOnly=L2>=10
_,ind2=ndi.distance_transform_edt(~roomsOnly,return_indices=True)
L2[fillR]=L2[ind2[0][fillR],ind2[1][fillR]]
L=L2
np.save('seg_L.npy',L)
json.dump({'Aff':Aff.tolist(),'aMP':[aMP.real,aMP.imag]},open('seg_meta.json','w'))
print('rooms',len(np.unique(L[L>=10])))
from PIL import Image
rng=np.random.default_rng(2);cols=rng.integers(50,230,(L.max()+1,3)).astype(np.uint8)
vis=cols[L];vis[L==1]=(225,225,232);vis[L==2]=(40,40,50)
Image.fromarray(vis).resize((CW//2,CH//2),Image.NEAREST).save('seg.png')
