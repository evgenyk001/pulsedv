import React from 'react';
import type {ApartmentFinish,PulseProperty} from '../../../../packages/pulse-data/model';
import {Link} from 'react-router-dom';
import {propertyPriceLabel,propertyPriceRub,propertyMortgageLink} from '../../../../packages/domain/propertyPresentation';
import {apartmentFinishLabel,planFinishOffers,planPriceForFinish,planStartingPrice} from '../../../../packages/domain/propertyFinish';
import {Sheet,SheetTrigger,SheetContent,SheetHeader,SheetTitle,SheetDescription} from './Sheet';
import {LeadSheet} from './LeadSheet';
import './clientPolish.css';

export function FloorplanViewer({property,plan,preferredFinish}:{property:PulseProperty;plan:PulseProperty['floorplans'][number];preferredFinish?:ApartmentFinish|null}){
 const offers=planFinishOffers(plan);
 const preferred=offers.find(option=>option.finishType===preferredFinish)?.finishType??[...offers].filter(option=>option.priceFrom!==null).sort((a,b)=>(a.priceFrom??Infinity)-(b.priceFrom??Infinity))[0]?.finishType??offers[0]?.finishType??null;
 const [finish,setFinish]=React.useState<ApartmentFinish|null>(preferred);
 const [zoom,setZoom]=React.useState(1),[broken,setBroken]=React.useState(false);
 React.useEffect(()=>setFinish(preferred),[preferred]);
 const price=finish?planPriceForFinish(plan,finish):planStartingPrice(plan);
 const context={floorplanId:plan.id,rooms:plan.roomLabel,areaFrom:plan.areaFrom,areaTo:plan.areaTo,finishType:finish,price:price===null?null:propertyPriceRub(price)};
 return <Sheet onOpenChange={()=>setZoom(1)}><SheetTrigger asChild><button className="pulsePlanTrigger" aria-label={'Открыть планировку '+plan.roomLabel}>{plan.imageUrl&&!broken?<img src={plan.imageUrl} alt={'Планировка '+plan.roomLabel} loading="lazy" onError={()=>setBroken(true)}/>:<span>Изображение уточняется</span>}<small>Подробнее о планировке</small></button></SheetTrigger>
 <SheetContent side="right" className="pulsePlanViewer">
  <SheetHeader><SheetTitle>{property.name} · {plan.roomLabel}{plan.roomLabel==='Студия'?'':' комн.'}</SheetTitle>
   <SheetDescription>{plan.areaFrom===null?'Площадь уточняется':plan.areaFrom+(plan.areaTo&&plan.areaTo!==plan.areaFrom?'–'+plan.areaTo:'')+' м²'} · {price===null?'Цена уточняется':propertyPriceLabel(price)}</SheetDescription>
  </SheetHeader>
  {plan.imageUrl&&!broken?<><div className="pulsePlanTools"><button onClick={()=>setZoom(z=>Math.max(1,z-.5))} disabled={zoom===1} aria-label="Уменьшить планировку">−</button><span>{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(z=>Math.min(3,z+.5))} disabled={zoom===3} aria-label="Увеличить планировку">+</button></div><div className="pulsePlanCanvas" tabIndex={0} aria-label="Планировка с прокруткой"><img src={plan.imageUrl} alt={'Планировка '+plan.roomLabel} style={{width:zoom*100+'%',maxWidth:'none'}} onError={()=>setBroken(true)}/></div></>:<p>Изображение пока не загружено. Менеджер уточнит планировку и наличие.</p>}
  {offers.length>0&&<div role="group" aria-label="Выбор отделки и цены" style={{display:'grid',gap:7}}>
   <strong style={{fontSize:13}}>Выберите отделку</strong>
   {offers.map(offer=><button type="button" key={offer.finishType} aria-pressed={finish===offer.finishType} onClick={()=>setFinish(offer.finishType)} style={{display:'flex',gap:10,alignItems:'center',justifyContent:'space-between',border:'1px solid',borderColor:finish===offer.finishType?'var(--primary)':'var(--border)',background:finish===offer.finishType?'var(--brand-soft)':'var(--app-card)',color:'var(--foreground)',padding:12,borderRadius:14,font:'inherit',fontSize:12,fontWeight:650}}>
    <span>{apartmentFinishLabel(offer.finishType)}</span><strong>{offer.priceFrom!==null?propertyPriceLabel(offer.priceFrom):'Цена уточняется'}</strong>
   </button>)}
  </div>}
  {price!==null?<Link className="pulseClientAction" to={propertyMortgageLink(property,plan,finish)}>Рассчитать эту планировку</Link>:<p>Стоимость выбранной отделки уточняется. Расчёт ипотеки появится после подтверждения цены.</p>}
  <LeadSheet title="Интересует эта планировка" project={property.name} propertyId={property.id} source="floorplan" context={context}><button className="pulseClientAction">Уточнить наличие и цену</button></LeadSheet>
 </SheetContent></Sheet>;
}
