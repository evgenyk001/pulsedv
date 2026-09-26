import React from 'react';
import Lottie, {type LottieRefCurrentProps} from 'lottie-react';
import {Building2,Heart,Home,Sparkles} from 'lucide-react';

type Kind='home'|'building'|'sparkles'|'heart';
const fallback={home:Home,building:Building2,sparkles:Sparkles,heart:Heart};

const bezier=(vertices:number[][],closed=false,ins?:number[][],outs?:number[][])=>({
  ty:'sh',
  ks:{a:0,k:{i:ins||vertices.map(()=>[0,0]),o:outs||vertices.map(()=>[0,0]),v:vertices,c:closed}},
  nm:'Контур'
});

const key=(t:number,s:number[],e?:number[])=>({
  t,s,
  ...(e?{e,i:{x:[.32],y:[1]},o:{x:[.18],y:[0]}}:{})
});

const stroke=(color:number[],width=1.9)=>({
  ty:'st',c:{a:0,k:[...color,1]},o:{a:0,k:100},w:{a:0,k:width},lc:2,lj:2
});

const trim=(delay=0)=>({
  ty:'tm',
  s:{a:0,k:0},
  e:{a:1,k:[key(delay,[0],[100]),key(delay+18,[100])]},
  o:{a:0,k:0},
  m:1
});

const transform=()=>({
  ty:'tr',p:{a:0,k:[0,0]},a:{a:0,k:[0,0]},s:{a:0,k:[100,100]},
  r:{a:0,k:0},o:{a:0,k:100},sk:{a:0,k:0},sa:{a:0,k:0}
});

const group=(paths:any[],color:number[],delay=0,width=1.9)=>({
  ty:'gr',nm:'Штрих',it:[...paths,stroke(color,width),trim(delay),transform()]
});

const ellipse=(x:number,y:number,size:number,color:number[])=>({
  ty:'gr',nm:'Точка',it:[
    {ty:'el',p:{a:0,k:[x,y]},s:{a:0,k:[size,size]},nm:'Точка'},
    {ty:'fl',c:{a:0,k:[...color,1]},o:{a:0,k:100},r:1},
    transform()
  ]
});

function paths(kind:Kind){
  if(kind==='home')return [
    [bezier([[5,14],[16,5],[27,14]])],
    [bezier([[7.5,13],[7.5,27],[13,27],[13,20],[19,20],[19,27],[24.5,27],[24.5,13]])],
    [bezier([[21.5,7.5],[21.5,11]])],
  ];
  if(kind==='building')return [
    [bezier([[7,27],[7,6],[21,6],[21,27],[4.5,27],[27.5,27]])],
    [bezier([[21,13],[26,13],[26,27]])],
    [bezier([[11,11],[13,11]]),bezier([[16,11],[18,11]]),bezier([[11,16],[13,16]]),bezier([[16,16],[18,16]]),bezier([[11,21],[13,21]]),bezier([[16,21],[18,21]])],
  ];
  if(kind==='sparkles')return [
    [bezier([[16,4.5],[18.6,12.8],[27,16],[18.6,19.2],[16,27.5],[13.4,19.2],[5,16],[13.4,12.8]],true)],
    [bezier([[25.5,5.5],[25.5,10.5]]),bezier([[23,8],[28,8]])],
    [bezier([[6.5,22],[6.5,26]]),bezier([[4.5,24],[8.5,24]])],
  ];
  return [
    [bezier(
      [[16,27],[5.2,16.3],[5.6,10.1],[10.6,6.1],[16,10.2],[21.4,6.1],[26.4,10.1],[26.8,16.3]],
      true,
      [[0,0],[0,3.5],[-3.4,0],[-1.8,-2.6],[0,0],[1.8,-2.6],[3.4,0],[0,-3.5]],
      [[0,0],[0,-3.5],[2.5,0],[1.8,-2.6],[0,0],[-1.8,-2.6],[-2.5,0],[0,3.5]]
    )],
  ];
}

