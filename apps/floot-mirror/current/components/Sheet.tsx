"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import styles from "./Sheet.module.css"

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close
const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={`${styles.overlay} ${className ?? ""}`}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> {
  side?: "top" | "bottom" | "left" | "right";
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({
  side = "right",
  className,
  children,
  style,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  ...props
}, forwardedRef) => {
  const contentRef=React.useRef<HTMLDivElement|null>(null)
  const closeRef=React.useRef<HTMLButtonElement|null>(null)
  const drag=React.useRef({
    pointerId:-1,
    startY:0,
    lastY:0,
    lastT:0,
    velocity:0,
    started:false,
    blocked:false,
  })
  const [dragY,setDragY]=React.useState(0)
  const [dragging,setDragging]=React.useState(false)

  const setRef=React.useCallback((node:HTMLDivElement|null)=>{
    contentRef.current=node
    if(typeof forwardedRef==="function")forwardedRef(node)
    else if(forwardedRef)forwardedRef.current=node
  },[forwardedRef])

  const isInteractive=(target:EventTarget|null)=>{
    if(!(target instanceof Element))return false
    return Boolean(target.closest("button,a,input,textarea,select,[role='slider'],[data-sheet-no-drag]"))
  }

  const begin=(event:React.PointerEvent<HTMLDivElement>)=>{
    onPointerDown?.(event)
    if(event.defaultPrevented||side!=="bottom"||event.button!==0)return
    const node=contentRef.current
    if(!node||node.scrollTop>1||isInteractive(event.target))return
    drag.current={
      pointerId:event.pointerId,
      startY:event.clientY,
      lastY:event.clientY,
      lastT:performance.now(),
      velocity:0,
      started:false,
      blocked:false,
    }
  }

  const move=(event:React.PointerEvent<HTMLDivElement>)=>{
    onPointerMove?.(event)
    if(side!=="bottom"||drag.current.pointerId!==event.pointerId||drag.current.blocked)return
    const dy=event.clientY-drag.current.startY
    if(!drag.current.started){
      if(dy<-6){
        drag.current.blocked=true
        return
      }
      if(dy<=6)return
      if((contentRef.current?.scrollTop??0)>1){
        drag.current.blocked=true
        return
      }
      drag.current.started=true
      setDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    if(dy<0)return
    event.preventDefault()
    const now=performance.now()
    const ddy=event.clientY-drag.current.lastY
    const dt=Math.max(5,now-drag.current.lastT)
    const instant=ddy/dt
    drag.current.velocity=drag.current.velocity*.62+instant*.38
    drag.current.lastY=event.clientY
    drag.current.lastT=now
    const softened=dy<180?dy:180+(dy-180)*.42
    setDragY(softened)
  }

  const end=(event:React.PointerEvent<HTMLDivElement>)=>{
    onPointerUp?.(event)
    if(side!=="bottom"||drag.current.pointerId!==event.pointerId)return
    if(drag.current.started&&event.currentTarget.hasPointerCapture(event.pointerId)){
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if(drag.current.started){
      const height=contentRef.current?.getBoundingClientRect().height??500
      const shouldClose=dragY>Math.min(132,height*.24)||drag.current.velocity>.62
      if(shouldClose){
        setDragging(false)
        closeRef.current?.click()
      }else{
        setDragging(false)
        setDragY(0)
      }
    }
    drag.current.pointerId=-1
    drag.current.started=false
    drag.current.blocked=false
  }

  const cancel=(event:React.PointerEvent<HTMLDivElement>)=>{
    onPointerCancel?.(event)
    if(side!=="bottom")return
    setDragging(false)
    setDragY(0)
    drag.current.pointerId=-1
    drag.current.started=false
    drag.current.blocked=false
  }

  return <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={setRef}
      className={`${styles.content} ${styles[side]} ${dragging?styles.dragging:""} ${className ?? ""}`}
      style={side==="bottom"?({...style,"--sheet-drag-y":`${dragY}px`} as React.CSSProperties):style}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={cancel}
      {...props}
    >
      {side==="bottom"&&<div className={styles.grabZone} aria-hidden="true"><span className={styles.grabber}/></div>}
      {children}
      <SheetPrimitive.Close ref={closeRef} className={styles.close}>
        <X className={styles.closeIcon} />
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPortal>
})
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`${styles.header} ${className ?? ""}`} {...props} />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`${styles.footer} ${className ?? ""}`} {...props} />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title ref={ref} className={`${styles.title} ${className ?? ""}`} {...props} />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description ref={ref} className={`${styles.description} ${className ?? ""}`} {...props} />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}