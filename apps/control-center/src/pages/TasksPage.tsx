import {Commitments} from '../components/Commitments';
import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Clock3, Flame, ArrowUpRight, Search } from 'lucide-react';
import { PageFrame } from '../components/PageFrame';
import { useControlPaging, usePulseLeads, usePulseTasks } from '../data';
import { priorityName } from '../activityCopy';
import { updatePulseTask, type PulseTask } from '../../../../packages/pulse-data';
import { runtime, updateRemote } from '../../../../packages/pulse-data/runtime';
const columns:{status:PulseTask['status'];title:string}[]=[{status:'today',title:'Запланировано'},{status:'in_progress',title:'В работе'},{status:'waiting',title:'Ожидает ответа'},{status:'done',title:'Завершено'}];
export function TasksPage(){
 const tasks=usePulseTasks(),leads=usePulseLeads();const paging=useControlPaging('tasks');const [params,setParams]=useSearchParams();
 const [query,setQuery]=React.useState(''),[busy,setBusy]=React.useState<string|null>(null),[error,setError]=React.useState('');
 const overdueOnly=params.get('filter')==='overdue';
 const visible=tasks.filter(t=>(!overdueOnly||(t.status!=='done'&&Date.parse(t.dueAt)<Date.now()))&&[t.title,t.reason,leads.find(l=>l.id===t.leadId)?.name].join(' ').toLowerCase().includes(query.toLowerCase()));
 const move=async(task:PulseTask,status:PulseTask['status'])=>{setBusy(task.id);setError('');try{if(runtime.enabled)await updateRemote('tasks',task.id,{status,expectedUpdatedAt:task.updatedAt});else updatePulseTask(task.id,{status});}catch(e){setError(e instanceof Error?e.message:'Не удалось изменить задачу');}finally{setBusy(null)}};
 return <PageFrame eyebrow="РАБОТА КОМАНДЫ" title="Задачи под контролем" description="Сроки, ответственные клиенты и следующий шаг. Меняйте этап прямо на карточке.">
  <Commitments/><div className="toolbar"><div className="segmented"><button className={!overdueOnly?'active':''} onClick={()=>setParams({})}>Все задачи · {tasks.length}</button><button className={overdueOnly?'active':''} onClick={()=>setParams({filter:'overdue'})}>Просроченные · {tasks.filter(t=>t.status!=='done'&&Date.parse(t.dueAt)<Date.now()).length}</button></div><label className="controlSearch"><Search size={17}/><input aria-label="Поиск задачи" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Клиент или задача"/></label></div>
  {error&&<div className="errorNotice" role="alert">{error}</div>}
  <section className="kanban">{columns.map(column=>{const list=visible.filter(t=>t.status===column.status).sort((a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt));return <div className={'kanbanCol stage-'+column.status} key={column.status}><div className="kanbanTitle"><b>{column.title}</b><span>{list.length}</span></div>{!list.length?<div className="miniEmpty">Здесь пока нет задач</div>:<div className="taskStack">{list.map(task=>{const lead=leads.find(l=>l.id===task.leadId);const late=task.status!=='done'&&Date.parse(task.dueAt)<Date.now();return <article className={'taskCard '+task.priority} key={task.id}><div className="taskTop"><span>{task.priority==='urgent'?<Flame size={14}/>:<Clock3 size={14}/>} {priorityName(task.priority)}</span></div><h3>{task.title}</h3>{lead&&<Link className="taskClient" to={'/leads?lead='+lead.id}>{lead.name}<ArrowUpRight size={14}/></Link>}<p>{task.reason}</p><small className={late?'overdue':''}>{late?'Просрочено · ':task.status==='done'?'Плановый срок · ':'До '}{new Date(task.dueAt).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</small><label className="taskStage"><span>Этап задачи</span><select aria-label={'Этап задачи: '+task.title} disabled={busy!==null} value={task.status} onChange={e=>void move(task,e.target.value as PulseTask['status'])}>{columns.map(c=><option key={c.status} value={c.status}>{c.title}</option>)}</select></label></article>})}</div>}</div>})}</section>
 </PageFrame>;
}
