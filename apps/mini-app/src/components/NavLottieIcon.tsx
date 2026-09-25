import React from 'react';
import Lottie, {type LottieRefCurrentProps} from 'lottie-react';
import {Building2,Heart,Home,Sparkles} from 'lucide-react';
type Kind='home'|'building'|'sparkles'|'heart';
const fallback={home:Home,building:Building2,sparkles:Sparkles,heart:Heart};
const shape=(vertices:number[][],closed=false,ins?:number[][],outs?:number[][])=>({ty:'sh',ks:{a:0,k:{i:ins||vertices.map(()=>[0,0]),o:outs||vertices.map(()=>[0,0]),v:vertices,c:closed}},nm:'Outline'});
const eased=(t:number,s:number[],e?:number[])=>({t,s,...(e?{e,i:{x:[.3],y:[1]},o:{x:[.2],y:[0]}}:{})});
function animation(kind:Kind,color:number[]){
 const outlines=kind==='home'?[shape([[3,10],[12,3],[21,10]]),shape([[5,9],[5,21],[10,21],[10,14],[14,14],[14,21],[19,21],[19,9]])]
 :kind==='building'?[shape([[5,21],[5,3],[16,3],[16,21]]),shape([[16,9],[21,9],[21,21],[3,21]]),...[7,11,15].flatMap(y=>[shape([[8,y],[9,y]]),shape([[12,y],[13,y]])])]
 :kind==='sparkles'?[shape([[12,3],[14.5,9.5],[21,12],[14.5,14.5],[12,21],[9.5,14.5],[3,12],[9.5,9.5]],true),shape([[20,2],[20,6]]),shape([[18,4],[22,4]])]
 :[shape([[12,21],[3,11],[7.5,4],[12,7],[16.5,4],[21,11]],true,[[0,0],[0,3],[-4,0],[-1.5,-2],[0,0],[0,-4]],[[0,0],[0,-4],[2,0],[1.5,-2],[4,0],[0,3]])];
 const scale=kind==='heart'?[eased(0,[100,100,100],[115,115,100]),eased(8,[115,115,100],[97,97,100]),eased(17,[97,97,100],[100,100,100]),eased(30,[100,100,100])]:[eased(0,[96,96,100],[104,104,100]),eased(13,[104,104,100],[100,100,100]),eased(30,[100,100,100])];
 return {v:'5.12.2',fr:60,ip:0,op:32,w:24,h:24,nm:'PULSE '+kind,ddd:0,assets:[],layers:[{ddd:0,ind:1,ty:4,nm:kind,sr:1,ks:{o:{a:0,k:100},r:{a:0,k:0},p:{a:0,k:[12,12,0]},a:{a:0,k:[12,12,0]},s:{a:1,k:scale}},ao:0,shapes:[{ty:'gr',it:[...outlines,{ty:'st',c:{a:0,k:[...color,1]},o:{a:0,k:100},w:{a:0,k:1.8},lc:2,lj:2},{ty:'tm',s:{a:0,k:0},e:{a:1,k:[eased(0,[65],[100]),eased(19,[100])]},o:{a:0,k:0},m:1},{ty:'tr',p:{a:0,k:[0,0]},a:{a:0,k:[0,0]},s:{a:0,k:[100,100]},r:{a:0,k:0},o:{a:0,k:100},sk:{a:0,k:0},sa:{a:0,k:0}}]}],ip:0,op:32,st:0,bm:0}]};
}
class IconBoundary extends React.Component<{children:React.ReactNode;fallback:React.ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true};}render(){return this.state.failed?this.props.fallback:this.props.children;}}
export function NavLottieIcon({kind,active}:{kind:Kind;active:boolean}){
 const ref=React.useRef<LottieRefCurrentProps|null>(null);const Icon=fallback[kind];
 const [reduce,setReduce]=React.useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 React.useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const sync=()=>setReduce(media.matches);media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync);},[]);
 const data=React.useMemo(()=>animation(kind,active?[.949,.051,.114]:[.478,.529,.588]),[kind,active]);
 React.useEffect(()=>{if(active&&!reduce)ref.current?.goToAndPlay(0,true);else ref.current?.goToAndStop(31,true);},[active,reduce,data]);
 const staticIcon=<Icon size={22} strokeWidth={1.8}/>;
 return <span aria-hidden="true" style={{display:'grid',placeItems:'center',width:24,height:24}}>{reduce?staticIcon:<IconBoundary fallback={staticIcon}><Lottie lottieRef={ref} animationData={data} autoplay={false} loop={false} onDOMLoaded={()=>{if(active)ref.current?.goToAndPlay(0,true);else ref.current?.goToAndStop(31,true);}} rendererSettings={{preserveAspectRatio:'xMidYMid meet'}} style={{width:24,height:24}}/></IconBoundary>}</span>;
}
