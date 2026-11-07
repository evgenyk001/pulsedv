// Isolated visual fixture: actual production components, synthetic state, no live API.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {HashRouter} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import GiveawayPage from '../../../apps/mini-app/src/pages/giveaway';
import {AppShell} from '../../../apps/mini-app/src/components/AppShell';
import {DEFAULT_STATE} from '../../../packages/pulse-data/model';
import {DEFAULT_GIVEAWAY,type GiveawayState,type GiveawayEntry} from '../../../packages/giveaway';
import '../../../apps/mini-app/src/floot-runtime.css';
import '../../../apps/mini-app/src/base.css';
const params=new URLSearchParams(location.search),state=params.get('state')||'new';
if(params.get('theme')==='dark')document.documentElement.classList.add('dark');
localStorage.setItem('pulse_onboarding_version',DEFAULT_STATE.content.onboardingVersion);
localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(DEFAULT_STATE));
if(params.get('native')!=='0'){
 (window as any).Telegram={WebApp:{initData:'fixture-only',ready(){},expand(){},BackButton:{show(){},hide(){},onClick(){},offClick(){}}}};
}
location.hash='/giveaway';
const rules='ПРАВИЛА НОВОГОДНЕГО РОЗЫГРЫША PULSEDV.RU\n\n1. Организатор\nИП Козменко Диана Дмитриевна. Контакты доступны в приложении.\n\n2. Приз\nОдин новый iPhone 18 Pro. Характеристики указаны организатором.\n\n3. Участие\nЗаявка до регистрации сделки. Одна зарегистрированная сделка — один номер.\n\n4. Итоги\nПобедитель определяется случайным образом. Приз вручается в течение 72 часов.';
const entry:GiveawayEntry={id:'00000000-0000-4000-8000-000000000001',status:state==='confirmed'||state==='multiple'?'confirmed':state==='rejected'?'rejected':'pending',ticket:null,createdAt:new Date().toISOString(),registeredAt:null,leadId:null,reason:state==='rejected'?'Регистрация сделки за пределами периода акции.':null,tickets:[]};
if(entry.status==='confirmed'){entry.tickets=[{id:'ticket-1',ticket:'PULSE-0017',leadId:'deal-1',registeredAt:new Date().toISOString()}];entry.ticket='PULSE-0017';if(state==='multiple')entry.tickets.push({id:'ticket-2',ticket:'PULSE-0024',leadId:'deal-2',registeredAt:new Date().toISOString()})}
const campaign:GiveawayState={settings:{...DEFAULT_GIVEAWAY,enabled:state!=='paused',title:params.get('long')?'Новая квартира для вашей семьи и новогодний подарок от PULSEDV.RU':DEFAULT_GIVEAWAY.title,rules},entry:['new','paused','ended','future'].includes(state)?null:entry,serverNow:'2026-11-06T22:00:00+10:00',observedAt:performance.now()};
if(state==='ended'||state==='pending-ended')campaign.serverNow='2027-01-03T12:00:00+10:00';
if(state==='future')campaign.serverNow='2026-11-05T12:00:00+10:00';
const cache=new QueryClient({defaultOptions:{queries:{enabled:false,retry:false}}});cache.setQueryData(['giveaway'],campaign);
window.fetch=async input=>{
 const path=String(input);
 if(path.includes('/auth/session'))return Response.json({sessionId:'fixture-session',accessToken:'fixture-only',expiresAt:'2099-01-01T00:00:00Z'});
 if(path.includes('/me/giveaway'))return Response.json({entry:{...entry,status:'pending',tickets:[]}});
 if(path.includes('/me/journeys'))return Response.json({items:[]});
 return Response.json({items:[]});
};
(window as any).__giveawayFixture={cache,campaign};
const frameWidth=Number(params.get('width'));
if([320,390,430,768].includes(frameWidth)){const target=new URL(location.href);target.searchParams.delete('width');const frame=document.createElement('iframe');frame.title='Мобильная версия '+frameWidth+'px';frame.src=target.href;frame.style.cssText='display:block;margin:20px auto;border:0;width:'+frameWidth+'px;height:844px;background:#f6f7fa;border-radius:22px;box-shadow:0 12px 60px #19213920';document.getElementById('root')!.append(frame)}
else createRoot(document.getElementById('root')!).render(<QueryClientProvider client={cache}><HashRouter><AppShell><GiveawayPage/></AppShell></HashRouter></QueryClientProvider>);
