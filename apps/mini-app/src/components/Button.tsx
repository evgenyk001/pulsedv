import * as React from "react";
type Props=React.ButtonHTMLAttributes<HTMLButtonElement>&{variant?:string;size?:string};
export const Button=React.forwardRef<HTMLButtonElement,Props>(({variant:_,size:__,...props},ref)=><button ref={ref} {...props}/>);
Button.displayName="Button";
