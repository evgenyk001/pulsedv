export type NavAnimationKind="home"|"catalog"|"select"|"heart";

const path=(vertices:number[][],closed=true)=>({
  ty:"sh",ks:{a:0,k:{i:vertices.map(()=>[0,0]),o:vertices.map(()=>[0,0]),v:vertices,c:closed}}
});

const stroke=(color:number[])=>({
  ty:"st",c:{a:0,k:[...color,1]},o:{a:0,k:100},w:{a:0,k:3.6},lc:2,lj:2,ml:4
});

const transform={ty:"tr",p:{a:0,k:[0,0]},a:{a:0,k:[0,0]},s:{a:0,k:[100,100]},r:{a:0,k:0},o:{a:0,k:100},sk:{a:0,k:0},sa:{a:0,k:0}};

function group(vertices:number[][],color:number[],closed=true){
  return {ty:"gr",it:[path(vertices,closed),stroke(color),transform]};
}

export function makeNavAnimation(kind:NavAnimationKind,active:boolean){
  const color=active?[242/255,13/255,29/255]:[122/255,135/255,150/255];
  const shapes:any[]=[];
  if(kind==="home"){
    shapes.push(group([[14,31],[32,15],[50,31],[50,50],[38,50],[38,37],[26,37],[26,50],[14,50]],color,true));
  }
  if(kind==="catalog"){
    shapes.push(group([[15,19],[28,19],[28,50],[15,50]],color,true));
    shapes.push(group([[32,13],[49,13],[49,50],[32,50]],color,true));
    shapes.push(group([[20,27],[23,27]],color,false),group([[20,34],[23,34]],color,false),group([[37,22],[44,22]],color,false),group([[37,30],[44,30]],color,false),group([[37,38],[44,38]],color,false));
  }
  if(kind==="select"){
    shapes.push(group([[31,11],[34,24],[47,27],[34,30],[31,43],[28,30],[15,27],[28,24]],color,true));
    shapes.push(group([[47,12],[49,18],[55,20],[49,22],[47,28],[45,22],[39,20],[45,18]],color,true));
  }
  if(kind==="heart"){
    shapes.push(group([[32,51],[17,39],[12,31],[13,22],[19,16],[27,17],[32,23],[37,17],[45,16],[51,22],[52,31],[47,39]],color,true));
  }
  return {
    v:"5.12.2",fr:60,ip:0,op:36,w:64,h:64,nm:`PULSE ${kind}`,ddd:0,assets:[],
    layers:[{ddd:0,ind:1,ty:4,nm:"Icon",sr:1,
      ks:{o:{a:0,k:100},r:{a:0,k:0},p:{a:0,k:[32,32,0]},a:{a:0,k:[32,32,0]},
        s:{a:1,k:[
          {t:0,s:[92,92,100],e:[108,108,100],i:{x:[.2,.2,.2],y:[1,1,1]},o:{x:[.4,.4,.4],y:[0,0,0]}},
          {t:15,s:[108,108,100],e:[100,100,100],i:{x:[.2,.2,.2],y:[1,1,1]},o:{x:[.4,.4,.4],y:[0,0,0]}},
          {t:32,s:[100,100,100]}
        ]}},
      ao:0,shapes,ip:0,op:36,st:0,bm:0
    }]
  };
}
