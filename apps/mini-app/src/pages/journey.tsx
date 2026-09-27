import React from 'react';
import {JourneyPanel} from '../../../../packages/journey/JourneyPanel';
import {loadJourneys} from '../../../../packages/journey/client';
import {getPropertiesByIds} from '../helpers/catalogApi';
import type {PulseProperty} from '../../../../packages/pulse-data/model';
export default function JourneyPage(){
 const [properties,setProperties]=React.useState<PulseProperty[]>([]),[error,setError]=React.useState('');
 React.useEffect(()=>{let active=true;loadJourneys(true).then(data=>getPropertiesByIds([...new Set(data.items.flatMap(e=>[e.propertyId,...e.journey.collections.flatMap(c=>c.items.map(i=>i.propertyId)),...e.journey.showings.map(s=>s.propertyId)]).filter((x):x is string=>!!x))])).then(p=>{if(active)setProperties(p)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[]);
 return <>{error&&<p role="alert">{error}</p>}<JourneyPanel client properties={properties}/></>;
}
