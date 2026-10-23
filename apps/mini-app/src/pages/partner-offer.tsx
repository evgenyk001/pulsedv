import {BackLink} from "../components/BackLink";
import {IconTile} from '../components/IconTile';
import {Link,useSearchParams} from 'react-router-dom';
import {FileCheck2} from 'lucide-react';
import {PartnerOfferDocument} from '../components/PartnerOfferDocument';
import {OFFER_VERSION} from '../../../../packages/partners/offer';
import styles from './legal.module.css';
export default function PartnerOfferPage(){const [params]=useSearchParams();return <div className={styles.page}>
 <header className={styles.topbar}><BackLink to="/partners" aria-label="Вернуться к партнёрской программе"/><span>Условия программы</span></header>
 <section className={styles.hero}><IconTile className={styles.icon}><FileCheck2 size={24}/></IconTile><div><small>PULSEDV.RU · ПАРТНЁРАМ</small><h1>Оферта партнёрской программы</h1><p>Вознаграждение, закрепление и ответственность сторон.</p></div></section>
 <article className={styles.document}><PartnerOfferDocument version={params.get('version')||OFFER_VERSION}/></article>
 <div className={styles.links}><Link to="/privacy">Политика обработки данных</Link></div>
 </div>}
