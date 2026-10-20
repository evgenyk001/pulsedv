import React from 'react';
import {api,runtime} from '../../../../packages/pulse-data/runtime';

type Row={source:string;medium:string;campaign:string;content:string;term:string;landing:number;clicks:number;opened:number;miniapp:number;contacts:number};
export function TrafficPanel(){
 const [data,setData]=React.useState<{items:Row[];limited:boolean}|null>(null),[error,setError]=React.useState('');
 const [source,setSource]=React.useState('instagram'),[medium,setMedium]=React.useState('social'),[campaign,setCampaign]=React.useState(''),[content,setContent]=React.useState(''),[copied,setCopied]=React.useState(false);
 const allowed=!runtime.enabled||runtime.member?.role!=='manager';
 React.useEffect(()=>{
  if(!runtime.enabled||!allowed)return;let live=true;
  const load=()=>api<{items:Row[];limited:boolean}>('/control/traffic').then(value=>{if(live){setData(value);setError('')}}).catch(e=>{if(live)setError(e.message)});
  void load();const timer=window.setInterval(()=>{if(!document.hidden)void load()},30000);
  return()=>{live=false;window.clearInterval(timer)};
 },[allowed]);
 if(!allowed)return null;
 const rows=data?.items||[],sum=(field:'landing'|'clicks'|'opened'|'miniapp'|'contacts')=>rows.reduce((n,r)=>n+r[field],0);
 const url=new URL('https://pulsedv.ru/');
 for(const [key,value] of [['utm_source',source],['utm_medium',medium],['utm_campaign',campaign],['utm_content',content]])if(value.trim())url.searchParams.set(key,value.trim());
 return <section className="panel acquisitionPanel">
  <div className="acquisitionHead"><div><span className="kicker">ЛЕНДИНГ И ПРИЛОЖЕНИЕ</span><h2>Откуда приходят клиенты</h2><p>Последние 90 дней. Повторное открытие в той же вкладке в течение 30 минут считается одним визитом. Это визиты браузеров, а не число людей.</p></div></div>
  {!runtime.enabled&&<p className="acquisitionNote">В превью сбор общей статистики выключен. Посещения начнут сохраняться после подключения сервера.</p>}
  {error&&<p className="errorNotice" role="alert">Статистика не загрузилась: {error}</p>}
  {data?.limited&&<p className="errorNotice">Показаны первые 500 сочетаний меток. Итоги ниже относятся только к показанным строкам.</p>}
  <div className="acquisitionSummary" aria-label="Лендинг и приложение">
   <div><span>Визиты на лендинг</span><strong>{sum('landing')}</strong></div>
   <div><span>Нажали Telegram</span><strong>{sum('clicks')}</strong><small>визиты хотя бы с одним кликом</small></div>
   <div><span>Открыли после лендинга</span><strong>{sum('opened')}</strong><small>подтверждённые открытия, включая QR</small></div>
   <div><span>Визиты в приложение</span><strong>{sum('miniapp')}</strong><small>все источники входа</small></div>
   <div><span>Визиты с заявкой</span><strong>{sum('contacts')}</strong><small>по первому источнику сессии</small></div>
  </div>
  <div className="journeyTable acquisitionTable"><table><thead><tr>{['Источник / метки','Лендинг','Нажали Telegram','Открыли после лендинга','Приложение','С заявкой'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={JSON.stringify([r.source,r.medium,r.campaign,r.content,r.term])}><td>{r.source==='direct'?'Прямой / источник неизвестен':r.source}<small style={{display:'block'}}>{[r.medium,r.campaign,r.content,r.term].filter(Boolean).join(' · ')}</small></td><td>{r.landing}</td><td>{r.clicks}</td><td>{r.opened}</td><td>{r.miniapp}</td><td>{r.contacts}</td></tr>)}</tbody></table></div>
  {data&&!rows.length&&<p className="acquisitionEmpty">Посещений пока нет. Данные до подключения счётчика не восстанавливаются.</p>}
  <p className="acquisitionNote">Метки UTM имеют приоритет, иначе сохраняется домен сайта-источника. Когда источник скрыт, он остаётся неизвестным. QR и кнопка могут дать разное число кликов: сканирование QR подтверждается открытием приложения. Блокировщики, отключённый JavaScript и потеря связи могут мешать учёту. Рекламные метки не дают партнёру право на вознаграждение.</p>
  <details><summary>Создать ссылку для рекламы или публикации</summary>
   <div className="trafficLinkFields">
    <label>Источник<input value={source} maxLength={100} placeholder="instagram, vk, telegram, farpost" onChange={e=>{setSource(e.target.value);setCopied(false)}}/></label>
    <label>Тип перехода<input value={medium} maxLength={100} placeholder="social, cpc, qr" onChange={e=>{setMedium(e.target.value);setCopied(false)}}/></label>
    <label>Название кампании<input value={campaign} maxLength={100} placeholder="novostroyki_october" onChange={e=>{setCampaign(e.target.value);setCopied(false)}}/></label>
    <label>Публикация / объявление<input value={content} maxLength={100} placeholder="reels_01" onChange={e=>{setContent(e.target.value);setCopied(false)}}/></label>
   </div>
   <label className="trafficLinkOutput">Готовая ссылка<input aria-label="Ссылка с метками" readOnly value={url.toString()} onFocus={e=>e.target.select()}/></label>
   <button className="secondaryAction" disabled={!source.trim()} onClick={()=>void navigator.clipboard.writeText(url.toString()).then(()=>setCopied(true)).catch(()=>setCopied(false))}>{copied?'Скопировано':'Скопировать ссылку'}</button>
   <p className="acquisitionNote">Для каждой площадки и объявления используйте свою ссылку. Клиент сначала попадёт на лендинг, а его метка сохранится при открытии Telegram.</p>
  </details>
 </section>;
}
