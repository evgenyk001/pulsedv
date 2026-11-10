// A moving centreline plus a twisting cross section makes a surface, not a stroke.
const TAU=Math.PI*2;
const f=x=>x.toFixed(2);
function closed(points){
 const mid=(a,b)=>`${f((a.x+b.x)/2)} ${f((a.y+b.y)/2)}`;
 let d=`M ${mid(points.at(-1),points[0])}`;
 points.forEach((p,i)=>{d+=` Q ${f(p.x)} ${f(p.y)} ${mid(p,points[(i+1)%points.length])}`});
 return d+' Z';
}
function open(points){
 let d=`M ${f(points[0].x)} ${f(points[0].y)}`;
 for(let i=1;i<points.length-1;i++)d+=` Q ${f(points[i].x)} ${f(points[i].y)} ${f((points[i].x+points[i+1].x)/2)} ${f((points[i].y+points[i+1].y)/2)}`;
 return d+` L ${f(points.at(-1).x)} ${f(points.at(-1).y)}`;
}
export function ribbonGeometry(time,sceneOffset=0,widthScale=1){
 const nodes=[];
 for(let i=0;i<=72;i++){
  const u=i/72,x=-120+1040*u,phase=u*TAU-time*.82;
  const y=342+sceneOffset+112*Math.sin(phase)+27*Math.sin(u*TAU*1.7+time*.53);
  const slope=(112*TAU*Math.cos(phase)+27*TAU*1.7*Math.cos(u*TAU*1.7+time*.53))/1040;
  const length=Math.hypot(1,slope),roll=u*TAU*.9-time*.72;
  const half=(3.5+15*Math.sqrt(Math.cos(roll)**2+.015))*widthScale;
  nodes.push({x,y,nx:-slope/length,ny:1/length,half,roll});
 }
 const edge=amount=>nodes.map(n=>({x:n.x+n.nx*n.half*amount,y:n.y+n.ny*n.half*amount}));
 const band=(a,b)=>closed([...edge(a),...edge(b).reverse()]);
 return {body:band(-1,1),shade:band(.05,1),shine:band(-.86,-.52),edge:open(edge(-1)),nodes};
}
