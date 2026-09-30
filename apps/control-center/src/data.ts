import React from "react";
import {
  getPulseState, listPulseEvents, listPulseLeads, listPulseProfiles, listPulseTasks,
  subscribePulseEvents, subscribePulseLeads, subscribePulseProfiles, subscribePulseState, subscribePulseTasks,
  type PulseEvent, type PulseLead, type PulseState, type PulseTask, type PulseVisitorProfile
} from "../../../packages/pulse-data";
import { loadMoreControlResource, refreshControlResource, runtime, subscribeRuntime, type ControlCounts, type ControlResource } from "../../../packages/pulse-data/runtime";

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


export function usePulseCounts():ControlCounts{
  const [,render]=React.useReducer((value:number)=>value+1,0);
  React.useEffect(()=>{
    const cleanups=[
      subscribeRuntime(render),
      subscribePulseLeads(render),
      subscribePulseTasks(render),
      subscribePulseProfiles(render),
    ];
    return()=>cleanups.forEach(cleanup=>cleanup());
  },[]);
  if(runtime.enabled)return runtime.counts;
  const leads=listPulseLeads(),tasks=listPulseTasks(),profiles=listPulseProfiles();
  const leadStages:ControlCounts["leadStages"]={new:0,contacted:0,qualified:0,showing:0,booking:0,deal:0,closed:0,lost:0};
  leads.forEach(lead=>{leadStages[lead.status]=(leadStages[lead.status]||0)+1});
  return {
    leadsTotal:leads.length,
    activeLeads:leads.filter(lead=>!["deal","closed","lost"].includes(lead.status)).length,
    newLeads:leadStages.new,
    unassignedLeads:leads.filter(lead=>!lead.manager&&!["deal","closed","lost"].includes(lead.status)).length,
    openTasks:tasks.filter(task=>task.status!=="done").length,
    overdueTasks:tasks.filter(task=>task.status!=="done"&&Date.parse(task.dueAt)<Date.now()).length,
    hotProfiles:profiles.filter(profile=>profile.priority==="hot"||profile.priority==="urgent").length,
    leadStages,
  };
}
