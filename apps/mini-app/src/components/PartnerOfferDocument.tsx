import {offerSections,OFFER_VERSION,offerDate} from '../../../../packages/partners/offer';
import {LegalOperator} from './LegalOperator';
import {useQuery} from '@tanstack/react-query';
import {api,runtime} from '../../../../packages/pulse-data/runtime';
export function PartnerOfferDocument({version=OFFER_VERSION}:{version?:string}){
 const sections=offerSections(version);
 const q=useQuery({queryKey:['partner-offer',version],enabled:runtime.enabled,queryFn:()=>api<{published:boolean;operator:{registration:string}}>('/public/partner-offer?version='+encodeURIComponent(version)),staleTime:300000});
 if(!sections)return <p>Эта редакция документа не найдена.</p>;
 return <div className="partnerTerms"><p><b>{version!==OFFER_VERSION?'Архив правил программы':q.data?.published?'Публичная оферта':'Шаблон публичной оферты'}</b> · {version} · {offerDate(version)}</p>{version===OFFER_VERSION&&!q.data?.published&&<p>До заполнения реквизитов и публикации окончательной редакции это шаблон. Действия в демонстрационной версии не заключают договор.</p>}{sections.map(s=><section key={s.title}><h3>{s.title}</h3>{s.paragraphs.map(p=><p key={p}>{p}</p>)}</section>)}<LegalOperator/>{q.data?.operator.registration&&<p>ОГРН / ОГРНИП: {q.data.operator.registration}</p>}</div>;
}
