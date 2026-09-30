import { BadgePercent, CalendarRange, CircleDollarSign, Info, Landmark, Percent, WalletCards } from "lucide-react";
import { PageFrame } from "../components/PageFrame";
import { usePulseState } from "../data";
import { updatePulseState, type MortgageProgramRule } from "../../../../packages/pulse-data";

const rub=(value:number)=>new Intl.NumberFormat("ru-RU").format(value);

export function MortgagePage(){
  const state=usePulseState();
  const patch=(id:MortgageProgramRule["id"],patch:Partial<MortgageProgramRule>)=>updatePulseState(current=>({
    ...current,mortgagePrograms:current.mortgagePrograms.map(item=>item.id===id?{...item,...patch}:item)
  }));
  return <PageFrame eyebrow="FINANCE" title="Ипотека" description="Управляйте правилами ипотечного калькулятора. В боевом режиме изменения появляются в Mini App после сохранения настроек.">
    <section className="mortgageIntro panel">
      <div className="mortgageIntroIcon"><Landmark size={20}/></div>
      <div><span className="kicker">СВЯЗЬ С MINI APP</span><h2>Один источник ипотечных правил</h2><p>Ставка, первоначальный взнос, срок и лимиты используются клиентским калькулятором напрямую. Отдельных копий настроек нет.</p></div>
      <div className="mortgageSyncState"><i/><span>Синхронизация активна</span></div>
    </section>

    <div className="mortgagePrograms">
      {state.mortgagePrograms.map(program=><section className="mortgageProgram" key={program.id}>
        <header className="mortgageProgramHead">
          <div className="mortgageProgramTitle">
            <span className="mortgageProgramIcon"><BadgePercent size={18}/></span>
            <div><span className="kicker">{program.id}</span><h2>{program.label}</h2></div>
          </div>
          <span className="mortgageRateBadge">{program.rate}%</span>
        </header>

        <div className="mortgageProgramPreview" aria-label={"Параметры программы "+program.label}>
          <div><Percent size={15}/><span>Ставка</span><b>{program.rate}%</b></div>
          <div><WalletCards size={15}/><span>ПВ от</span><b>{program.minDownPct}%</b></div>
          <div><CalendarRange size={15}/><span>Срок</span><b>до {program.maxYears} лет</b></div>
          <div><CircleDollarSign size={15}/><span>Лимит</span><b>{rub(program.subsidizedLimit)} ₽</b></div>
        </div>

        <div className="mortgageForm">
          <label className="controlField"><span>Ставка, %</span><input aria-label={program.label+" — ставка, %"} type="number" step=".1" value={program.rate} onChange={e=>patch(program.id,{rate:Number(e.target.value)})}/></label>
          <label className="controlField"><span>Макс. срок, лет</span><input aria-label={program.label+" — максимальный срок, лет"} type="number" value={program.maxYears} onChange={e=>patch(program.id,{maxYears:Number(e.target.value)})}/></label>
          <label className="controlField"><span>Первоначальный взнос от, %</span><input aria-label={program.label+" — первоначальный взнос, %"} type="number" step=".1" value={program.minDownPct} onChange={e=>patch(program.id,{minDownPct:Number(e.target.value)})}/></label>
          <label className="controlField"><span>Льготный лимит, ₽</span><input aria-label={program.label+" — льготный лимит, ₽"} type="number" value={program.subsidizedLimit} onChange={e=>patch(program.id,{subsidizedLimit:Number(e.target.value)})}/></label>
          <label className="controlField"><span>Максимальный лимит, ₽</span><input aria-label={program.label+" — максимальный лимит, ₽"} type="number" value={program.totalLimit} onChange={e=>patch(program.id,{totalLimit:Number(e.target.value)})}/></label>
          <label className="controlField wide mortgageHintField"><span>Подсказка клиенту</span><div className="mortgageHintInput"><Info size={15}/><input aria-label={program.label+" — подсказка клиенту"} value={program.hint} onChange={e=>patch(program.id,{hint:e.target.value})}/></div></label>
        </div>
      </section>)}
    </div>
  </PageFrame>;
}
