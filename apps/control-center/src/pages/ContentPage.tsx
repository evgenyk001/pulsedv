import { PageFrame } from "../components/PageFrame";
import { usePulseState } from "../data";
import { updatePulseState, type PulseBanner } from "../../../../packages/pulse-data";

export function ContentPage(){
  const state=usePulseState();
  const patchBanner=(id:string,patch:Partial<PulseBanner>)=>updatePulseState(current=>({
    ...current,banners:current.banners.map(item=>item.id===id?{...item,...patch}:item)
  }));
  const patchContent=(patch:Partial<typeof state.content>)=>updatePulseState(current=>({...current,content:{...current.content,...patch}}));

  return <PageFrame eyebrow="CONTENT" title="Контент" description="Промо-баннеры и onboarding Mini App — без правок клиентского кода.">
    <section className="panel">
      <div className="panelTitle"><div><span>Onboarding</span><h2>Управление показом</h2></div></div>
      <div className="formGrid">
        <label className="controlField"><span>Версия</span><input value={state.content.onboardingVersion} onChange={e=>patchContent({onboardingVersion:e.target.value})}/></label>
        <label className="switchControl"><span><b>Показывать onboarding</b><small>Смена версии покажет его пользователям заново.</small></span><input type="checkbox" checked={state.content.onboardingEnabled} onChange={e=>patchContent({onboardingEnabled:e.target.checked})}/></label>
      </div>
    </section>
    <section className="panel">
      <span className="kicker">Баннеры главной</span>
      <div className="editorList">
        {[...state.banners].sort((a,b)=>a.sortOrder-b.sortOrder).map(banner=><article className="editorRow" key={banner.id}>
          <div className="editorRowTop"><b>{banner.city||"PULSE.DV"}</b><label className="miniCheck"><input type="checkbox" checked={banner.enabled} onChange={e=>patchBanner(banner.id,{enabled:e.target.checked})}/>Виден</label></div>
          <div className="formGrid">
            <label className="controlField wide"><span>Заголовок</span><input value={banner.title} onChange={e=>patchBanner(banner.id,{title:e.target.value})}/></label>
            <label className="controlField wide"><span>Текст</span><input value={banner.body} onChange={e=>patchBanner(banner.id,{body:e.target.value})}/></label>
            <label className="controlField"><span>CTA</span><input value={banner.ctaLabel||""} onChange={e=>patchBanner(banner.id,{ctaLabel:e.target.value})}/></label>
            <label className="controlField"><span>Ссылка</span><input value={banner.actionUrl||""} onChange={e=>patchBanner(banner.id,{actionUrl:e.target.value})}/></label>
            <label className="controlField wide"><span>URL изображения</span><input value={banner.imageUrl||""} onChange={e=>patchBanner(banner.id,{imageUrl:e.target.value||null})}/></label>
          </div>
        </article>)}
      </div>
    </section>
  </PageFrame>;
}
