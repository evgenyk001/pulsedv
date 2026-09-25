import React from "react";
import { getPulseState, subscribePulseState } from "../../../../packages/pulse-data";

export function usePulseControlState(){
  const [state,setState]=React.useState(getPulseState);
  React.useEffect(()=>subscribePulseState(()=>setState(getPulseState())),[]);
  return state;
}
