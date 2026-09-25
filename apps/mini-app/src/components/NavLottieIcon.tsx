import React from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";

type Kind="home"|"building"|"sparkles"|"heart";

const path=(v:number[][],closed=false)=>({
  ty:"sh",ks:{a:0,k:{i:v.map(()=>[0,0]),o:v.map(()=>[0,0]),v,c:closed}},nm:"Path"
});

const group=(paths:number[][][],closed:boolean,color:number[])=>({
  ty:"gr",
  it:[
    ...paths.map(points=>path(points,closed)),
    {ty:"st",c:{a:0,k:[...color,1]},o:{a:0,k:100},w:{a:0,k:1.9},lc:2,lj:2,nm:"Stroke"},
    {ty:"tr",p:{a:0,k:[0,0]},a:{a:0,k:[0,0]},s:{a:0,k:[100,100]},r:{a:0,k:0},o:{a:0,k:100},sk:{a:0,k:0},sa:{a:0,k:0}}
  ],
  nm:"Icon"
});

function iconPaths(kind:Kind){
  if(kind==="home") return {closed:false,paths:[
    [[4,11],[12,4],[20,11]],
    [[6,10],[6,20],[18,20],[18,10]],
    [[10,20],[10,14],[14,14],[14,20]]
  ]};
  if(kind==="building") return {closed:false,paths:[
    [[6,20],[6,5],[16,5],[16,20]],
    [[16,10],[20,10],[20,20]],
    [[4,20],[21,20]],
    [[9,9],[11,9]],[[9,13],[11,13]],[[9,17],[11,17]]
  ]};
  if(kind==="sparkles") return {closed:true,paths:[
    [[12,3],[13.4,7.6],[18,9],[13.4,10.4],[12,15],[10.6,10.4],[6,9],[10.6,7.6]],
    [[19,3],[19.7,5.3],[22,6],[19.7,6.7],[19,9],[18.3,6.7],[16,6],[18.3,5.3]],
    [[5,15],[5.7,17.3],[8,18],[5.7,18.7],[5,21],[4.3,18.7],[2,18],[4.3,17.3]]
  ]};
  return {closed:true,paths:[
    [[12,20],[4.6,13.3],[3.4,10.4],[3.7,7.8],[5.4,5.8],[8,5.2],[10.1,6.1],[12,8.1],[13.9,6.1],[16,5.2],[18.6,5.8],[20.3,7.8],[20.6,10.4],[19.4,13.3]]
  ]};
}

function data(kind:Kind,color:number[]){
  const spec=iconPaths(kind);
  return {
    v:"5.12.2",fr:60,ip:0,op:26,w:24,h:24,nm:kind,ddd:0,assets:[],
    layers:[{
      ddd:0,ind:1,ty:4,nm:kind,sr:1,
      ks:{
        o:{a:0,k:100},r:{a:0,k:0},p:{a:0,k:[12,12,0]},a:{a:0,k:[12,12,0]},
        s:{a:1,k:[
          {t:0,s:[100,100,100],e:[116,116,100]},
          {t:8,s:[116,116,100],e:[96,96,100]},
          {t:16,s:[96,96,100],e:[100,100,100]},
          {t:25,s:[100,100,100]}
        ]}
      },
      ao:0,shapes:[group(spec.paths,spec.closed,color)],ip:0,op:26,st:0,bm:0
    }]
  };
}

export function NavLottieIcon({kind,active}:{kind:Kind;active:boolean}){
  const ref=React.useRef<LottieRefCurrentProps|null>(null);
  const animationData=React.useMemo(()=>data(kind,active?[.949,.051,.114]:[.478,.529,.588]),[kind,active]);

  React.useEffect(()=>{
    if(active) ref.current?.goToAndPlay(0,true);
    else ref.current?.goToAndStop(0,true);
  },[active]);

  return <Lottie
    lottieRef={ref}
    animationData={animationData}
    autoplay={false}
    loop={false}
    style={{width:22,height:22}}
    aria-hidden="true"
  />;
}
