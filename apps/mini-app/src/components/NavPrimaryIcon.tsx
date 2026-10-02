import React from "react";
import styles from "./NavPrimaryIcon.module.css";

type Kind="home"|"catalog";

export function NavPrimaryIcon({kind,active}:{kind:Kind;active:boolean}){
  if(kind==="home"){
    return <svg
      className={`${styles.icon} ${styles.home} ${active?styles.active:""}`}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g className={styles.homeShell}>
        <path d="M6.2 14.2 16 6.15l9.8 8.05"/>
        <path d="M8.35 12.75V26h15.3V12.75"/>
      </g>
      <path className={styles.chimney} d="M22.1 10.25V6.9h2.7v5.55"/>
      <path className={styles.door} d="M13.15 26v-7.45h5.7V26"/>
      <g className={styles.windows}>
        <rect x="10.55" y="14.8" width="3.25" height="3.25" rx=".7"/>
        <rect x="18.2" y="14.8" width="3.25" height="3.25" rx=".7"/>
      </g>
      <path className={styles.homeBase} d="M6.5 26h19"/>
    </svg>;
  }

  return <svg
    className={`${styles.icon} ${styles.catalog} ${active?styles.active:""}`}
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <rect className={styles.cardBack} x="8.2" y="4.6" width="18.1" height="21.2" rx="3"/>
    <rect className={styles.cardMiddle} x="5.2" y="7.5" width="18.1" height="20.2" rx="3"/>
    <g className={styles.cardFront}>
      <rect x="2.6" y="10.3" width="20.1" height="17.1" rx="3"/>
      <path className={styles.photoRoof} d="M6.1 17.4 10.25 13.8l4.15 3.6"/>
      <path className={styles.photoHouse} d="M7.15 16.5v4.05h6.2V16.5"/>
      <path className={styles.textLineA} d="M15.95 15.15h3.75"/>
      <path className={styles.textLineB} d="M15.95 18.25h3.75"/>
      <path className={styles.textLineC} d="M6.1 23.8h13.6"/>
    </g>
  </svg>;
}
