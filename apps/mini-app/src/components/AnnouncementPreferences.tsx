import React from 'react';
import {Bell} from 'lucide-react';
import {announcementSettings,saveAnnouncementSettings} from '../../../../packages/broadcasts/client';
import {ensureAnnouncementWriteAccess} from '../../../../packages/broadcasts/telegramPermission';
import {runtime} from '../../../../packages/pulse-data/runtime';
import {GroupedMenu} from './GroupedMenu';
import {IconTile} from './IconTile';
import {Switch} from './Switch';
import './announcementPreferences.css';
export function AnnouncementPreferences(){
 const [settings,setSettings]=React.useState({enabled:false,authenticated:false}),[busy,setBusy]=React.useState(true),[error,setError]=React.useState('');
 React.useEffect(()=>{let active=true;announcementSettings().then(v=>{if(active)setSettings(v)}).catch(()=>{if(active)setError('Не удалось загрузить настройку. Откройте профиль ещё раз')}).finally(()=>{if(active)setBusy(false)});return()=>{active=false}},[]);
 const change=async(enabled:boolean)=>{setBusy(true);setError('');try{if(enabled&&runtime.enabled)await ensureAnnouncementWriteAccess((window as any).Telegram?.WebApp);setSettings(await saveAnnouncementSettings(enabled))}catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить подписку')}finally{setBusy(false)}};
 return <GroupedMenu title="Новости и предложения" caption={error||(!runtime.enabled?'В тестовой версии подписка сохраняется только в этом браузере.':!settings.authenticated?'Откройте PULSE из Telegram, чтобы получать анонсы.':'Можно отключить в любой момент. Сообщения менеджера и напоминания о показах продолжат приходить.')}>
  <div className="announcementPreference"><IconTile><Bell size={20}/></IconTile><span className="announcementPreferenceCopy"><b>Анонсы PULSE.DV</b><small>Квартира дня, акции, розыгрыши и новости в Telegram</small></span><Switch aria-label="Получать анонсы PULSE.DV" checked={settings.enabled} disabled={busy||!!error&&error.includes('загрузить')||runtime.enabled&&!settings.authenticated} onCheckedChange={v=>void change(v)}/></div>
 </GroupedMenu>;
}
