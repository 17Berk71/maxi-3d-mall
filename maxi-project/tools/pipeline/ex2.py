import numpy as np,cv2
from PIL import Image
exec(open('ex.py').read().split("m=((light")[0])
base=(light|col).astype(np.uint8)*255
# drop legend + text block (outside building region)
base[255:,:200]=0; base[:200,612:]=0; base[:40,:]=0
for k in (15,21,27):
  m=cv2.morphologyEx(base,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(k,k)))
  h,w=m.shape;ff=m.copy();mk=np.zeros((h+2,w+2),np.uint8);cv2.floodFill(ff,mk,(0,0),128)
  inside=(ff!=128)
  n,lab,st,_=cv2.connectedComponentsWithStats(inside.astype(np.uint8),4)
  big=1+np.argmax(st[1:,4]);bld=(lab==big)
  print(k,bld.sum()*0.72**2)
  vis=np.zeros((h,w,3),np.uint8);vis[bld]=(90,90,90);vis[bld&col]=(200,60,40);vis[bld&purple]=(160,120,170);vis[bld&green]=(60,170,100)
  Image.fromarray(vis).resize((1560,792),Image.NEAREST).save('bld%d.png'%k);np.save('bld%d.npy'%k,bld)
