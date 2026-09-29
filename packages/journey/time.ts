const VLADIVOSTOK_OFFSET_MS=10*60*60*1000;

export function vladivostokInputNow(offsetMinutes=1){
  return new Date(Date.now()+VLADIVOSTOK_OFFSET_MS+offsetMinutes*60_000).toISOString().slice(0,16);
}

export function vladivostokInputToIso(value:string){
  if(!value)return null;
  const parsed=Date.parse(value+"+10:00");
  return Number.isFinite(parsed)?new Date(parsed).toISOString():null;
}

export function isFutureVladivostokInput(value:string,offsetMinutes=0){
  const iso=vladivostokInputToIso(value);
  return !!iso&&Date.parse(iso)>Date.now()+offsetMinutes*60_000;
}
