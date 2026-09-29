import numpy as np,cv2
from PIL import Image
a=np.array(Image.open('plan.png').convert('RGB')).astype(int)
R,G,B=a[...,0],a[...,1],a[...,2]
mx=a.max(2);mn=a.min(2);sat=mx-mn;br=a.mean(2)
light=(br>188)&(sat<30)
red=(R>180)&(G<120)&(B<90)
pink=(R>200)&(G<90)&(B>80)
purple=(abs(R-166)<12)&(abs(G-124)<14)&(abs(B-174)<12)
green=(G>150)&(R<110)&(B<140)
cyan=(B>150)&(R<80)&(G>140)
blue=(B>120)&(R<60)&(G<110)
col=red|pink|purple|green|cyan|blue
m=((light|col)*255).astype(np.uint8)
m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
h,w=m.shape;ff=m.copy();mask=np.zeros((h+2,w+2),np.uint8);cv2.floodFill(ff,mask,(0,0),128)
inside=(ff!=128)
n,lab,st,_=cv2.connectedComponentsWithStats(inside.astype(np.uint8),4)
big=1+np.argmax(st[1:,4]);bld=(lab==big)
print('building px',bld.sum(), 'area m2 @0.72^2', bld.sum()*0.72**2)
vis=np.zeros((h,w,3),np.uint8);vis[bld]=(90,90,90);vis[bld&col]=(200,60,40);vis[bld&purple]=(160,120,170);vis[bld&green]=(60,170,100)
Image.fromarray(vis).resize((1560,792),Image.NEAREST).save('bld.png')
np.save('bld.npy',bld)
