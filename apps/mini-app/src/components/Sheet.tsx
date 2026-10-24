"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import styles from "./Sheet.module.css"

const SheetOpenContext = React.createContext(false)

function Sheet({open:controlledOpen,defaultOpen=false,onOpenChange,...props}:React.ComponentProps<typeof SheetPrimitive.Root>){
  const [localOpen,setLocalOpen]=React.useState(defaultOpen)
  const open=controlledOpen??localOpen
  const change=(next:boolean)=>{
    if(controlledOpen===undefined)setLocalOpen(next)
    onOpenChange?.(next)
  }
  return <SheetOpenContext.Provider value={open}><SheetPrimitive.Root {...props} open={open} onOpenChange={change}/></SheetOpenContext.Provider>
}
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close
const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    data-sheet-overlay=""
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

const idleDrag=()=>({pointerId:-1,startX:0,startY:0,lastY:0,lastT:0,velocity:0,offset:0,started:false,blocked:false})

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({side="right",className,children,style,onPointerDown,onPointerMove,onPointerUp,onPointerCancel,onLostPointerCapture,onOpenAutoFocus,onAnimationEnd,...props},forwardedRef)=>{
  const open=React.useContext(SheetOpenContext)
  // Owners often clear the selected record/form at the same time as open.
  // Keep the last committed view until the exit has finished, so the moving
  // sheet does not collapse or turn blank before Radix removes its portal.
  const lastOpenChildren=React.useRef(children)
  React.useLayoutEffect(()=>{if(open)lastOpenChildren.current=children},[open,children])
  const contentRef=React.useRef<HTMLDivElement|null>(null)
  const closeRef=React.useRef<HTMLButtonElement|null>(null)
  const drag=React.useRef(idleDrag())
  const [dragY,setDragY]=React.useState(0)
  const [dragging,setDragging]=React.useState(false)
  const [keepMounted,setKeepMounted]=React.useState(open)

  const clearPointer=React.useCallback(()=>{
    const id=drag.current.pointerId
    drag.current=idleDrag()
    const node=contentRef.current
    if(id!==-1&&node?.hasPointerCapture(id))node.releasePointerCapture(id)
  },[])

  const syncViewport=React.useCallback(()=>{
    const node=contentRef.current
    if(!node)return
    const viewport=window.visualViewport
    node.style.setProperty('--sheet-viewport-height',`${viewport?.height??window.innerHeight}px`)
    node.style.setProperty('--sheet-viewport-bottom',`${Math.max(0,window.innerHeight-(viewport?viewport.offsetTop+viewport.height:window.innerHeight))}px`)
  },[])

  const setRef=React.useCallback((node:HTMLDivElement|null)=>{
    contentRef.current=node
    if(node)syncViewport()
    if(typeof forwardedRef==="function")forwardedRef(node)
    else if(forwardedRef)forwardedRef.current=node
  },[forwardedRef,syncViewport])

  // SheetContent itself survives a portalled Dialog.Content unmount. Reset on
  // every open, including a reopen which interrupts the exit animation.
  React.useLayoutEffect(()=>{
    clearPointer()
    setDragging(false)
    if(open){
      setDragY(0)
      if(contentRef.current){contentRef.current.style.removeProperty('--sheet-exit-height');contentRef.current.scrollTop=0}
    }else if(side==='bottom'&&contentRef.current){
      contentRef.current.style.setProperty('--sheet-exit-height',`${contentRef.current.offsetHeight}px`)
    }
  },[open,side,clearPointer])

  // Own the bottom sheet's exit lifetime. Portal and Content otherwise each
  // infer presence from CSS animation events, which can race a quick dismissal.
  React.useLayoutEffect(()=>{
    if(side!=='bottom')return
    if(open){setKeepMounted(true);return}
    if(!keepMounted)return
    const css=contentRef.current?getComputedStyle(contentRef.current):null
    const duration=css&&css.animationName!=='none'?Math.max(...css.animationDuration.split(',').map(value=>parseFloat(value)*(value.trim().endsWith('ms')?1:1000))):0
    if(!duration){setKeepMounted(false);return}
    // Recover if a browser drops animationend (background tab or interrupted
    // rendering). Normal dismissal completes from the animation event itself.
    const timer=window.setTimeout(()=>setKeepMounted(false),duration+100)
    return()=>window.clearTimeout(timer)
  },[open,side,keepMounted])

  React.useLayoutEffect(()=>{
    if(!open||side!=="bottom")return
    let frame=0
    const update=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(syncViewport)}
    update()
    const viewport=window.visualViewport
    viewport?.addEventListener('resize',update)
    viewport?.addEventListener('scroll',update)
    window.addEventListener('resize',update)
    return()=>{cancelAnimationFrame(frame);viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update)}
  },[open,side,syncViewport])

  const begin=(event:React.PointerEvent<HTMLDivElement>)=>{
    onPointerDown?.(event)
    if(event.defaultPrevented||!open||side!=="bottom"||event.button!==0||drag.current.pointerId!==-1)return
    const target=event.target
    if(!(target instanceof Element)||!contentRef.current?.contains(target))return
    // A dedicated non-scrolling surface owns the gesture; forms keep native
    // touch scrolling, selection and controls, even when scrolled to the top.
    if(!target.closest('[data-sheet-handle],[data-sheet-header]')||target.closest("button,a,input,textarea,select,[role='slider'],[data-sheet-no-drag]"))return
    event.preventDefault()
    drag.current={...idleDrag(),pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,lastY:event.clientY,lastT:performance.now()}
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const move=(event:React.PointerEvent<HTMLDivElement>)=>{
    onPointerMove?.(event)
    const gesture=drag.current
    if(event.defaultPrevented||side!=="bottom"||gesture.pointerId!==event.pointerId||gesture.blocked)return
    const dy=event.clientY-gesture.startY
    if(!gesture.started){
      if(Math.abs(event.clientX-gesture.startX)>Math.abs(dy)&&Math.abs(event.clientX-gesture.startX)>6){gesture.blocked=true;return}
      if(Math.abs(dy)<=6)return
      gesture.started=true
      setDragging(true)
    }
    event.preventDefault()
    const now=performance.now()
    const instant=(event.clientY-gesture.lastY)/Math.max(5,now-gesture.lastT)
    gesture.velocity=gesture.velocity*.62+instant*.38
    gesture.lastY=event.clientY
    gesture.lastT=now
    gesture.offset=dy<0?-Math.min(20,Math.sqrt(-dy)*1.8):dy<=160?dy*.88:140.8+(dy-160)*.38
    setDragY(gesture.offset)
  }

  const end=(event:React.PointerEvent<HTMLDivElement>)=>{
    onPointerUp?.(event)
    const gesture=drag.current
    if(side!=="bottom"||gesture.pointerId!==event.pointerId)return
    const height=contentRef.current?.getBoundingClientRect().height??500
    const velocity=performance.now()-gesture.lastT<90?gesture.velocity:0
    const shouldClose=!event.defaultPrevented&&gesture.started&&(gesture.offset>Math.min(132,height*.24)||(gesture.offset>24&&velocity>.75))
    clearPointer()
    setDragging(false)
    if(shouldClose){
      closeRef.current?.click()
      // Controlled sheets may reject dismissal while saving. Return home if
      // the owner keeps the sheet open rather than leaving its drag offset.
      requestAnimationFrame(()=>{if(contentRef.current?.dataset.state==='open')setDragY(0)})
    }else setDragY(0)
  }

  const cancel=()=>{clearPointer();setDragging(false);setDragY(0)}

  if(side==='bottom'&&!open&&!keepMounted)return null

  return <SheetPortal forceMount={side==='bottom'?true:undefined}>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={setRef}
      className={`${styles.content} ${styles[side]} ${dragging?styles.dragging:""} ${className??""}`}
      style={side==="bottom"?({...style,"--sheet-drag-y":`${dragY}px`} as React.CSSProperties):style}
      onOpenAutoFocus={event=>{
        onOpenAutoFocus?.(event)
        if(side==='bottom'&&!event.defaultPrevented){event.preventDefault();contentRef.current?.focus({preventScroll:true})}
      }}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={event=>{onPointerCancel?.(event);if(drag.current.pointerId===event.pointerId)cancel()}}
      onLostPointerCapture={event=>{onLostPointerCapture?.(event);if(event.target===event.currentTarget&&drag.current.pointerId===event.pointerId)cancel()}}
      onAnimationEnd={event=>{
        onAnimationEnd?.(event)
        if(side==='bottom'&&!open&&event.target===event.currentTarget&&event.animationName===getComputedStyle(event.currentTarget).animationName)setKeepMounted(false)
      }}
      {...props}
      inert={props.inert||(side==='bottom'&&!open)}
    >
      {side==="bottom"&&<div className={styles.grabZone} data-sheet-handle="" aria-hidden="true"><span className={styles.grabber}/></div>}
      {side==='bottom'&&!open?lastOpenChildren.current:children}
      <SheetPrimitive.Close ref={closeRef} aria-label="Закрыть" className={styles.close}>
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
  <div data-sheet-header="" className={`${styles.header} ${className ?? ""}`} {...props} />
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
