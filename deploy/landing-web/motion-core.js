// Exact critically damped motion: changing a target retains position and velocity.
export const clamp01=x=>Math.max(0,Math.min(1,x));
export function smootherstep(x){const t=clamp01(x);return t*t*t*(t*(t*6-15)+10)}
export function criticalStep(position,velocity,target,dt,omega=4.6){
 if(dt<=0)return [position,velocity];
 const offset=position-target,j=velocity+omega*offset,e=Math.exp(-omega*dt);
 return [target+(offset+j*dt)*e,(velocity-omega*j*dt)*e];
}
export const FLOW_SCENES=[
 [438,310,185,150,500,605],
 [395,375,240,620,480,135],
 [470,265,160,220,520,570],
 [390,380,230,150,460,680],
 [445,245,195,690,500,100]
];
export function flowPath(c,index,time){
 const depth=index-2,off=depth*12.5;
 const breath=Math.sin(time*.23+depth*.11)*7;
 const curl=Math.sin(time*.17+depth*.21)*10;
 const f=x=>x.toFixed(2);
 return `M -120 ${f(c[0]+off+breath)} C ${f(c[2])} ${f(c[3]+off+curl)}, ${f(c[4])} ${f(c[5]+off-curl*.65)}, 810 ${f(c[1]+off-breath*.6)}`;
}
