import React from "react";
import Lottie from "lottie-react";

export type NavIconKind="home"|"catalog"|"select"|"favorite";

const toLottieColor=(hex:string)=>{
  const clean=hex.replace("#","");
  return [0,2,4].map(i=>parseInt(clean.slice(i,i+2),16)/255);
};

const pathShape=(vertices:number[][],closed=false)=>({
  ty:"sh",
  ks:{a:0,k:{i:vertices.map(()=>[0,0]),o:vertices.map(()=>[0,0]),v:vertices,c:closed}}
});

const stroke=(color:number[],width=2)=>({ty:"st",c:{a:0,k:color},o:{a:0,k:100},w:{a:0,k:width},lc:2,lj:2});
const fill=(color:number[])=>({ty:"fl",c:{a:0,k:color},o:{a:0,k:100},r:1});
const transform=(animated:boolean)=>({
  ty:"tr",
  p:{a:0,k:[12,12]},
  a:{a:0,k:[12,12]},
  s:animated
    ?{a:1,k:[
      {t:0,s:[100,100,100],e:[116,116,100]},
      {t:8,s:[116,116,100],e:[100,100,100]},
      {t:18,s:[100,100,100]}
    ]}
    :{a:0,k:[100,100,100]},
  r:{a:0,k:0},
  o:{a:0,k:100}
});

const group=(items:any[],animated:boolean)=>({ty:"gr",it:[...items,transform(animated)]});

function shapes(kind:NavIconKind,color:number[],animated:boolean){
  if(kind==="home")return [
    group([
      pathShape([[4,11],[12,4],[20,11]],false),stroke(color,2.1)
    ],animated),
    group([
      pathShape([[6.7,10],[6.7,20],[17.3,20],[17.3,10]],false),stroke(color,2.1),
      pathShape([[10,20],[10,14],[14,14],[14,20]],false),stroke(color,2.1)
    ],animated)
  ];

  if(kind==="catalog")return [
    group([
      {ty:"rc",p:{a:0,k:[8,12]},s:{a:0,k:[5,15]},r:{a:0,k:1.4}},stroke(color,1.9),
      {ty:"rc",p:{a:0,k:[16,12]},s:{a:0,k:[5,15]},r:{a:0,k:1.4}},stroke(color,1.9),
      pathShape([[6.6,8],[9.4,8],[9.4,8]],false),stroke(color,1.5),
      pathShape([[14.6,8],[17.4,8],[17.4,8]],false),stroke(color,1.5),
      pathShape([[6.6,12],[9.4,12],[9.4,12]],false),stroke(color,1.5),
      pathShape([[14.6,12],[17.4,12],[17.4,12]],false),stroke(color,1.5)
    ],animated)
  ];

  if(kind==="select")return [
    group([
      pathShape([[12,3],[13.6,8.4],[19,10],[13.6,11.6],[12,17],[10.4,11.6],[5,10],[10.4,8.4]],true),
      stroke(color,1.85)
    ],animated),
    group([
      pathShape([[18.2,3.5],[18.7,5.1],[20.3,5.6],[18.7,6.1],[18.2,7.7],[17.7,6.1],[16.1,5.6],[17.7,5.1]],true),
      fill(color)
    ],animated)
  ];

  return [
    group([
      pathShape([[12,20],[4.5,12.8],[4,9.1],[5.8,6.2],[9,5.7],[12,8.4],[15,5.7],[18.2,6.2],[20,9.1],[19.5,12.8]],false),
      stroke(color,2.05)
    ],animated)
  ];
}

function animation(kind:NavIconKind,colorHex:string,animated:boolean){
  const color=toLottieColor(colorHex);
  return {
    v:"5.9.6",fr:30,ip:0,op:20,w:24,h:24,nm:`pulse-${kind}`,ddd:0,assets:[],
    layers:[{
      ddd:0,ind:1,ty:4,nm:kind,sr:1,
      ks:{o:{a:0,k:100},r:{a:0,k:0},p:{a:0,k:[0,0,0]},a:{a:0,k:[0,0,0]},s:{a:0,k:[100,100,100]}},
      ao:0,shapes:shapes(kind,color,animated),ip:0,op:20,st:0,bm:0
    }]
  };
}

export function NavLottieIcon({kind,strength,active}:{kind:NavIconKind;strength:number;active:boolean}){
  const base=[122,135,150],accent=[242,13,29];
  const mix=(a:number,b:number)=>Math.round(a+(b-a)*strength);
  const color="#"+[0,1,2].map(i=>mix(base[i],accent[i]).toString(16).padStart(2,"0")).join("");
  const data=React.useMemo(()=>animation(kind,color,active),[kind,color,active]);
  return <Lottie key={kind+"-"+active} animationData={data} autoplay={active} loop={false} style={{width:22,height:22}}/>;
}