function animation(kind:Kind,color:number[]){
  const outlineGroups=paths(kind).map((part,index)=>group(part,color,index*4,index===0?2:1.75));
  const rotation=kind==='sparkles'
    ?[key(0,[-10],[5]),key(15,[5],[0]),key(28,[0])]
    :kind==='heart'
      ?[key(0,[0]),key(12,[0])]
      :[key(0,[0]),key(30,[0])];

  const scale=kind==='heart'
    ?[key(0,[88,88,100],[112,112,100]),key(11,[112,112,100],[96,96,100]),key(22,[96,96,100],[100,100,100]),key(36,[100,100,100])]
    :[key(0,[90,90,100],[106,106,100]),key(14,[106,106,100],[98,98,100]),key(25,[98,98,100],[100,100,100]),key(38,[100,100,100])];

  const accents=kind==='building'
    ?[ellipse(24.5,9.2,2.7,color)]
    :kind==='sparkles'
      ?[ellipse(7.2,8.4,2.4,color)]
      :kind==='heart'
        ?[ellipse(24.7,7.4,2.2,color)]
        :[ellipse(25.2,10.2,2.3,color)];

  return {
    v:'5.12.2',fr:60,ip:0,op:42,w:32,h:32,nm:'PULSE central '+kind,ddd:0,assets:[],
    layers:[
      {
        ddd:0,ind:1,ty:4,nm:'Основная иконка',sr:1,
        ks:{
          o:{a:1,k:[key(0,[0],[100]),key(6,[100])]},
          r:{a:1,k:rotation},
          p:{a:0,k:[16,16,0]},
          a:{a:0,k:[16,16,0]},
          s:{a:1,k:scale}
        },
        ao:0,shapes:outlineGroups,ip:0,op:42,st:0,bm:0
      },
      {
        ddd:0,ind:2,ty:4,nm:'Акцент',sr:1,
        ks:{
          o:{a:1,k:[key(8,[0],[100]),key(14,[100])]},
          r:{a:0,k:0},
          p:{a:0,k:[0,0,0]},
          a:{a:0,k:[0,0,0]},
          s:{a:1,k:[key(8,[35,35,100],[118,118,100]),key(16,[118,118,100],[100,100,100]),key(26,[100,100,100])]}
        },
        ao:0,shapes:accents,ip:0,op:42,st:0,bm:0
      }
    ]
  };
}

class IconBoundary extends React.Component<{children:React.ReactNode;fallback:React.ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?this.props.fallback:this.props.children;}
}

export function NavLottieIcon({kind,active}:{kind:Kind;active:boolean}){
  const ref=React.useRef<LottieRefCurrentProps|null>(null);
  const Icon=fallback[kind];
  const [reduce,setReduce]=React.useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  React.useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync=()=>setReduce(media.matches);
    media.addEventListener('change',sync);
    return()=>media.removeEventListener('change',sync);
  },[]);

  const data=React.useMemo(()=>animation(kind,active?[.949,.051,.114]:[.478,.529,.588]),[kind,active]);

  React.useEffect(()=>{
    if(active&&!reduce)ref.current?.goToAndPlay(0,true);
    else ref.current?.goToAndStop(41,true);
  },[active,reduce,data]);

  const staticIcon=<Icon size={22} strokeWidth={1.8}/>;

  return <span aria-hidden="true" style={{display:'grid',placeItems:'center',width:26,height:26}}>
    {reduce?staticIcon:<IconBoundary fallback={staticIcon}>
      <Lottie
        lottieRef={ref}
        animationData={data}
        autoplay={false}
        loop={false}
        onDOMLoaded={()=>{if(active)ref.current?.goToAndPlay(0,true);else ref.current?.goToAndStop(41,true);}}
        rendererSettings={{preserveAspectRatio:'xMidYMid meet'}}
        style={{width:26,height:26}}
      />
    </IconBoundary>}
  </span>;
}
