import { Clock3, Flame, MoveRight } from "lucide-react";
import { PageFrame } from "../components/PageFrame";
import { usePulseLeads, usePulseTasks } from "../data";
import { updatePulseTask, type PulseTask } from "../../../../packages/pulse-data";

const columns:{status:PulseTask["status"];title:string}[]=[
  {status:"today",title:"Сегодня"},
  {status:"in_progress",title:"В работе"},
  {status:"waiting",title:"Ожидает"},
  {status:"done",title:"Готово"},
];

export function TasksPage(){
  const tasks=usePulseTasks();
  const leads=usePulseLeads();
  const leadName=(leadId:string|null)=>leads.find(lead=>lead.id===leadId)?.name||"Пользователь";
  const nextStatus=(status:PulseTask["status"]):PulseTask["status"]=>status==="today"?"in_progress":status==="in_progress"?"waiting":status==="waiting"?"done":"done";

  return <PageFrame eyebrow="OPERATIONS" title="Задачи" description="Lead Engine создаёт задачи автоматически после получения контакта и пересчитывает приоритет по поведению клиента.">
    <section className="kanban">
      {columns.map(column=>{
        const list=tasks.filter(task=>task.status===column.status).sort((a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt));
        return <div className="kanbanCol" key={column.status}>
          <div className="kanbanTitle"><b>{column.title}</b><span>{list.length}</span></div>
          {list.length===0?<div className="miniEmpty">Нет задач</div>:<div className="taskStack">{list.map(task=><article className={"taskCard "+task.priority} key={task.id}>
            <div className="taskTop"><span>{task.priority==="urgent"?<Flame size={14}/>:<Clock3 size={14}/>} {task.priority}</span><b>{leadName(task.leadId)}</b></div>
            <h3>{task.title}</h3>
            <p>{task.reason}</p>
            <small className={task.status!=="done"&&Date.parse(task.dueAt)<Date.now()?"overdue":""}>{task.status!=="done"&&Date.parse(task.dueAt)<Date.now()?"Просрочено · ":"До "}{new Date(task.dueAt).toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</small>
            {task.status!=="done"&&<button onClick={()=>updatePulseTask(task.id,{status:nextStatus(task.status)})}>Дальше <MoveRight size={14}/></button>}
          </article>)}</div>}
        </div>
      })}
    </section>
  </PageFrame>;
}
