import React from 'react';
import {Building2} from 'lucide-react';

export function CatalogCover({url}:{url:string|null}){
 const [failed,setFailed]=React.useState(false);
 React.useEffect(()=>setFailed(false),[url]);
 return url&&!failed?<img src={url} alt="" loading="lazy" decoding="async" onError={()=>setFailed(true)}/>:<div className="objectPlaceholder"><Building2 size={24}/><span>PULSEDV.RU</span></div>;
}
