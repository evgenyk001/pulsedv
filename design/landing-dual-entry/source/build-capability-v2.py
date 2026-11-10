"""Three original 32px Lottie pictograms. 0.65s gestures, stable resting artwork."""
from pathlib import Path
import json
BASE=Path(__file__).resolve().parents[1]/'assets'
def st(k):return {'a':0,'k':k}
def keys(rows):
 out=[]
 for j,(t,v) in enumerate(rows):
  v=v if isinstance(v,list) else [v];r={'t':t,'s':v}
  if j<len(rows)-1:
   nv=rows[j+1][1];r.update(e=nv if isinstance(nv,list) else [nv],i={'x':[.65],'y':[1]},o={'x':[.25],'y':[0]})
  out.append(r)
 return {'a':1,'k':out}
def path(v,c=False):return {'ty':'sh','ks':st({'v':v,'i':[[0,0] for _ in v],'o':[[0,0] for _ in v],'c':c})}
def box(x,y,w,h,r=2):return {'ty':'rc','p':st([x,y]),'s':st([w,h]),'r':st(r),'d':1}
def circle(x,y,r):return {'ty':'el','p':st([x,y]),'s':st([r*2,r*2]),'d':1}
def stroke(w=1.65):return {'ty':'st','c':st([.76,.06,.18,1]),'o':st(100),'w':st(w),'lc':2,'lj':2}
def fill(color=[.76,.06,.18,1]):return {'ty':'fl','c':st(color),'o':st(100),'r':1}
def group(shapes,center=[0,0],scale=None,position=None,rotation=None):return {'ty':'gr','it':shapes+[{'ty':'tr','a':st(center),'p':position or st(center),'s':scale or st([100,100]),'r':rotation or st(0),'o':st(100),'sk':st(0),'sa':st(0)}]}
def pop(center):return dict(center=center,scale=keys([(0,[100,100]),(7,[84,84]),(17,[111,111]),(28,[100,100]),(39,[100,100])]))
plan=[group([box(16,16,24,24),path([[13,4],[13,15],[4,15]]),path([[13,21],[13,28]]),path([[13,15],[20,15]]),stroke()]),group([circle(23,9,2.1),fill()],**pop([23,9]))]
plan.append(group([path([[7,22],[10,22]]),stroke(1.4)],position=keys([(0,[0,0]),(5,[-1,0]),(16,[1,0]),(27,[0,0]),(39,[0,0])])))
house=[group([path([[3,14],[16,3],[29,14]]),path([[7,12],[7,28],[25,28],[25,12]]),stroke()])]
house.append(group([group([circle(16,19,6.2),stroke(1.4)]),group([path([[13,22],[19,16]]),stroke(1.5)]),group([circle(13,16,.9),circle(19,22,.9),fill()])],center=[16,19],rotation=keys([(0,0),(6,-12),(19,3),(29,0),(39,0)])))
# Two open cuffs and interlocking fingers; readable at 32px.
hand=[group([path([[3,9],[7,6],[11,11],[7,17],[3,14]],True),stroke()],position=keys([(0,[0,0]),(5,[-1.8,0]),(16,[.5,0]),(26,[0,0]),(39,[0,0])])),group([path([[29,9],[25,6],[21,11],[25,17],[29,14]],True),stroke()],position=keys([(0,[0,0]),(5,[1.8,0]),(16,[-.5,0]),(26,[0,0]),(39,[0,0])]))]
hand.append(group([path([[9,10],[13,7],[18,7],[23,11],[25,15],[18,23],[15,23],[7,16]]),path([[12,12],[15,9],[18,9],[21,12],[17,16],[14,13]]),path([[12,17],[16,21]]),path([[15,15],[19,19]]),stroke(1.5)],position=keys([(0,[0,0]),(15,[0,0]),(21,[0,1.2]),(28,[0,0]),(39,[0,0])])))
for name,shapes in [('floorplan',plan),('mortgage',house),('handshake',hand)]:
 obj={'v':'5.13.0','fr':60,'ip':0,'op':40,'w':32,'h':32,'nm':'PULSE '+name,'ddd':0,'assets':[],'layers':[{'ddd':0,'ind':1,'ty':4,'nm':name,'sr':1,'ks':{'o':st(100),'r':st(0),'p':st([0,0,0]),'a':st([0,0,0]),'s':st([100,100,100])},'ao':0,'shapes':shapes,'ip':0,'op':40,'st':0,'bm':0}]}
 (BASE/('capability-'+name+'.json')).write_text(json.dumps(obj,separators=(',',':')))
