import React from 'react';

// This boundary must surround the runtime gate, providers and router as well as pages.
export class AppBoundary extends React.Component<{children:React.ReactNode;onError?:()=>void},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 componentDidCatch(){try{this.props.onError?.()}catch{/* The recovery screen must remain usable. */}}
 render(){
  if(!this.state.failed)return this.props.children;
  return <main role="alert" style={{minHeight:'100dvh',display:'grid',placeContent:'center',gap:16,padding:24,boxSizing:'border-box',background:'#f3f5f8',color:'#242e3a',fontFamily:'system-ui,sans-serif',textAlign:'center'}}>
   <strong>Не удалось загрузить приложение</strong>
   <button type="button" onClick={()=>window.location.reload()} style={{minHeight:44,padding:'12px 24px',border:'1px solid #d9dfe6',borderRadius:24,background:'#fff',color:'inherit',font:'inherit'}}>Перезагрузить</button>
  </main>;
 }
}
