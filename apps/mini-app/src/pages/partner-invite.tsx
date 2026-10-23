import {IconTile} from '../components/IconTile';
import React from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {UsersRound,ChevronRight,ArrowLeft} from 'lucide-react';
import {getPublicPartnerInvite,rememberPartnerInvite,clearPartnerInvite,rememberedPartnerInvite} from '../../../../packages/partners/client';
import {runtime} from '../../../../packages/pulse-data/runtime';
import {PageHeader} from '../components/PageHeader';
import {LeadSheet} from '../components/LeadSheet';
import styles from './partners.module.css';
export default function PartnerInvitePage(){
 const [params]=useSearchParams(),code=params.get('code')||'';
 const q=useQuery({queryKey:['partner-invite',code],queryFn:()=>getPublicPartnerInvite(code),retry:false});
 const preview=params.get('preview')==='1'||q.data?.isOwn===true;
 React.useEffect(()=>{if(preview||q.error){if(rememberedPartnerInvite()?.code===code)clearPartnerInvite();return}if(q.data)rememberPartnerInvite({code:q.data.code,partnerName:q.data.partnerName})},[q.data,q.error,preview,code]);
 return <div className={styles.page}><nav className={styles.topbar} aria-label="Навигация"><Link to="/catalog" className={styles.back} aria-label="Вернуться в каталог"><ArrowLeft size={20}/></Link><span>В каталог</span></nav><PageHeader eyebrow="ВАС ПРИГЛАСИЛИ В PULSEDV.RU" title="Поможем с покупкой квартиры" subtitle="Подбор новостройки и ипотечного сценария в Приморском крае."/>{q.isLoading?<p role="status">Проверяем приглашение…</p>:q.error?<section className={styles.card}><h2>Приглашение недоступно</h2><p>{q.error.message}</p><Link className={styles.primary} to="/catalog">Открыть каталог</Link></section>:q.data&&<><section className={styles.card}><IconTile className={styles.largeIcon}><UsersRound size={24}/></IconTile><h2>Вас пригласил {q.data.partnerName}</h2><p>Оставьте заявку — команда PULSEDV.RU поможет выбрать квартиру и разобраться с условиями покупки.</p><p className={styles.hint}>При подтверждении рекомендации пригласивший партнёр увидит ограниченные статусы обращения и сможет получить вознаграждение от агентства после успешной покупки.</p></section>{preview?<><p className={styles.hint}>Предпросмотр приглашения. Он не делает вас приглашённым покупателем и не сохраняет партнёра для ваших заявок.</p><button className={styles.primary} disabled>Получить консультацию <ChevronRight size={17}/></button></>:<LeadSheet title="Получить консультацию по приглашению" source="partner-invitation" referralCode={code} referralName={q.data.partnerName}><button className={styles.primary}>Получить консультацию <ChevronRight size={17}/></button></LeadSheet>}<Link className={styles.secondary} to="/catalog">Посмотреть квартиры</Link><Link className={styles.inlineLink} to="/partners">О партнёрской программе</Link></>}</div>;
}
