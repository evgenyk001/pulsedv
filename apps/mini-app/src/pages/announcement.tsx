import React from 'react';
import {useParams,Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {Megaphone,ArrowUpRight} from 'lucide-react';
import {visitorApi,runtime} from '../../../../packages/pulse-data/runtime';
import {validBroadcastPath,type BroadcastContent} from '../../../../packages/broadcasts';
import {useClientNotifications} from '../helpers/useClientNotifications';
import {LoadRecovery} from '../components/LoadRecovery';
import {BrandLoading} from '../components/BrandLoading';
import './announcement.css';
export default function AnnouncementPage(){
 const {announcementId}=useParams(),notices=useClientNotifications();
 const q=useQuery({queryKey:['pwa-announcement',announcementId],queryFn:()=>visitorApi<BroadcastContent&{id:string;at:string}>('/me/pwa-announcements/'+encodeURIComponent(announcementId!)),enabled:runtime.enabled&&!!announcementId,retry:false});
 const mark=React.useRef('');React.useEffect(()=>{if(q.data&&mark.current!==q.data.id){mark.current=q.data.id;notices.mark.mutate({ids:['announcement:'+q.data.id]})}},[q.data?.id]);
 if(q.isPending&&runtime.enabled)return <BrandLoading/>;
 if(!q.data)return <LoadRecovery label="Открыть анонс ещё раз" onRetry={()=>void q.refetch()}/>;
 const a=q.data,button=<>{a.buttonLabel}<ArrowUpRight size={18}/></>;
 return <article className="announcementPage"><header><span><Megaphone size={17}/>PULSEDV.RU</span><time dateTime={a.at}>{new Date(a.at).toLocaleDateString('ru-RU')}</time></header>{a.imageUrl&&/^\/media\/broadcasts\/[a-f0-9-]{36}\.jpg$/.test(a.imageUrl)&&<img src={a.imageUrl} alt=""/>}<h1>{a.title}</h1><p>{a.body}</p>{validBroadcastPath(a.buttonPath)&&(a.buttonPath.startsWith('/')?<Link className="announcementPage__action" to={a.buttonPath}>{button}</Link>:<a className="announcementPage__action" href={a.buttonPath} target="_blank" rel="noopener noreferrer">{button}</a>)}</article>;
}
