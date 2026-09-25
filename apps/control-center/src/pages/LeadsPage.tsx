import React from "react";
import { Filter, Flame, Gauge, Sparkles } from "lucide-react";
import { PageFrame } from "../components/PageFrame";
import { usePulseLeads, usePulseState } from "../data";
import { updatePulseLead, type PulseLead } from "../../../../packages/pulse-data";

const statuses:PulseLead["status"][]=["new","contacted","qualified","showing","booking","deal","closed","lost"];
const labels:Record<PulseLead["status"],string>={new:"Новый",contacted:"Связались",qualified:"Квалифицирован",showing:"Показ",booking:"Бронь",deal:"Сделка",closed:"Закрыт",lost:"Потерян"};
const priorityLabel=(priority:PulseLead["priority"])=>priority==="urgent"?"Срочно":priority==="hot"?"Горячий":priority==="warm"?"Тёплый":"Холодный";

export function LeadsPage(){
  const leads=usePulseLeads();
  const state=usePulseState();
  const [mode,setMode]=React.useState<"all"|"hot"|"new">("all");
  const visible=leads.filter(lead=>mode==="all"||mode==="new"?mode==="all"||lead.status==="new":lead.priority==="urgent"||lead.priority==="hot");
  const propertyName=(id:string|null|undefined)=>state.properties.find(item=>item.id===id)?.name||id||"—";

  return <PageFrame eyebrow="CRM" title="Лиды" description="Очередь продаж отсортирована по реальному интересу пользователя, а не только по времени заявки.">
    <div className="toolbar">
      <div className="segmented">
        <button className={mode==="all"?"active":""} onClick={()=>setMode("all")}>Все · {leads.length}</button>
        <button className={mode==="hot"?"active":""} onClick={()=>setMode("hot")}>Горячие · {leads.filter(x=>x.priority==="urgent"||x.priority==="hot").length}</button>
        <button className={mode==="new"?"active":""} onClick={()=>setMode("new")}>Новые · {leads.filter(x=>x.status==="new").length}</button>
      </div>
      <button className="iconAction" aria-label="Фильтры"><Filter size={17}/></button>
    </div>

    <section className="tableCard liveTable">
      <div className="tableHead leadsScoreGrid"><span>Клиент</span><span>Интерес</span><span>Статус</span><span>Менеджер</span><span>Следующее действие</span></div>
      {visible.length===0?<div className="emptyState"><strong>Здесь пока пусто</strong><span>Lead Engine автоматически поднимет наверх заявки с сильным намерением.</span></div>:visible.map(lead=>{
        const score=lead.score??0;
        const reasons=lead.scoreReasons??[];
        return <div className="tableRow leadsScoreGrid" key={lead.id}>
          <span className="leadName"><b>{lead.name}</b><small>{lead.phone}</small><small>{lead.source}</small></span>
          <span className="scoreCell">
            <span className={"scoreBadge "+(lead.priority||"cold")}><Gauge size={13}/><b>{score}</b><small>{priorityLabel(lead.priority)}</small></span>
            <small>{propertyName(lead.topPropertyId||lead.propertyId)}</small>
            {reasons[0]&&<em><Sparkles size={11}/>{reasons[0].label} +{reasons[0].points}</em>}
          </span>
          <select className="cellSelect" value={lead.status} onChange={e=>updatePulseLead(lead.id,{status:e.target.value as PulseLead["status"]})}>{statuses.map(status=><option value={status} key={status}>{labels[status]}</option>)}</select>
          <input className="cellInput" placeholder="Менеджер" value={lead.manager||""} onChange={e=>updatePulseLead(lead.id,{manager:e.target.value||null})}/>
          <span className="nextAction">{lead.priority==="urgent"&&<Flame size={14}/>}<b>{lead.nextAction||"Связаться и уточнить задачу"}</b><small>{new Date(lead.updatedAt).toLocaleString("ru-RU")}</small></span>
        </div>
      })}
    </section>
  </PageFrame>;
}
