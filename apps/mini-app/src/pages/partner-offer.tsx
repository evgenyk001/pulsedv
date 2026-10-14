import {Link,useSearchParams} from 'react-router-dom';
import {ArrowLeft,FileCheck2} from 'lucide-react';
import {PartnerOfferDocument} from '../components/PartnerOfferDocument';
import {OFFER_VERSION} from '../../../../packages/partners/offer';
import styles from './legal.module.css';
export default function PartnerOfferPage(){const [params]=useSearchParams();return <div className={styles.page}>
 <header className={styles.topbar}><Link to="/partners" aria-label="Вернуться к партнёрской программе"><ArrowLeft size={20}/></Link><span>Условия программы</span></header>
 <section className={styles.hero}><span className={styles.icon}><FileCheck2 size={24}/></span><div><small>PULSE.DV · ПАРТНЁРАМ</small><h1>Оферта партнёрской программы</h1><p>Вознаграждение, закрепление и ответственность сторон.</p></div></section>
 <article className={styles.document}><PartnerOfferDocument version={params.get('version')||OFFER_VERSION}/></article>
 <div className={styles.links}><Link to="/privacy">Политика обработки данных</Link></div>
 </div>}
