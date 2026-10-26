import './registeredClients.css';
import React from 'react';
import {api,runtime} from '../../../../packages/pulse-data/runtime';
type Client={id:string;first_name:string;last_name:string|null;phone:string;telegram_username:string|null;telegram_user_id:string;accepted_at:string};
export function RegisteredClients(){
 const [items,setItems]=React.useState<Client[]>([]),[query,setQuery]=React.useState(''),[page,setPage]=React.useState(1),[total,setTotal]=React.useState(0),[more,setMore]=React.useState(false),[error,setError]=React.useState(''),[refresh,reload]=React.useReducer(n=>n+1,0);
 const allowed=runtime.enabled&&['owner','admin'].includes(runtime.member?.role??'');
 React.useEffect(()=>{
  if(!allowed)return;let active=true;setError('');
  const timer=setTimeout(()=>{void api<{items:Client[];total:number;hasMore:boolean}>('/control/registrations?page='+page+'&q='+encodeURIComponent(query)).then(data=>{if(active){setItems(data.items);setTotal(data.total);setMore(data.hasMore)}}).catch(e=>{if(active)setError(e.message)})},200);
  return()=>{active=false;clearTimeout(timer)};
 },[allowed,query,page,refresh]);
 if(!allowed)return null;
 return <section className="panel"><div className="sectionHeading"><div><span className="kicker">АККАУНТЫ PULSEDV.RU</span><h2>Зарегистрированные клиенты · {total}</h2></div><button className="secondaryAction" onClick={()=>reload()}>Обновить</button></div><label className="controlSearch">Поиск клиента<input aria-label="Поиск зарегистрированного клиента" placeholder="Имя, телефон или Telegram" value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}}/></label>{error&&<p role="alert">{error}</p>}<div className="registeredClients">{items.map(u=><article key={u.id}><strong>{[u.first_name,u.last_name].filter(Boolean).join(' ')||'Клиент'}</strong><a href={'tel:'+u.phone}>{u.phone}</a><span>{u.telegram_username?'@'+u.telegram_username:'Telegram ID: '+u.telegram_user_id}</span><small>Номер подтверждён {new Date(u.accepted_at).toLocaleString('ru-RU')}</small></article>)}</div>{!items.length&&!error&&<p className="blockNote">Клиенты появятся после подтверждения своего номера.</p>}<div className="pagedLoadMore"><button className="secondaryAction" disabled={page===1} onClick={()=>setPage(p=>p-1)}>Назад</button><span>Страница {page}</span><button className="secondaryAction" disabled={!more} onClick={()=>setPage(p=>p+1)}>Далее</button></div></section>;
}
