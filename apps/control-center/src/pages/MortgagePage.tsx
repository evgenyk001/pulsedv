import { PageFrame } from "../components/PageFrame";
import { usePulseState } from "../data";
import { updatePulseState, type MortgageProgramRule } from "../../../../packages/pulse-data";

export function MortgagePage(){
  const state=usePulseState();
  const patch=(id:MortgageProgramRule["id"],patch:Partial<MortgageProgramRule>)=>updatePulseState(current=>({
    ...current,mortgagePrograms:current.mortgagePrograms.map(item=>item.id===id?{...item,...patch}:item)
  }));
  return <PageFrame eyebrow="FINANCE" title="Ипотека" description="Правила калькулятора Mini App. Изменения сразу попадают в клиентский расчёт.">
    <div className="editorList">
      {state.mortgagePrograms.map(program=><section className="panel" key={program.id}>
        <div className="editorRowTop"><div><span className="kicker">{program.id}</span><h2>{program.label}</h2></div><span className="statusChip">{program.rate}%</span></div>
        <div className="formGrid">
          <label className="controlField"><span>Ставка, %</span><input type="number" step=".1" value={program.rate} onChange={e=>patch(program.id,{rate:Number(e.target.value)})}/></label>
          <label className="controlField"><span>Макс. срок, лет</span><input type="number" value={program.maxYears} onChange={e=>patch(program.id,{maxYears:Number(e.target.value)})}/></label>
          <label className="controlField"><span>ПВ от, %</span><input type="number" step=".1" value={program.minDownPct} onChange={e=>patch(program.id,{minDownPct:Number(e.target.value)})}/></label>
          <label className="controlField"><span>Льготный лимит, ₽</span><input type="number" value={program.subsidizedLimit} onChange={e=>patch(program.id,{subsidizedLimit:Number(e.target.value)})}/></label>
          <label className="controlField"><span>Макс. лимит, ₽</span><input type="number" value={program.totalLimit} onChange={e=>patch(program.id,{totalLimit:Number(e.target.value)})}/></label>
          <label className="controlField wide"><span>Подсказка</span><input value={program.hint} onChange={e=>patch(program.id,{hint:e.target.value})}/></label>
        </div>
      </section>)}
    </div>
  </PageFrame>;
}
