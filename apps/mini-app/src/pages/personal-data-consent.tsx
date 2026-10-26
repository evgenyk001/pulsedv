import {BackLink} from "../components/BackLink";
import {IconTile} from '../components/IconTile';
import {LegalOperator} from '../components/LegalOperator';
import { Link } from "react-router-dom";
import { FileCheck2 } from "lucide-react";
import styles from "./legal.module.css";

export default function PersonalDataConsentPage(){
  return <div className={styles.page}>
    <header data-app-back-row className={styles.topbar}>
      <BackLink to="/profile" aria-label="Назад в профиль"/>
      <span>Согласие</span>
    </header>

    <section className={styles.hero}>
      <IconTile className={styles.icon}><FileCheck2 size={24}/></IconTile>
      <div><small>PULSEDV.RU</small><h1>Согласие на обработку персональных данных</h1><p>Версия от 29 сентября 2026 года</p></div>
    </section>

    <PersonalDataConsentDocument/>

    <div className={styles.links}><Link to="/privacy">Политика обработки персональных данных</Link></div>
  </div>;
}

export function PersonalDataConsentDocument(){return (
    <article className={styles.document}>
      <section><p>Я свободно, своей волей и в своём интересе даю указанному ниже оператору PULSEDV.RU согласие на обработку моих персональных данных для обработки моего обращения, связи со мной и подбора недвижимости.</p></section>

      <section><h2>Оператор и контакт для отзыва согласия</h2><LegalOperator/></section>
      <section><h2>Какие данные</h2><p>Имя, номер телефона, данные Telegram, если они передаются сервисом, а также сведения, которые я самостоятельно сообщаю в заявке или переписке.</p></section>

      <section><h2>Что можно делать с данными</h2><p>Собирать, записывать, систематизировать, хранить, уточнять, использовать и удалять данные в объёме, необходимом для указанных целей.</p></section>

      <section><h2>Партнёрская программа</h2><p>Подключаясь к программе, я разрешаю использовать мои контактные данные для работы с рекомендациями и выплатами, а указанное мной имя — для представления меня в приглашении покупателю. Покупатель отдельно подтверждает рекомендацию и передачу ограниченных статусов партнёру в своей заявке; обычное согласие на обработку заявки этого не включает.</p></section>

      <section><h2>Срок действия</h2><p>Согласие действует до достижения целей обработки или до его отзыва, если дальнейшая обработка не требуется или не допускается на ином законном основании.</p></section>

      <section><h2>Как отозвать согласие</h2><p>Отзыв можно направить через форму связи с PULSEDV.RU. После получения обращения обработка прекращается в той части, в которой отсутствуют иные законные основания для её продолжения.</p></section>
    </article>
);}
