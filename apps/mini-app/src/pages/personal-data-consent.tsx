import { Link } from "react-router-dom";
import { ChevronLeft, FileCheck2 } from "lucide-react";
import styles from "./legal.module.css";

export default function PersonalDataConsentPage(){
  return <div className={styles.page}>
    <header className={styles.topbar}>
      <Link to="/profile" aria-label="Назад в профиль"><ChevronLeft size={20}/></Link>
      <span>Согласие</span>
    </header>

    <section className={styles.hero}>
      <span className={styles.icon}><FileCheck2 size={24}/></span>
      <div><small>PULSE.DV</small><h1>Согласие на обработку персональных данных</h1><p>Версия от 29 сентября 2026 года</p></div>
    </section>

    <article className={styles.document}>
      <section><p>Я свободно, своей волей и в своём интересе даю PULSE.DV согласие на обработку моих персональных данных для обработки моего обращения, связи со мной и подбора недвижимости.</p></section>

      <section><h2>Какие данные</h2><p>Имя, номер телефона, данные Telegram, если они передаются сервисом, а также сведения, которые я самостоятельно сообщаю в заявке или переписке.</p></section>

      <section><h2>Что можно делать с данными</h2><p>Собирать, записывать, систематизировать, хранить, уточнять, использовать и удалять данные в объёме, необходимом для указанных целей.</p></section>

      <section><h2>Срок действия</h2><p>Согласие действует до достижения целей обработки или до его отзыва, если дальнейшая обработка не требуется или не допускается на ином законном основании.</p></section>

      <section><h2>Как отозвать согласие</h2><p>Отзыв можно направить через форму связи с PULSE.DV. После получения обращения обработка прекращается в той части, в которой отсутствуют иные законные основания для её продолжения.</p></section>
    </article>

    <div className={styles.links}><Link to="/privacy">Политика обработки персональных данных</Link></div>
  </div>;
}
