import React from "react";
import {
  getPulseState, listPulseEvents, listPulseLeads, listPulseProfiles, listPulseTasks,
  subscribePulseEvents, subscribePulseLeads, subscribePulseProfiles, subscribePulseState, subscribePulseTasks,
  type PulseEvent, type PulseLead, type PulseState, type PulseTask, type PulseVisitorProfile
} from "../../../packages/pulse-data";

export function usePulseState(){
  const [state,setState]=React.useState<PulseState>(getPulseState);
  React.useEffect(()=>subscribePulseState(()=>setState(getPulseState())),[]);
  return state;
}

export function usePulseLeads(){
  const [leads,setLeads]=React.useState<PulseLead[]>(listPulseLeads);
  React.useEffect(()=>subscribePulseLeads(()=>setLeads(listPulseLeads())),[]);
  return leads;
}

export function usePulseEvents(){
  const [events,setEvents]=React.useState<PulseEvent[]>(listPulseEvents);
  React.useEffect(()=>subscribePulseEvents(()=>setEvents(listPulseEvents())),[]);
  return events;
}


export function usePulseProfiles(){
  const [profiles,setProfiles]=React.useState<PulseVisitorProfile[]>(listPulseProfiles);
  React.useEffect(()=>subscribePulseProfiles(()=>setProfiles(listPulseProfiles())),[]);
  return profiles;
}

export function usePulseTasks(){
  const [tasks,setTasks]=React.useState<PulseTask[]>(listPulseTasks);
  React.useEffect(()=>subscribePulseTasks(()=>setTasks(listPulseTasks())),[]);
  return tasks;
}
