"""Trace local Caveat ink into ordered pen masks; no runtime font measurement."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import math,json
BASE=Path(__file__).resolve().parents[1]
SCALE=8;SIZE=28;MARGIN=12
font=ImageFont.truetype(str(BASE/'assets/caveat-500.ttf'),SIZE*SCALE)

def skeleton(a):
 a=np.pad(a,1)
 for _ in range(300):
  changed=False
  for phase in [0,1]:
   p=[np.roll(a,(dy,dx),(0,1)) for dy,dx in [(1,0),(1,-1),(0,-1),(-1,-1),(-1,0),(-1,1),(0,1),(1,1)]]
   n=sum(x.astype('uint8') for x in p)
   switches=sum((~p[i]&p[(i+1)%8]).astype('uint8') for i in range(8))
   cut=a&(n>=2)&(n<=6)&(switches==1)
   if phase==0:cut&=~(p[0]&p[2]&p[4])&~(p[2]&p[4]&p[6])
   else:cut&=~(p[0]&p[2]&p[6])&~(p[0]&p[4]&p[6])
   if cut.any():a[cut]=False;changed=True
  if not changed:break
 return a[1:-1,1:-1]

def trails(pixels):
 nodes={tuple(x) for x in np.argwhere(pixels)}
 graph={p:{(p[0]+dy,p[1]+dx) for dy in [-1,0,1] for dx in [-1,0,1] if (dy or dx) and (p[0]+dy,p[1]+dx) in nodes} for p in nodes}
 edges={tuple(sorted((p,q))) for p in nodes for q in graph[p]}
 last=min(nodes,key=lambda p:(p[1],-p[0])) if nodes else (0,0)
 out=[]
 while edges:
  endpoints={p for e in edges for p in e}
  start=min(endpoints,key=lambda p:((p[0]-last[0])**2+(p[1]-last[1])**2))
  path=[start];prev=None;curr=start
  while True:
   choices=[q for q in graph[curr] if tuple(sorted((curr,q))) in edges]
   if not choices:break
   if prev is None:q=min(choices,key=lambda p:(p[1],p[0]))
   else:
    vy,vx=curr[0]-prev[0],curr[1]-prev[1]
    q=max(choices,key=lambda p:((p[0]-curr[0])*vy+(p[1]-curr[1])*vx)/math.hypot(p[0]-curr[0],p[1]-curr[1]))
   edges.remove(tuple(sorted((curr,q))));path.append(q);prev,curr=curr,q
  if len(path)>3:out.append(path)
  last=path[-1]
 return out

def simplify(points,tol=1.25):
 if len(points)<3:return points
 a=np.array(points[0]);b=np.array(points[-1]);v=b-a
 delta=np.array(points)-a
 if np.linalg.norm(v):dist=np.abs(v[0]*delta[:,1]-v[1]*delta[:,0])/np.linalg.norm(v)
 else:dist=np.linalg.norm(delta,axis=1)
 i=int(dist.argmax())
 if dist[i]<=tol:return [points[0],points[-1]]
 return simplify(points[:i+1],tol)[:-1]+simplify(points[i:],tol)

letters=[];x=3;total=0
for index,char in enumerate('наши соц. сети'):
 advance=font.getlength(char)/SCALE
 if char==' ':x+=advance;continue
 left,top,right,bottom=font.getbbox(char,anchor='ls')
 image=Image.new('L',(right-left+2*MARGIN,bottom-top+2*MARGIN))
 ImageDraw.Draw(image).text((MARGIN-left,MARGIN-top),char,font=font,fill=255,anchor='ls')
 paths=[]
 for points in trails(skeleton(np.array(image)>100)):
  points=simplify(points)
  coords=[(x+(p[1]-MARGIN+left)/SCALE,38+(p[0]-MARGIN+top)/SCALE) for p in points]
  length=sum(math.dist(a,b) for a,b in zip(coords,coords[1:]))
  # Ignore tiny graph junctions: the round pen brush covers them from neighbours.
  if length<.4:continue
  d='M'+' L'.join(f'{px:.2f} {py:.2f}' for px,py in coords)
  paths.append((d,length));total+=length
 if not paths:
  yy,xx=np.argwhere(np.array(image)>100).mean(axis=0)
  px=x+(xx-MARGIN+left)/SCALE;py=38+(yy-MARGIN+top)/SCALE
  paths=[(f'M{px:.2f} {py:.2f} l .01 .01',.3)];total+=.3
 letters.append((index,char,x,paths));x+=advance

# One continuous pen path per letter avoids sub-frame stop/start fragments.
clock=.14;svg=[];masks=[]
for index,char,x,paths in letters:
 length=sum(item[1] for item in paths)
 duration=max(.055,1.45*length/total)
 d=' '.join(item[0] for item in paths)
 stroke=f'<path class="ink-pen" pathLength="1" d="{d}" style="--ink-start:{clock:.3f}s;--ink-time:{duration:.3f}s"/>'
 masks.append(f'<mask id="ink-letter-{index}" maskUnits="userSpaceOnUse" x="0" y="0" width="190" height="72"><g class="ink-pen-mask">'+stroke+'</g></mask>')
 svg.append(f'<text class="social-handwriting" x="{x:.3f}" y="38" mask="url(#ink-letter-{index})">{char}</text>')
 clock+=duration+.012+(.065 if index in [3,8] else 0)
print(json.dumps({'letters':len(letters),'strokes':sum(len(x[3]) for x in letters),'writingEnds':round(clock,3)}))
(BASE/'source/social-ink-fragment.html').write_text('<defs>'+''.join(masks)+'</defs>\n'+''.join(svg))
