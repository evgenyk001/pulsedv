"""Original monoline Lottie icons: permanent silhouettes, short semantic accents."""
from pathlib import Path
import json
BASE=Path(__file__).resolve().parents[1]/'assets'
RED=[.76,.075,.18,1];MUTED=[.76,.075,.18,1]
def static(k):return dict(a=0,k=k)
def keyframes(values):
 k=[]
 for index,(t,value) in enumerate(values):
  row=dict(t=t,s=value if isinstance(value,list) else [value])
  if index<len(values)-1:row.update(e=values[index+1][1] if isinstance(values[index+1][1],list) else [values[index+1][1]],i=dict(x=[.67],y=[1]),o=dict(x=[.3],y=[0]))
  k.append(row)
 return dict(a=1,k=k)
def line(points,closed=False,ins=None,outs=None):return dict(ty='sh',ks=static(dict(v=points,i=ins or [[0,0] for p in points],o=outs or [[0,0] for p in points],c=closed)),nm='Precise monoline')
def circle(x,y,r):return dict(ty='el',p=static([x,y]),s=static([r*2,r*2]),d=1,nm='Rounded detail')
def box(x,y,w,h,r):return dict(ty='rc',p=static([x,y]),s=static([w,h]),r=static(r),d=1,nm='Soft corner')
def stroke(width=1.35,opacity=100):return dict(ty='st',c=static(RED),o=static(opacity),w=static(width),lc=2,lj=2,ml=4,bm=0,nm='PULSE burgundy')
def fill():return dict(ty='fl',c=static(RED),o=static(100),r=1,bm=0,nm='Ink accent')
def transform(opacity=None):return dict(ty='tr',p=static([0,0]),a=static([0,0]),s=static([100,100]),r=static(0),o=opacity or static(100),sk=static(0),sa=static(0))
def group(shapes,opacity=None):return dict(ty='gr',it=shapes+[transform(opacity)],nm='Monoline group')
def accent(shapes,start=0,trim=False):
 if trim:shapes=shapes+[dict(ty='tm',s=static(0),e=keyframes([(start,0),(start+35,100),(119,100)]),o=static(0),m=1,nm='Measured stroke')]
 return group(shapes,keyframes([(0,0),(start+5,0),(start+20,100),(start+55,100),(min(116,start+78),0),(119,0)]))
base_build=[line([[3,21],[21,21]]),line([[5,21],[5,9],[11,6],[11,21]]),line([[11,21],[11,4],[19,2],[19,21]]),stroke()]
windows=[line([[8,y],[8,y+1.3]]) for y in [11,16]]+[line([[15,y],[15,y+1.3]]) for y in [7,12,17]]
build=[group(base_build),group(windows+[stroke(1.3,65)])]
for i,y in enumerate([17,12,7]):build.append(accent([line([[15,y],[15,y+1.3]]),stroke(1.75)],i*9))
calculator=[group([box(12,12,14,20,2.5),box(12,6.2,8,3,.6),stroke()])]
calculator.append(group([circle(x,y,.55) for y in [11,15,19] for x in [8,12,16]]+[stroke(1,65)]))
calculator.append(accent([line([[9.5,6.2],[14.5,6.2]]),stroke(1.05)],0,True))
for i,(x,y) in enumerate([(8,11),(12,15),(16,19)]):calculator.append(accent([circle(x,y,.8),fill()],12+i*10))
partners=[group([circle(9,7,3),line([[3,21],[3,17],[9,13],[15,17],[15,21]],ins=[[0,0],[0,0],[-3,0],[0,-2.2],[0,0]],outs=[[0,0],[0,-2.2],[3,0],[0,0],[0,0]]),stroke()]),group([circle(17.3,7.8,2.4),line([[18,14],[21,17],[21,21]],ins=[[0,0],[0,-2],[0,0]],outs=[[1.7,0],[0,0],[0,0]]),stroke(1.25,65)])]
partners.append(accent([line([[7,18],[12,20],[18,17]],ins=[[0,0],[-2,0],[-1,2]],outs=[[1,1.5],[2,0],[0,0]]),stroke(1.3)],10,True))
for name,shapes in [('buildings',build),('calculator',calculator),('partners',partners)]:
 layer=dict(ddd=0,ind=1,ty=4,nm=name,sr=1,ks=dict(o=static(100),r=static(0),p=static([0,0,0]),a=static([0,0,0]),s=static([100,100,100])),ao=0,shapes=shapes,ip=0,op=120,st=0,bm=0)
 asset=dict(v='5.13.0',fr=60,ip=0,op=120,w=24,h=24,nm='PULSE '+name,ddd=0,assets=[],layers=[layer])
 (BASE/('capability-'+name+'.json')).write_text(json.dumps(asset,separators=(',',':')))
