import React from "react";
import styles from "./NavPrimaryIcon.module.css";

type Kind="home"|"catalog";

export function NavPrimaryIcon({kind,active}:{kind:Kind;active:boolean}){
  if(kind==="home"){
    return <svg
      className={`${styles.icon} ${styles.dashboard} ${active?styles.active:""}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path className={styles.dashboardArc} d="M8.5 20.001H4C2.744 18.33 2 16.252 2 14C2 8.477 6.477 4 12 4s10 4.477 10 10c0 2.252-.744 4.33-2 6.001h-4.5"/>
      <path className={styles.dashboardHub} d="M15 20a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
      <path className={styles.dashboardNeedle} d="M12 17l1-6"/>
      <g className={styles.dashboardDots}>
        <path d="M12 7.01h.01"/>
        <path d="M16 9.01h.01"/>
        <path d="M8 9.01h.01"/>
        <path d="M18 13.01h.01"/>
        <path d="M6 13.01h.01"/>
        <path d="M17 17.01h.01"/>
        <path d="M7 17.01h.01"/>
      </g>
    </svg>;
  }

  return <svg
    className={`${styles.icon} ${styles.catalog} ${active?styles.active:""}`}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path className={styles.page} d="M20 12V5.75a.6.6 0 0 0-.176-.426l-3.148-3.148A.6.6 0 0 0 16.25 2H4.6a.6.6 0 0 0-.6.6v18.8a.6.6 0 0 0 .6.6H11"/>
    <path className={styles.pageFold} d="M16 2v3.4a.6.6 0 0 0 .6.6H20"/>
    <g className={styles.pageLines}>
      <path d="M8 6h4"/>
      <path d="M8 10h8"/>
      <path d="M8 14h3"/>
    </g>
    <g className={styles.searchGlass}>
      <circle cx="18" cy="18" r="3"/>
      <path d="m20.35 20.35 1.65 1.65"/>
    </g>
  </svg>;
}
