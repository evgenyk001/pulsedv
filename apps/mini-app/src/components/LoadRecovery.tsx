import {RefreshCw} from 'lucide-react';
import './loadRecovery.css';
/** Initial reads need a way forward; background failures leave existing content intact. */
export function LoadRecovery({onRetry,label='Обновить раздел'}:{onRetry:()=>void;label?:string}){
 return <div className="loadRecovery"><button type="button" onClick={onRetry} aria-label={label}><RefreshCw size={17} aria-hidden="true"/>Попробовать снова</button></div>;
}
