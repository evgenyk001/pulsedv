import { PageFrame } from "../components/PageFrame";
import { usePulseState } from "../data";
import { updatePulseState } from "../../../../packages/pulse-data";

export function SelectPage(){
  const state=usePulseState();
  const patch=(patch:Partial<typeof state.select>)=>updatePulseState(current=>({...current,select:{...current.select,...patch}}));
  const patchWeight=(key:keyof typeof state.select.weights,value:number)=>patch({weights:{...state.select.weights,[key]:value}});

  return <PageFrame eyebrow="MATCHING" title="PULSE Select" description="Опции анкеты и веса ранжирования — одно место управления.">
    <section className="panel">
      <span className="kicker">Опции Mini App</span>
      <div className="formGrid">
        <label className="controlField wide"><span>Города через запятую</span><input value={state.select.cities.join(", ")} onChange={e=>patch({cities:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})}/></label>
        <label className="controlField wide"><span>Комнаты</span><input value={state.select.roomOptions.join(", ")} onChange={e=>patch({roomOptions:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})}/></label>
        <label className="controlField wide"><span>Сроки сдачи</span><input value={state.select.deliveryOptions.join(", ")} onChange={e=>patch({deliveryOptions:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})}/></label>
        <label className="switchControl"><span><b>Ипотека</b><small>Показывать переключатель в финальном шаге.</small></span><input type="checkbox" checked={state.select.mortgageEnabled} onChange={e=>patch({mortgageEnabled:e.target.checked})}/></label>
        <label className="switchControl"><span><b>Вид на море</b><small>Показывать мягкий приоритет.</small></span><input type="checkbox" checked={state.select.seaEnabled} onChange={e=>patch({seaEnabled:e.target.checked})}/></label>
      </div>
    </section>
    <section className="panel">
      <span className="kicker">Вес ранжирования</span>
      <div className="weightGrid">
        {Object.entries(state.select.weights).map(([key,value])=><label className="controlField" key={key}><span>{key}</span><input type="number" min="0" max="100" value={value} onChange={e=>patchWeight(key as keyof typeof state.select.weights,Number(e.target.value))}/></label>)}
      </div>
    </section>
  </PageFrame>;
}
