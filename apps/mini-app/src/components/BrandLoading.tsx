export function BrandLoading({fullScreen=false,error='',onRetry}:{fullScreen?:boolean;error?:string;onRetry?:()=>void}){
 return <div className={fullScreen?'pulseLaunch pulseLaunchRuntime':'pulseRouteLoading'} role={error?'alert':'status'} aria-label={error?undefined:'Загружаем PULSEDV.RU'}>
  <div className="pulseLaunchMark pulseLaunchRuntimeMark" aria-hidden="true"/>
  {error&&<div className="pulseLaunchNote"><p>{error}</p><button onClick={onRetry}>Попробовать снова</button></div>}
 </div>;
}
