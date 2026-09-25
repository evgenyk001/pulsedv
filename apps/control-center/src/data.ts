import React from "react";
import {
  getPulseState, listPulseEvents, listPulseLeads,
  subscribePulseEvents, subscribePulseLeads, subscribePulseState,
  type PulseEvent, type PulseLead, type PulseState
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
