import React from "react";
import styles from "./SegmentedControl.module.css";

export type SegmentOption<T extends string>={
  value:T;
  label:React.ReactNode;
};

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className="",
}:{
  value:T;
  options:SegmentOption<T>[];
  onChange:(value:T)=>void;
  ariaLabel?:string;
  className?:string;
}){
  const activeIndex=Math.max(0,options.findIndex(option=>option.value===value));
  return <div
    className={styles.root+" "+className}
    role="tablist"
    aria-label={ariaLabel}
    style={{
      "--segment-count":options.length,
      "--segment-index":activeIndex,
    } as React.CSSProperties}
  >
    <span className={styles.pill} aria-hidden="true"/>
    {options.map(option=><button
      type="button"
      role="tab"
      aria-selected={option.value===value}
      key={option.value}
      className={option.value===value?styles.active:""}
      onClick={()=>onChange(option.value)}
    >{option.label}</button>)}
  </div>;
}
