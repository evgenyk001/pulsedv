import { Gauge, ShieldCheck, SlidersHorizontal, UsersRound } from "lucide-react";
import { PageFrame } from "../components/PageFrame";
import { usePulseState } from "../data";
import { updatePulseState } from "../../../../packages/pulse-data";

export function SettingsPage(){
  const state=usePulseState();
  const engine=state.leadEngine;
  const updateThreshold=(key:"warm"|"hot"|"urgent",value:number)=>updatePulseState(current=>({
    ...current,
    leadEngine:{...current.leadEngine,thresholds:{...current.leadEngine.thresholds,[key]:Math.max(0,Math.min(100,value))}}
  }));
  const updateRule=(id:string,weight:number)=>updatePulseState(current=>({
    ...current,
    leadEngine:{...current.leadEngine,rules:current.leadEngine.rules.map(rule=>rule.id===id?{...rule,weight}:rule)}
  }));

  return <PageFrame eyebrow="SYSTEM" title="Настройки" description="Команда, роли и правила Lead Engine. Бизнес-логику можно менять без правки Mini App.">
    <div className="settingsGrid">
      <section className="panel settingRow"><ShieldCheck size={20}/><div><h2>Auth + RBAC</h2><p>Отдельная серверная авторизация. Никакого admin-кода в публичном клиенте.</p></div><span className="statusChip">Production этап</span></section>
      <section className="panel settingRow"><UsersRound size={20}/><div><h2>Команда</h2><p>Роли: owner, admin, manager. Права на объекты, лиды, контент и аналитику.</p></div><span className="statusChip">План</span></section>
    </div>

    <section className="panel">
      <div className="panelTitle"><Gauge size={20}/><div><span>LEAD ENGINE</span><h2>Пороги Interest Score</h2></div></div>
      <p>Профиль автоматически меняет температуру при накоплении намеренных действий.</p>
      <div className="thresholdGrid">
        {(["warm","hot","urgent"] as const).map(key=><label className="controlField" key={key}><span>{key.toUpperCase()}</span><input type="number" min={0} max={100} value={engine.thresholds[key]} onChange={e=>updateThreshold(key,Number(e.target.value)||0)}/></label>)}
      </div>
    </section>

    <section className="panel">
      <div className="panelTitle"><SlidersHorizontal size={20}/><div><span>SCORING RULES</span><h2>Вес пользовательских сигналов</h2></div></div>
      <p>Положительное значение усиливает намерение, отрицательное — ослабляет. Ограничение повторов защищает score от накрутки одним действием.</p>
      <div className="rulesTable">
        <div className="rulesHead"><span>Сигнал</span><span>event_type</span><span>Вес</span><span>Лимит повторов</span></div>
        {engine.rules.map(rule=><div className="rulesRow" key={rule.id}>
          <span><b>{rule.label}</b></span>
          <code>{rule.eventType}</code>
          <input type="number" value={rule.weight} onChange={e=>updateRule(rule.id,Number(e.target.value)||0)}/>
          <span>{rule.maxCount}</span>
        </div>)}
      </div>
    </section>
  </PageFrame>;
}
