import React from 'react';
import {describeLeadRequestContext} from '../pulse-data/leadContext';
export function MessageContext({value}:{value:Record<string,unknown>}){
 const description=describeLeadRequestContext(value,typeof value.source==='string'?value.source:'app');
 if(!description.lines.length)return null;
 return <aside aria-label="Контекст сообщения" style={{fontSize:11,lineHeight:1.5,padding:'8px 10px',marginBottom:8,borderRadius:12,background:'rgba(128,138,153,.10)'}}><strong>{description.title}</strong><div>{description.lines.join(' · ')}</div></aside>;
}
