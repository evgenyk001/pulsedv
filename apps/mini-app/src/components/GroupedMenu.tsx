import {IconTile} from './IconTile';
import React from 'react';
import {Link, type LinkProps} from 'react-router-dom';
import {ChevronRight} from 'lucide-react';
import styles from './GroupedMenu.module.css';

type RowContent = {
  icon: React.ReactNode;
  title: string;
  description?: string;
  value?: string;
};

/** Shared inset list geometry; dialog triggers forward their events and ref. */
export function GroupedMenu({children,title,label,caption,className=''}:{children:React.ReactNode;title?:string;label?:string;caption?:React.ReactNode;className?:string}){
  return <section className={styles.section} aria-label={label||title}>
    {title&&<h2 className={styles.heading}>{title}</h2>}
    <div className={`${styles.group} ${className}`} data-menu-group>{children}</div>
    {caption&&<p className={styles.caption}>{caption}</p>}
  </section>;
}

function Content({icon,title,description,value}:RowContent){
  return <><IconTile>{icon}</IconTile><span className={styles.copy}><span className={styles.title}>{title}</span>{description&&<span className={styles.description}>{description}</span>}</span>{value&&<span className={styles.value}>{value}</span>}<ChevronRight className={styles.chevron} size={17} aria-hidden="true"/></>;
}

export const MenuLink=React.forwardRef<HTMLAnchorElement,RowContent&Omit<LinkProps,'title'|'children'>>(
  function MenuLink({icon,title,description,value,className='',...props},ref){
    return <Link {...props} ref={ref} data-menu-row className={`${styles.row} ${className}`}><Content {...{icon,title,description,value}}/></Link>;
  }
);
export const MenuButton=React.forwardRef<HTMLButtonElement,RowContent&Omit<React.ButtonHTMLAttributes<HTMLButtonElement>,'title'|'children'>>(
  function MenuButton({icon,title,description,value,className='',type='button',...props},ref){
    return <button {...props} ref={ref} type={type} data-menu-row className={`${styles.row} ${className}`}><Content {...{icon,title,description,value}}/></button>;
  }
);
