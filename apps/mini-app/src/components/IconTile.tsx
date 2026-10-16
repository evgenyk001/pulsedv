import React from 'react';
import styles from './IconTile.module.css';

/** One material and optical size for decorative icons in cards, lists and sheets. */
export function IconTile({children,className='',as:Tag='span'}:{children:React.ReactNode;className?:string;as?:'span'|'div'}){
  return <Tag className={`${styles.tile} ${className}`} data-icon-tile aria-hidden="true">{children}</Tag>;
}
