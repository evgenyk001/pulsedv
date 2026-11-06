import React from 'react';
import {Link} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';
import {Gift,Check,ArrowRight} from 'lucide-react';
import {useGiveaway} from '../helpers/useGiveaway';
import {visitorApi} from '../../../../packages/pulse-data/runtime';
import {GiveawayCountdown} from '../components/GiveawayCountdown';
import type {GiveawayEntry} from '../../../../packages/giveaway';
import './giveaway.css';
export default function GiveawayPage(){
 const query=useGiveaway(),client=useQueryClient();
 const [accepted,setAccepted]=React.useState(false),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 if(query.isPending)return <div className="giveawayPage" role="status">Загружаем акцию…</div>;
 if(query.isError)return <div className="giveawayPage" role="alert"><p>Не удалось загрузить акцию.</p><button onClick={()=>void query.refetch()}>Повторить</button></div>;
 const data=query.data;
 if(!data||(!data.settings.enabled&&!data.entry))return <div className="giveawayPage"><h1>Акция пока недоступна</h1><Link to="/">На главную</Link></div>;
 const {settings:s,entry,serverNow}=data;
 const starts=Date.parse(s.startsAt),ends=Date.parse(s.endsAt),now=Date.parse(serverNow);
 const apply=async()=>{setBusy(true);setError('');try{const result=await visitorApi<{entry:GiveawayEntry}>('/me/giveaway',{method:'POST',body:JSON.stringify({version:s.version,acceptedRules:true})});client.setQueryData(['giveaway'],{...data,entry:result.entry});}catch(e){setError(e instanceof Error?e.message:'Повторите попытку');void query.refetch()}finally{setBusy(false)}};
 const date=(value:string)=>new Date(value).toLocaleString('ru-RU',{timeZone:'Asia/Vladivostok',dateStyle:'long',timeStyle:'short'});
 return <main className="giveawayPage"><Link className="giveawayBack" to="/">← На главную</Link><section className="giveawayHero"><img src={import.meta.env.BASE_URL+'_cdn/static/giveaway-burgundy.webp'} alt="Бордовый смартфон — художественная визуализация приза"/><div><small>НОВОГОДНЯЯ АКЦИЯ PULSEDV.RU</small><h1>{s.title}</h1><p>Покупайте недвижимость через нас и участвуйте в розыгрыше {s.prize}.</p></div></section><p className="giveawayArtNote">Художественная визуализация. Комплектация и цвет приза указаны в правилах.</p>
 <section className="giveawayBlock"><span className="giveawayKicker">{now<starts?'До начала приёма заявок':now>=ends?'Приём заявок завершён':'До конца приёма заявок'}</span><GiveawayCountdown deadline={now<starts?s.startsAt:s.endsAt} serverNow={serverNow} observedAt={data.observedAt}/><p>Победителя определим {date(s.drawAt)}. Время Владивостока.</p></section>
 <section className="giveawayBlock"><h2><Gift size={22}/> Как участвовать</h2><ol><li>Подайте заявку и примите правила акции.</li><li>Свяжитесь с менеджером в приложении и приобретите недвижимость через PULSEDV.RU.</li><li>После государственной регистрации сделки менеджер проверит условия, а мы присвоим номер и отправим его в бот.</li></ol><p>Одна зарегистрированная сделка — один номер. Дата регистрации сделки должна попадать в период акции.</p>
 {entry?<div className={'giveawayStatus '+entry.status} role="status"><Check size={20}/><strong>{entry.status==='confirmed'?(entry.tickets.length>1?'Ваши номера: ':'Ваш номер ')+entry.tickets.map(t=>t.ticket).join(', '):entry.status==='pending'?'Заявка принята':'Участие не подтверждено'}</strong><p>{entry.status==='pending'?'Номер появится после проверки государственной регистрации сделки.':entry.status==='confirmed'?'Вы допущены к розыгрышу. Номер сохранён в вашем аккаунте.':entry.reason}</p><Link to="/journey">Связаться с менеджером <ArrowRight size={16}/></Link></div>:<><label className="giveawayConsent"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>Я прочитал(а) и принимаю правила акции ниже.</span></label><button className="giveawaySubmit" disabled={!accepted||busy||!s.enabled||now<starts||now>=ends} onClick={()=>void apply()}>{busy?'Сохраняем…':'Подать заявку на участие'}</button><p>Допуск к розыгрышу — после проверки сделки.</p></>}{error&&<p role="alert">{error}</p>}</section>
 <section className="giveawayBlock"><h2>Полные правила акции</h2><div className="giveawayRules">{s.rules}</div></section></main>;
}
