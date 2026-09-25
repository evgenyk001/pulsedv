import { Plus } from "lucide-react";
import { EmptyState, PageFrame } from "../components/PageFrame";

export function ObjectsPage(){
  return <PageFrame eyebrow="CATALOG" title="Объекты" description="Застройщики, ЖК, корпуса, планировки, цены и публикация."
    action={<button className="primaryAction"><Plus size={16}/>Добавить объект</button>}>
    <section className="tableCard">
      <div className="tableHead objectsGrid"><span>ЖК</span><span>Город</span><span>Застройщик</span><span>Цена от</span><span>Статус</span></div>
      <EmptyState title="Каталог backend ещё не подключён" text="После миграции propertyRepository сюда перейдёт управление объектами из старого Floot admin."/>
    </section>
  </PageFrame>;
}
