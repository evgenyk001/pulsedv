import { Filter } from "lucide-react";
import { PageFrame } from "../components/PageFrame";
import { usePulseLeads } from "../data";
import { updatePulseLead, type PulseLead } from "../../../../packages/pulse-data";

const statuses:PulseLead["status"][]=["new","contacted","qualified","showing","booking","deal","closed","lost"];
const labels:Record<PulseLead["status"],string>={new:"Новый",contacted:"Связались",qualified:"Квалифицирован",showing:"Показ",booking:"Бронь",deal:"Сделка",closed:"Закрыт",lost:"Потерян"};

export function LeadsPage(){
  const leads=usePulseLeads();
  return <PageFrame eyebrow="CRM" title="Лиды" description="Заявки из Mini App появляются здесь автоматически.">
    <div className="toolbar">
      <div className="segmented"><button className="active">Все · {leads.length}</button><button>Новые · {leads.filter(x=>x.status==="new").length}</button></div>
      <button className="iconAction" aria-label="Фильтры"><Filter size={17}/></button>
    </div>
    <section className="tableCard liveTable">
      <div className="tableHead leadsGrid"><span>Клиент</span><span>Источник</span><span>Статус</span><span>Менеджер</span><span>Последнее действие</span></div>
      {leads.length===0?<div className="emptyState"><strong>Пока нет лидов</strong><span>Отправьте тестовую заявку из Mini App — она появится здесь без перезагрузки.</span></div>:leads.map(lead=><div className="tableRow leadsGrid" key={lead.id}>
        <span className="leadName"><b>{lead.name}</b><small>{lead.phone}</small></span>
        <span>{lead.source}</span>
        <select className="cellSelect" value={lead.status} onChange={e=>updatePulseLead(lead.id,{status:e.target.value as PulseLead["status"]})}>{statuses.map(status=><option value={status} key={status}>{labels[status]}</option>)}</select>
        <input className="cellInput" placeholder="Менеджер" value={lead.manager||""} onChange={e=>updatePulseLead(lead.id,{manager:e.target.value||null})}/>
        <span>{new Date(lead.updatedAt).toLocaleString("ru-RU")}</span>
      </div>)}
    </section>
  </PageFrame>;
}
