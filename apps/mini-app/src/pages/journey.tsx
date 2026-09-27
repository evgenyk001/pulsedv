import React from 'react';
import {JourneyPanel} from '../../../../packages/journey/JourneyPanel';
import {type JourneyEntry} from '../../../../packages/journey/client';
import {getPropertiesByIds} from '../helpers/catalogApi';
import type {PulseProperty} from '../../../../packages/pulse-data/model';
export default function JourneyPage(){
 const [properties,setProperties]=React.useState<PulseProperty[]>([]),[error,setError]=React.useState('');
 const refreshProperties=React.useCallback((items:JourneyEntry[])=>{getPropertiesByIds([...new Set(items.flatMap(e=>[e.propertyId,...e.journey.collections.flatMap(c=>c.items.map(i=>i.propertyId)),...e.journey.showings.map(s=>s.propertyId)]).filter((x):x is string=>!!x))]).then(setProperties).catch(e=>setError(e.message))},[]);
 return <>{error&&<p role="alert">{error}</p>}<JourneyPanel client properties={properties} onRefreshed={refreshProperties}/></>;
}
