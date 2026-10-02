import React from "react";
import styles from "./NavMotionIcon.module.css";

export type NavMotionKind="home"|"catalog"|"selection"|"favorites";

export function NavMotionIcon({kind,active}:{kind:NavMotionKind;active:boolean}){
  const className=`${styles.icon} ${styles[kind]} ${active?styles.active:""}`;

  if(kind==="home"){
    return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path className={styles.homeDoor} d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>
      <path className={styles.homeShell} d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    </svg>;
  }

  if(kind==="catalog"){
    return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path className={styles.layerTop} d="M13 13.74a2 2 0 0 1-2 0L2.5 8.87a1 1 0 0 1 0-1.74L11 2.26a2 2 0 0 1 2 0l8.5 4.87a1 1 0 0 1 0 1.74z"/>
      <path className={styles.layerBottom} d="m20 14.285 1.5.845a1 1 0 0 1 0 1.74L13 21.74a2 2 0 0 1-2 0l-8.5-4.87a1 1 0 0 1 0-1.74l1.5-.845"/>
    </svg>;
  }

  if(kind==="selection"){
    return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <g className={styles.sliderTrack}>
        <path d="M3 5h18"/>
        <path d="M3 12h18"/>
        <path d="M3 19h18"/>
      </g>
      <path className={styles.sliderOne} d="M14 3v4"/>
      <path className={styles.sliderTwo} d="M8 10v4"/>
      <path className={styles.sliderThree} d="M16 17v4"/>
    </svg>;
  }

  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path className={styles.heartPath} d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>
  </svg>;
}
