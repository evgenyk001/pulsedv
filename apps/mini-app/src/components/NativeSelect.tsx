import React from 'react';
import styles from './NativeSelect.module.css';

// Keep a real select: iOS and Android provide their own accessible picker.
export const NativeSelect=React.forwardRef<HTMLSelectElement,React.SelectHTMLAttributes<HTMLSelectElement>>(
 function NativeSelect({className='',...props},ref){
  return <select {...props} ref={ref} className={[styles.control,className].filter(Boolean).join(' ')}/>;
 }
);
