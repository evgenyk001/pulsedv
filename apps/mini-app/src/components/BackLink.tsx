import {useAppBack} from '../helpers/navigationMemory';
import {Link,type LinkProps} from 'react-router-dom';
import {ArrowLeft} from 'lucide-react';
import styles from './BackLink.module.css';

/** Shared page navigation; labels remain available to screen readers. */
export function BackLink({className='',compact=false,hero=false,onClick,...props}:Omit<LinkProps,'children'> & {compact?:boolean;hero?:boolean}){
 const {back,canGoBack,previousPath}=useAppBack(typeof props.to==='string'?props.to:'/');
 const target=typeof props.to==='string'?props.to:props.to.pathname||'/';
 const label=canGoBack&&previousPath.split('?')[0]!==target.split('?')[0]&&props['aria-label']!=='Назад'?'Назад к предыдущему экрану':props['aria-label'];
 return <Link {...props} to={canGoBack?previousPath:props.to} aria-label={label} onClick={event=>{onClick?.(event);if(!event.defaultPrevented&&event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();back()}}} className={`${styles.back} ${compact?styles.compact:''} ${hero?styles.hero:''} ${className}`} data-back-link><ArrowLeft size={20} strokeWidth={1.8} aria-hidden="true"/></Link>;
}
