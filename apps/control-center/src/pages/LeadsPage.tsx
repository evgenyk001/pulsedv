import { Filter, Plus } from "lucide-react";
import { EmptyState, PageFrame } from "../components/PageFrame";

export function LeadsPage(){
  return <PageFrame eyebrow="CRM" title="Лиды" description="Воронка, назначение менеджеров и полная история взаимодействий."
    action={<button className="primaryAction"><Plus size={16}/>Новый лид</button>}>
    <div className="toolbar">
      <div className="segmented"><button className="active">Все</button><button>Новые</button><button>В работе</button><button>Сделка</button></div>
      <button className="iconAction" aria-label="Фильтры"><Filter size={17}/></button>
    </div>
    <section className="tableCard">
      <div className="tableHead leadsGrid"><span>Клиент</span><span>Источник</span><span>Статус</span><span>Менеджер</span><span>Последнее действие</span></div>
      <EmptyState title="Лиды пока не подключены" text="После подключения backend здесь появятся лиды из Mini App, бота и ручного ввода."/>
    </section>
  </PageFrame>;
}
