import React from "react";
import styles from "./PageHeader.module.css";

type PageHeaderProps={
  eyebrow?:string;
  title:string;
  subtitle?:string;
  action?:React.ReactNode;
  compact?:boolean;
};

export function PageHeader({eyebrow,title,subtitle,action,compact=false}:PageHeaderProps){
  return <header className={`${styles.header} ${compact?styles.compact:""}`}>
    <div className={styles.copy}>
      {eyebrow&&<span className={styles.eyebrow}>{eyebrow}</span>}
      <h1>{title}</h1>
      {subtitle&&<p>{subtitle}</p>}
    </div>
    {action&&<div className={styles.action}>{action}</div>}
  </header>
}