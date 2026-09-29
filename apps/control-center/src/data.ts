import React from "react";
import {
  getPulseState, listPulseEvents, listPulseLeads, listPulseProfiles, listPulseTasks,
  subscribePulseEvents, subscribePulseLeads, subscribePulseProfiles, subscribePulseState, subscribePulseTasks,
  type PulseEvent, type PulseLead, type PulseState, type PulseTask, type PulseVisitorProfile
} from "../../../packages/pulse-data";
import { loadMoreControlResource, refreshControlResource, runtime, subscribeRuntime, type ControlResource } from "../../../packages/pulse-data/runtime";

const refs:Record<ControlResource,number>={leads:0,tasks:0,events:0,profiles:0};
const timers:Partial<Record<ControlResource,number>>={};
function retain(kind:ControlResource){
 if(!runtime.enabled)return()=>{};
 refs[kind]++;
 if(refs[kind]===1){
  void refreshControlResource(kind).catch(()=>{});
  timers[kind]=window.setInterval(()=>{if(!document.hidden)void refreshControlResource(kind).catch(()=>{})},30000);
 }
 return()=>{
  refs[kind]=Math.max(0,refs[kind]-1);
  if(!refs[kind]&&timers[kind]){window.clearInterval(timers[kind]);delete timers[kind];}
 };
}
function useResource(kind:ControlResource){
 React.useEffect(()=>retain(kind),[kind]);
}
export function useControlPaging(kind:ControlResource){
 const [,render]=React.useReducer(x=>x+1,0);
 React.useEffect(()=>subscribeRuntime(render),[]);
 const meta=runtime.pages[kind];
 return {...meta,loadMore:()=>loadMoreControlResource(kind)};
}

export function usePulseState(){
  const [state,setState]=React.useState<PulseState>(getPulseState);
  React.useEffect(()=>subscribePulseState(()=>setState(getPulseState())),[]);
  return state;
}

export function usePulseLeads(){
  useResource("leads");
  const [leads,setLeads]=React.useState<PulseLead[]>(listPulseLeads);
  React.useEffect(()=>subscribePulseLeads(()=>setLeads(listPulseLeads())),[]);
  return leads;
}

export function usePulseEvents(){
  useResource("events");
  const [events,setEvents]=React.useState<PulseEvent[]>(listPulseEvents);
  React.useEffect(()=>subscribePulseEvents(()=>setEvents(listPulseEvents())),[]);
  return events;
}

export function usePulseProfiles(){
  useResource("profiles");
  const [profiles,setProfiles]=React.useState<PulseVisitorProfile[]>(listPulseProfiles);
  React.useEffect(()=>subscribePulseProfiles(()=>setProfiles(listPulseProfiles())),[]);
  return profiles;
}

export function usePulseTasks(){
  useResource("tasks");
  const [tasks,setTasks]=React.useState<PulseTask[]>(listPulseTasks);
  React.useEffect(()=>subscribePulseTasks(()=>setTasks(listPulseTasks())),[]);
  return tasks;
}
