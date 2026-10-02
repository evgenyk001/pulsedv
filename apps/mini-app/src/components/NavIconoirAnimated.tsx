import React from "react";
import styles from "./NavIconoirAnimated.module.css";

export type NavIconKind="home"|"catalog"|"selection"|"favorites";

export function NavIconoirAnimated({kind,active}:{kind:NavIconKind;active:boolean}){
  const className=`${styles.icon} ${styles[kind]} ${active?styles.active:""}`;

  if(kind==="home"){
    return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        className={styles.homeBody}
        pathLength="1"
        d="M9 21H7C4.79086 21 3 19.2091 3 17V10.7076C3 9.30887 3.73061 8.01175 4.92679 7.28679L9.92679 4.25649C11.2011 3.48421 12.7989 3.48421 14.0732 4.25649L19.0732 7.28679C20.2694 8.01175 21 9.30887 21 10.7076V17C21 19.2091 19.2091 21 17 21H15M9 21V17C9 15.3431 10.3431 14 12 14C13.6569 14 15 15.3431 15 17V21M9 21H15"
      />
    </svg>;
  }

  if(kind==="catalog"){
    return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <g className={styles.catalogBack}>
        <path d="M7 2H16.5L21 6.5V19"/>
      </g>
      <g className={styles.catalogFront}>
        <path d="M3 20.5V6.5C3 5.67157 3.67157 5 4.5 5H14.2515C14.4106 5 14.5632 5.06321 14.6757 5.17574L17.8243 8.32426C17.9368 8.43679 18 8.5894 18 8.74853V20.5C18 21.3284 17.3284 22 16.5 22H4.5C3.67157 22 3 21.3284 3 20.5Z"/>
        <path d="M14 5V8.4C14 8.73137 14.2686 9 14.6 9H18"/>
      </g>
      <g className={styles.catalogLines}>
        <path d="M7 10H10"/>
        <path d="M7 14H8"/>
        <path d="M7 18H14"/>
      </g>
    </svg>;
  }

  if(kind==="selection"){
    return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <g className={styles.wand}>
        <path d="M3 21L13 11M18 6L15.5 8.5"/>
      </g>
      <path className={styles.starLarge} d="M9.5 2L10.4453 4.55468L13 5.5L10.4453 6.44532L9.5 9L8.55468 6.44532L6 5.5L8.55468 4.55468L9.5 2Z"/>
      <path className={styles.starSmall} d="M19 10L19.5402 11.4598L21 12L19.5402 12.5402L19 14L18.4598 12.5402L17 12L18.4598 11.4598L19 10Z"/>
    </svg>;
  }

  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path
      className={styles.heartPath}
      d="M22 8.86222C22 10.4087 21.4062 11.8941 20.3458 12.9929C17.9049 15.523 15.5374 18.1613 13.0053 20.5997C12.4249 21.1505 11.5042 21.1304 10.9488 20.5547L3.65376 12.9929C1.44875 10.7072 1.44875 7.01723 3.65376 4.73157C5.88044 2.42345 9.50794 2.42345 11.7346 4.73157L11.9998 5.00642L12.2648 4.73173C13.3324 3.6245 14.7864 3 16.3053 3C17.8242 3 19.2781 3.62444 20.3458 4.73157C21.4063 5.83045 22 7.31577 22 8.86222Z"
    />
  </svg>;
}
