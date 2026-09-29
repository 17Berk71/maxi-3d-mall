import json,math
d=json.load(open('maxi_data2.json'));RUN=9.8
def inside(q,e,mx,mz):
  ca,sa=math.cos(e['a']),math.sin(e['a']);dx,dz=q[0]-e['p'][0],q[1]-e['p'][1];lx=dx*ca+dz*sa;lz=-dx*sa+dz*ca
  return abs(lx)<=RUN/2+mx and abs(lz)<=1.55+mz
bad=[]
for e in d['esc']:
  for c in d['cols']:
    if inside(c,e,0.8,0.8):bad.append(('col',c))
  for k in d['kiosks']:
    if inside(k['p'],e,0.8,0.8):bad.append(('info',k['name'],k['p']))
print('escalators',len(d['esc']),'conflicts',bad)
