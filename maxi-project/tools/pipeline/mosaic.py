import numpy as np,cv2,json
from PIL import Image
exec(open('fit2.py').read().split("mos={}")[0])
# affine (scale+translate) matrices to M frame
def aff(T):
  p0=T([(0,0)])[0];p1=T([(1000,0)])[0];s=(p1[0]-p0[0])/1000;return s,p0
shots={'W':(TWM,),'M':(lambda X:np.array(X,float),),'F':(lambda X:TWM(TFW(X)),),'E':(TEM,)}
A={}
for k,(T,) in shots.items():
  s,t=aff(T);A[k]=(s,t)
imgs={k:np.array(Image.open('y%s.png'%k).convert('RGB')).astype(int) for k in 'WMFE'}
# bounds
xs=[];ys=[]
for k,im in imgs.items():
  s,t=A[k];h,w=im.shape[:2];xs+= [t[0],t[0]+w*s];ys+=[t[1],t[1]+h*s]
X0,Y0=int(np.floor(min(xs)))-10,int(np.floor(min(ys)))-10;X1,Y1=int(np.ceil(max(xs)))+10,int(np.ceil(max(ys)))+10
CW,CH=X1-X0,Y1-Y0;print('canvas',CW,CH,'origin',X0,Y0,{k:(round(v[0],3),v[1].round(1).tolist()) for k,v in A.items()})
def classify(a,k):
  h,w=a.shape[:2];R,G,B=a[...,0],a[...,1],a[...,2]
  a8=a.astype(np.uint8)
  mx=cv2.dilate(a8,np.ones((3,3),np.uint8)).astype(int);mn=cv2.erode(a8,np.ones((3,3),np.uint8)).astype(int)
  flat=(mx-mn).max(2)<=4
  cls=np.full((h,w),5,np.uint8)
  def near(c,t):return (abs(R-c[0])+abs(G-c[1])+abs(B-c[2]))<=t
  corr=near((124,132,152),14)|near((133,138,153),10)
  park=near((90,106,147),12)
  dark=near((37,46,65),12)|near((40,56,82),10)|near((32,40,64),10)|near((24,24,24),8)|near((30,36,52),10)
  white=a.min(2)>185
  cyan=(B>150)&(R<70)
  cls[flat&corr]=1
  cls[flat&(park|dark)]=2
  room=flat&~(corr|park|dark|white|cyan)
  cls[room]=3
  ui=np.zeros((h,w),bool)
  ui[:80,720:]=1;ui[190:620,1045:]=1;ui[860:,990:]=1;ui[905:,610:]=1;ui[:55,:55]=1
  if k=='E':ui[:45,120:175]=1
  if k=='M':ui[330:405,600:795]=1
  cls[ui]=255
  return cls
lab=np.full((CH,CW),255,np.uint8);src=np.full((CH,CW),255,np.uint8)
for k in ['E','F','M','W']:# later overwrite earlier -> W highest priority
  s,t=A[k];c=classify(imgs[k],k)
  Mx=np.array([[s,0,t[0]-X0],[0,s,t[1]-Y0]],np.float32)
  wc=cv2.warpAffine(c,Mx,(CW,CH),flags=cv2.INTER_NEAREST,borderValue=255)
  sel=wc!=255;lab[sel]=wc[sel];src[sel]='EFMW'.index(k)
np.save('mos_lab.npy',lab);json.dump({'X0':X0,'Y0':Y0,'CW':CW,'CH':CH},open('mos_meta.json','w'))
pal={0:(0,0,0),1:(200,200,210),2:(60,70,90),3:(40,90,140),4:(255,200,0),5:(255,0,255),255:(0,0,0)}
vis=np.zeros((CH,CW,3),np.uint8)
for k,v in pal.items():vis[lab==k]=v
Image.fromarray(vis).resize((CW//2,CH//2),Image.NEAREST).save('mos.png')
