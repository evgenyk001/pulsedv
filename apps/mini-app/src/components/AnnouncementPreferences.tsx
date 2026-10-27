import React from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {LoadRecovery} from './LoadRecovery';
import {Bell} from 'lucide-react';
import {announcementSettings,saveAnnouncementSettings} from '../../../../packages/broadcasts/client';
import {ensureAnnouncementWriteAccess} from '../../../../packages/broadcasts/telegramPermission';
import {runtime} from '../../../../packages/pulse-data/runtime';
import {GroupedMenu} from './GroupedMenu';
import {IconTile} from './IconTile';
import {Switch} from './Switch';
import './announcementPreferences.css';
export function AnnouncementPreferences(){
 const cache=useQueryClient();
 const [settings,setSettings]=React.useState({enabled:true,authenticated:false}),[busy,setBusy]=React.useState(true),[error,setError]=React.useState('');
 const query=useQuery({queryKey:['announcements'],queryFn:announcementSettings,staleTime:60000});
 React.useEffect(()=>{if(query.data)setSettings(query.data);setBusy(query.isFetching)},[query.data,query.isFetching]);
 const change=async(enabled:boolean)=>{setBusy(true);setError('');try{if(enabled&&runtime.enabled)await ensureAnnouncementWriteAccess((window as any).Telegram?.WebApp);const saved=await saveAnnouncementSettings(enabled);setSettings(saved);cache.setQueryData(['announcements'],saved)}catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить подписку')}finally{setBusy(false)}};
 return <GroupedMenu title="Уведомления" caption={error||(!runtime.enabled?'':!settings.authenticated?'Откройте PULSEDV.RU в Telegram, чтобы настроить анонсы.':'Можно отключить в любой момент. Сообщения менеджера и напоминания о показах продолжат приходить.')}>
  <div className="announcementPreference"><IconTile><Bell size={20}/></IconTile><span className="announcementPreferenceCopy"><b>Анонсы PULSEDV.RU</b><small>Квартира дня, акции, розыгрыши и новости в Telegram</small></span><Switch aria-label="Получать анонсы PULSEDV.RU" checked={settings.enabled} disabled={busy||query.isError&&!query.data||runtime.enabled&&!settings.authenticated} onCheckedChange={v=>void change(v)}/></div>
  {query.isError&&!query.data&&<LoadRecovery label="Обновить настройку анонсов" onRetry={()=>void query.refetch()}/>}
 </GroupedMenu>;
}
