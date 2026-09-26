import { TeamSettings } from "../components/TeamSettings";
import { Gauge, ShieldCheck, SlidersHorizontal, UsersRound } from "lucide-react";
import { PageFrame } from "../components/PageFrame";
import { usePulseState } from "../data";
import { eventTypeName } from "../activityCopy";
import { recalculatePulseLeadEngine, updatePulseState } from "../../../../packages/pulse-data";

const thresholdLabels={warm:"Тёплый",hot:"Горячий",urgent:"Срочный"} as const;

export function SettingsPage(){
  const state=usePulseState();
  const engine=state.leadEngine;
  const updateThreshold=(key:"warm"|"hot"|"urgent",value:number)=>{
    updatePulseState(current=>({
      ...current,
      leadEngine:{...current.leadEngine,thresholds:{...current.leadEngine.thresholds,[key]:Math.max(0,Math.min(100,value))}}
    }));
    recalculatePulseLeadEngine();
  };
  const updateRule=(id:string,weight:number)=>{
    updatePulseState(current=>({
      ...current,
      leadEngine:{...current.leadEngine,rules:current.leadEngine.rules.map(rule=>rule.id===id?{...rule,weight}:rule)}
    }));
    recalculatePulseLeadEngine();
  };

  return <PageFrame eyebrow="СИСТЕМА" title="Настройки" description="Команда, роли и правила оценки интереса. Бизнес-логику можно менять без правки Mini App.">
    <TeamSettings/>

    <section className="panel">
      <div className="panelTitle"><Gauge size={20}/><div><span>ОЦЕНКА ИНТЕРЕСА</span><h2>Пороги индекса интереса</h2></div></div>
      <p>Профиль автоматически меняет температуру при накоплении намеренных действий.</p>
      <div className="thresholdGrid">
        {(["warm","hot","urgent"] as const).map(key=><label className="controlField" key={key}><span>{thresholdLabels[key]}</span><input type="number" min={0} max={100} value={engine.thresholds[key]} onChange={e=>updateThreshold(key,Number(e.target.value)||0)}/></label>)}
      </div>
    </section>

    <section className="panel">
      <div className="panelTitle"><SlidersHorizontal size={20}/><div><span>ПРАВИЛА ОЦЕНКИ</span><h2>Вес пользовательских сигналов</h2></div></div>
      <p>Положительное значение усиливает интерес, отрицательное — ослабляет. Ограничение повторов защищает индекс от накрутки одним действием.</p>
      <div className="rulesTable">
        <div className="rulesHead"><span>Сигнал</span><span>Действие</span><span>Вес</span><span>Лимит повторов</span></div>
        {engine.rules.map(rule=><div className="rulesRow" key={rule.id}>
          <span><b>{rule.label}</b></span>
          <span>{eventTypeName(rule.eventType)}</span>
          <input type="number" value={rule.weight} onChange={e=>updateRule(rule.id,Number(e.target.value)||0)}/>
          <span>{rule.maxCount}</span>
        </div>)}
      </div>
    </section>
  </PageFrame>;
}
