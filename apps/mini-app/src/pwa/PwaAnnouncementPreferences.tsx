import React from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {Megaphone} from 'lucide-react';
import {visitorApi,runtime} from '../../../../packages/pulse-data/runtime';
import {GroupedMenu,MenuToggle} from '../components/GroupedMenu';
import {IconTile} from '../components/IconTile';
import {Switch} from '../components/Switch';
import {LoadRecovery} from '../components/LoadRecovery';
export function PwaAnnouncementPreferences(){
 const cache=useQueryClient();
 const query=useQuery({queryKey:['pwa-announcements'],queryFn:()=>runtime.enabled?visitorApi<{enabled:boolean}>('/me/pwa-announcements'):Promise.resolve({enabled:false})});
 const change=useMutation({mutationFn:(enabled:boolean)=>visitorApi<{enabled:boolean}>('/me/pwa-announcements',{method:'PUT',body:JSON.stringify({enabled})}),onSuccess:s=>cache.setQueryData(['pwa-announcements'],s)});
 return <GroupedMenu title="Уведомления" caption={change.error?.message||undefined}><MenuToggle icon={<Megaphone/>} title="Анонсы PULSEDV.RU" description="Квартира дня, акции и новости" label="Получать анонсы в PWA" checked={!!query.data?.enabled} disabled={!runtime.enabled||!query.data||change.isPending} onCheckedChange={v=>change.mutate(v)}/>{query.isError&&<LoadRecovery onRetry={()=>void query.refetch()} label="Обновить настройку анонсов"/>}{change.error&&<span role="alert" className="sr-only">{change.error.message}</span>}</GroupedMenu>;
}
