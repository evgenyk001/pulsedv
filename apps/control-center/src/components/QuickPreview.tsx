import React from 'react';
import {createPortal} from 'react-dom';
import {ArrowUpRight, X} from 'lucide-react';
import {useDialog} from './useDialog';
export function QuickPreview({title,subtitle,onClose,onOpen,children}:{title:string;subtitle:string;onClose:()=>void;onOpen:()=>void;children:React.ReactNode}){
 useDialog(true,onClose);
 return createPortal(<div className="previewBackdrop" onClick={e=>{if(e.target===e.currentTarget)onClose()}}><section className="quickPreview" role="dialog" aria-modal="true" aria-label={'Быстрый просмотр: '+title}><header><div><span>{subtitle}</span><h2>{title}</h2></div><button type="button" className="iconAction" aria-label="Закрыть быстрый просмотр" onClick={onClose}><X size={18}/></button></header><div className="previewBody">{children}</div><footer><button type="button" className="primaryAction" onClick={onOpen}>Открыть полную карточку<ArrowUpRight size={17}/></button><span>Все данные и действия клиента</span></footer></section></div>,document.getElementById('control-record-root')||document.body);
}
export function PreviewFact({label,children}:{label:string;children:React.ReactNode}){return <div className="previewFact"><dt>{label}</dt><dd>{children}</dd></div>}
