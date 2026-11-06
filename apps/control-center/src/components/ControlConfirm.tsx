import React from 'react';
import {createPortal} from 'react-dom';
import {CircleHelp} from 'lucide-react';
import {useDialog} from './useDialog';
type Request={message:string;resolve:(value:boolean)=>void};
let current:Request|null=null;const listeners=new Set<()=>void>();
const emit=()=>listeners.forEach(listener=>listener());
/** Same decision and message as the original confirmation, presented inside Control. */
export function confirmControl(message:string):Promise<boolean>{
 if(current)return Promise.resolve(false);
 return new Promise(resolve=>{current={message,resolve};emit()});
}
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}};
export function ControlConfirmHost(){
 const request=React.useSyncExternalStore(subscribe,()=>current,()=>null);
 const answer=(value:boolean)=>{const pending=current;current=null;emit();pending?.resolve(value)};
 useDialog(!!request,()=>answer(false));
 if(!request)return null;
 return createPortal(<div className="controlConfirmBackdrop"><section className="controlConfirm" role="alertdialog" aria-modal="true" aria-labelledby="control-confirm-title" aria-describedby="control-confirm-message"><span className="confirmMark"><CircleHelp size={25}/></span><h2 id="control-confirm-title">Подтвердите действие</h2><div id="control-confirm-message">{request.message}</div><footer><button type="button" className="confirmCancel" onClick={()=>answer(false)}>Отмена</button><button type="button" className="confirmAccept" onClick={()=>answer(true)}>Подтвердить</button></footer></section></div>,document.body);
}
