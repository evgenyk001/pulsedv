import {Link,type LinkProps} from 'react-router-dom';
import {ArrowLeft} from 'lucide-react';
import styles from './BackLink.module.css';

/** Shared page navigation; labels remain available to screen readers. */
export function BackLink({className='',compact=false,hero=false,...props}:Omit<LinkProps,'children'> & {compact?:boolean;hero?:boolean}){
 return <Link {...props} className={`${styles.back} ${compact?styles.compact:''} ${hero?styles.hero:''} ${className}`} data-back-link><ArrowLeft size={20} strokeWidth={1.8} aria-hidden="true"/></Link>;
}
