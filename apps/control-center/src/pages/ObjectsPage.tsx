import { Plus } from "lucide-react";
import { PageFrame } from "../components/PageFrame";
import { usePulseState } from "../data";
import { updatePulseState, type PulseProperty, type PropertyStatus } from "../../../../packages/pulse-data";

const freshProperty=():PulseProperty=>({
  id:"property-"+Date.now(),name:"Новый ЖК",city:"Владивосток",district:"",address:null,
  latitude:null,longitude:null,priceFrom:0,delivery:"",className:"",status:"draft",
  description:"",developerName:"",tags:[],coverImageUrl:null,sortOrder:999,
  images:[],features:[],floorplans:[]
});

export function ObjectsPage(){
  const state=usePulseState();
  const patch=(id:string,patch:Partial<PulseProperty>)=>updatePulseState(current=>({
    ...current,
    properties:current.properties.map(item=>item.id===id?{...item,...patch}:item)
  }));
  const add=()=>updatePulseState(current=>({...current,properties:[...current.properties,freshProperty()]}));

  return <PageFrame eyebrow="CATALOG" title="Объекты" description="Единый каталог Mini App: название, город, застройщик, цена и публикация."
    action={<button className="primaryAction" onClick={add}><Plus size={16}/>Добавить объект</button>}>
    <section className="tableCard liveTable">
      <div className="tableHead objectsGrid"><span>ЖК</span><span>Город</span><span>Застройщик</span><span>Цена от, млн</span><span>Статус</span></div>
      {state.properties.map(property=><div className="tableRow objectsGrid" key={property.id}>
        <input className="cellInput" value={property.name} onChange={e=>patch(property.id,{name:e.target.value})}/>
        <input className="cellInput" value={property.city} onChange={e=>patch(property.id,{city:e.target.value})}/>
        <input className="cellInput" value={property.developerName} onChange={e=>patch(property.id,{developerName:e.target.value})}/>
        <input className="cellInput" inputMode="decimal" value={property.priceFrom||""} onChange={e=>patch(property.id,{priceFrom:Number(e.target.value.replace(",","."))||0})}/>
        <select className="cellSelect" value={property.status} onChange={e=>patch(property.id,{status:e.target.value as PropertyStatus})}>
          <option value="published">Опубликован</option><option value="draft">Черновик</option><option value="archived">Архив</option>
        </select>
      </div>)}
    </section>
    <p className="syncNote">Изменения применяются к Mini App сразу в preview. В production этот же интерфейс будет работать через API/Postgres.</p>
  </PageFrame>;
}
