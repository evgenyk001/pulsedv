import { ShieldCheck, UsersRound } from "lucide-react";
import { PageFrame } from "../components/PageFrame";

export function SettingsPage(){
  return <PageFrame eyebrow="SYSTEM" title="Настройки" description="Команда, роли, права и приватная инфраструктура Control Center.">
    <div className="settingsGrid">
      <section className="panel settingRow"><ShieldCheck size={20}/><div><h2>Auth + RBAC</h2><p>Отдельная серверная авторизация. Никакого admin-кода в публичном клиенте.</p></div><span className="statusChip">Следующий этап</span></section>
      <section className="panel settingRow"><UsersRound size={20}/><div><h2>Команда</h2><p>Роли: owner, admin, manager. Права на объекты, лиды, контент и аналитику.</p></div><span className="statusChip">План</span></section>
    </div>
  </PageFrame>;
}
