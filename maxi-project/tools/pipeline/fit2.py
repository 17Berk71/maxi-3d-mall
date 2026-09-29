import numpy as np
exec(open('labels.py').read())
def st(P,Q,rot=False):
  P=np.array(P,float);Q=np.array(Q,float);mp,mq=P.mean(0),Q.mean(0);p,q=P-mp,Q-mq
  zp=p[:,0]+1j*p[:,1];zq=q[:,0]+1j*q[:,1];a=(np.conj(zp)@zq)/(np.conj(zp)@zp)
  if not rot:a=abs(a)*np.sign(a.real) if False else (np.real(np.conj(zp)@zq)/np.real(np.conj(zp)@zp))
  def T(X):
    X=np.atleast_2d(np.array(X,float))-mp;z=(X[:,0]+1j*X[:,1])*a;return np.c_[z.real,z.imag]+mq
  return T,a
def pair(A,B,skip=()):
  ks=[k for k in A if k in B and not k.startswith('_') and k not in skip];return [A[k] for k in ks],[B[k] for k in ks]
TEM,a1=st(*pair(E,M,('Мир часов','Бриллиантовая ручка')))
TWM,a2=st(*pair(W,M))
TFW,a3=st(*pair(F,W))
print('scales',a1,a2,a3)
mos={}
def add(D,T,tag):
  for k,v in D.items():
    p=T([v])[0];mos.setdefault(k,[]).append((tag,p))
add(M,lambda X:np.array(X,float),'M');add(E,TEM,'E');add(W,TWM,'W');add(F,lambda X:TWM(TFW(X)),'F')
import json
json.dump({k:[(t,list(map(float,p))) for t,p in v] for k,v in mos.items()},open('mosaic.json','w'),ensure_ascii=False)
for k,v in mos.items():
  if len(v)>1:
    ps=np.array([p for _,p in v]);sp=np.ptp(ps,0).max()
    if sp>30:print('disagree',k,[(t,np.round(p).tolist()) for t,p in v])
