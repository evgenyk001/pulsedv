import type { ReactNode } from "react";

export function PageFrame({eyebrow,title,description,action,children}:{eyebrow:string;title:string;description:string;action?:ReactNode;children:ReactNode}){
  return <div className="page">
    <header className="pageHeader">
      <div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      {action}
    </header>
    {children}
  </div>;
}

export function EmptyState({title,text}:{title:string;text:string}){
  return <div className="emptyState"><strong>{title}</strong><span>{text}</span></div>;
}
