import React from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {UsersRound,ChevronRight} from 'lucide-react';
import {getPublicPartnerInvite,rememberPartnerInvite,clearPartnerInvite} from '../../../../packages/partners/client';
import {runtime} from '../../../../packages/pulse-data/runtime';
import {PageHeader} from '../components/PageHeader';
import {LeadSheet} from '../components/LeadSheet';
import styles from './partners.module.css';
export default function PartnerInvitePage(){
 const [params]=useSearchParams(),code=params.get('code')||'';
 const q=useQuery({queryKey:['partner-invite',code],queryFn:()=>getPublicPartnerInvite(code),retry:false});
 React.useEffect(()=>{if(q.data)rememberPartnerInvite({code:q.data.code,partnerName:q.data.partnerName});else if(q.error)clearPartnerInvite()},[q.data,q.error]);
 return <div className={styles.page}><PageHeader eyebrow="ВАС ПРИГЛАСИЛИ В PULSE.DV" title="Поможем с покупкой квартиры" subtitle="Подбор новостройки и ипотечного сценария в Приморском крае."/>{!runtime.enabled&&<p className={styles.demo}>Демонстрация · заявка сохраняется только в этом браузере.</p>}{q.isLoading?<p role="status">Проверяем приглашение…</p>:q.error?<section className={styles.card}><h2>Приглашение недоступно</h2><p>{q.error.message}</p><Link className={styles.primary} to="/catalog">Открыть каталог</Link></section>:q.data&&<><section className={styles.card}><span className={styles.largeIcon}><UsersRound size={24}/></span><h2>Вас пригласил {q.data.partnerName}</h2><p>Оставьте заявку — команда PULSE.DV поможет выбрать квартиру и разобраться с условиями покупки.</p><p className={styles.hint}>При подтверждении рекомендации пригласивший партнёр увидит ограниченные статусы обращения и сможет получить вознаграждение от агентства после успешной покупки.</p></section><LeadSheet title="Получить консультацию по приглашению" source="partner-invitation" referralCode={code} referralName={q.data.partnerName}><button className={styles.primary}>Получить консультацию <ChevronRight size={17}/></button></LeadSheet><Link className={styles.secondary} to="/catalog">Посмотреть квартиры</Link><Link className={styles.textButton} to="/partners">О партнёрской программе</Link></>}</div>;
}
