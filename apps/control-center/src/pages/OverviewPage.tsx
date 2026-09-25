import { ShieldCheck } from "lucide-react";
import { PageFrame } from "../components/PageFrame";

export function OverviewPage(){
  return <PageFrame eyebrow="CONTROL CENTER" title="Операционная панель PULSE.DV" description="Отдельная приватная зона команды. Публичный Mini App больше не содержит admin-интерфейс.">
    <section className="metrics">
      <article><span>Новые лиды</span><strong>—</strong><small>после подключения backend</small></article>
      <article><span>Активные объекты</span><strong>—</strong><small>единый каталог</small></article>
      <article><span>Задачи</span><strong>—</strong><small>pipeline менеджеров</small></article>
      <article><span>Конверсия</span><strong>—</strong><small>после user_events</small></article>
    </section>
    <section className="panel">
      <div className="panelTitle"><ShieldCheck size={20}/><div><span>Архитектура</span><h2>Control Center физически отделён</h2></div></div>
      <p>Следующий слой — отдельная серверная авторизация, RBAC и подключение общей базы. Floot admin baseline остаётся в репозитории только как migration reference.</p>
    </section>
  </PageFrame>;
}
