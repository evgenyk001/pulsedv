import {IconTile} from '../components/IconTile';
import {NativeSelect} from "../components/NativeSelect";
import React from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {Bell,BellRing,Search,Heart,ChevronRight,SlidersHorizontal,Sparkles,RefreshCw,Check,ArrowLeft} from 'lucide-react';
import {PageHeader} from '../components/PageHeader';
import {LeadSheet} from '../components/LeadSheet';
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from '../components/Sheet';
import {Switch} from '../components/Switch';
import {Input} from '../components/Input';
import {usePulseControlState} from '../helpers/usePulseControlState';
import {useMySearch} from '../helpers/useMySearch';
import {runtime} from '../../../../packages/pulse-data/runtime';
import {searchUrl,type SearchCriteria,type SearchSettings} from '../../../../packages/my-search';
import styles from './my-search.module.css';
const money=(n:number)=>new Intl.NumberFormat('ru-RU').format(n)+' ₽';
const initial:SearchCriteria={q:'',city:'Все',rooms:'Все',min:4000000,max:25000000,delivery:'Любой',sea:false,purchaseMode:'any'};
const modes={any:'Любой способ покупки',cash:'За свои средства',mortgage:'В ипотеку'};
function paramPrice(v:string|null,fallback:number){const n=Number(v);return v&&Number.isFinite(n)&&n>=0?(n<1000?n*1000000:n):fallback}
export default function MySearchPage(){
 const {data,isLoading,error,refetch,save}=useMySearch(),control=usePulseControlState();const [params,setParams]=useSearchParams();
 const [open,setOpen]=React.useState(params.get('draft')==='1'),[draft,setDraft]=React.useState<SearchCriteria>(initial),[notice,setNotice]=React.useState('');
 const [minText,setMinText]=React.useState('4000000'),[maxText,setMaxText]=React.useState('25000000');
 const settings=data?.settings??{criteria:null,watchFavorites:false,telegram:false};const c=settings.criteria;
 const begin=()=>{const next=c??initial;setDraft(next);setMinText(String(next.min));setMaxText(String(next.max));setOpen(true)};
 React.useEffect(()=>{if(params.get('draft')!=='1')return;const next={...initial,q:params.get('q')??'',city:params.get('city')??'Все',rooms:params.get('rooms')??'Все',delivery:params.get('delivery')??'Любой',sea:params.get('sea')==='1',min:paramPrice(params.get('min'),initial.min),max:paramPrice(params.get('max'),initial.max)};setDraft(next);setMinText(String(next.min));setMaxText(String(next.max));},[params]);
 const update=async(next:SearchSettings)=>{setNotice('');try{await save.mutateAsync(next);setNotice('Сохранено')}catch{}};
 const valid=!!minText&&!!maxText&&Number(minText)>=0&&Number(maxText)>0&&Number(minText)<=Number(maxText)&&Number(maxText)<=1e10;
 const submit=async(e:React.FormEvent)=>{e.preventDefault();if(!valid)return;try{await save.mutateAsync({...settings,criteria:{...draft,min:Number(minText),max:Number(maxText)}});setOpen(false);setParams({}, {replace:true});setNotice('Поиск сохранён. Будем отслеживать новые подходящие варианты.')}catch{}};
 return <div className={styles.page}>
  <Link className={styles.back} to='/profile'><ArrowLeft size={16}/>В профиль</Link>
  <PageHeader eyebrow='Ваши предпочтения' title='Мой поиск' subtitle='Сохраните запрос — возвращайтесь к подходящим ЖК и изменениям в избранном.'/>
  {isLoading?<div className={styles.card} role='status'>Загружаем ваш поиск…</div>:error?<div className={styles.card} role='alert'>Не удалось загрузить поиск.<button className={styles.secondary} onClick={()=>void refetch()}>Попробовать снова</button></div>:<>
  <section className={styles.card} aria-label='Сохранённый поиск'>
   <div className={styles.heading}><IconTile className={styles.icon}><Search size={21}/></IconTile><div><h2>{c?'Ваш запрос сохранён':'Квартира под ваши планы'}</h2><p>{c?'Следим за новыми совпадениями в каталоге':'Один раз задайте параметры — продолжайте выбор в удобное время'}</p></div></div>
   {c&&<><div className={styles.chips}><span>{c.city==='Все'?'Все города':c.city}</span><span>{c.rooms==='Все'?'Любая комнатность':c.rooms==='Студия'?'Студия':c.rooms+' комн.'}</span>{c.delivery!=='Любой'&&<span>{c.delivery}</span>}{c.sea&&<span>У моря</span>}</div><strong className={styles.budget}>{money(c.min)} — {money(c.max)}</strong><p>{modes[c.purchaseMode]}{c.q?' · '+c.q:''}</p><Link className={styles.primary} to={searchUrl(c)}>Смотреть подходящие ЖК<ChevronRight size={17}/></Link></>}
   <button className={c?styles.secondary:styles.primary} onClick={begin}><SlidersHorizontal size={17}/>{c?'Изменить параметры':'Настроить мой поиск'}</button>
   {c&&<LeadSheet source='selection-saved-search' context={c}><button className={styles.textButton}>Обсудить этот поиск с менеджером</button></LeadSheet>}
   {c&&<button className={styles.textButton} disabled={save.isPending} onClick={()=>void update({...settings,criteria:null})}>Удалить сохранённый поиск</button>}
  </section>
  <section className={styles.card} aria-label='Настройки обновлений'>
   <div className={styles.setting}><IconTile className={styles.smallIcon}><Heart size={19}/></IconTile><div><h3>Изменения в избранном</h3><p>Цена в каталоге и новые планировки сохранённых ЖК</p></div><Switch aria-label='Следить за избранным' checked={settings.watchFavorites} disabled={save.isPending} onCheckedChange={watchFavorites=>void update({...settings,watchFavorites})}/></div>
   <div className={styles.setting}><IconTile className={styles.smallIcon}><BellRing size={19}/></IconTile><div><h3>Уведомления в Telegram</h3><p>Только полезные изменения, не чаще раза в час</p></div><Switch aria-label='Уведомления моего поиска в Telegram' checked={settings.telegram} disabled={save.isPending||!data?.authenticated} onCheckedChange={telegram=>void update({...settings,telegram})}/></div>
   {!data?.authenticated&&<p className={styles.hint}>{runtime.enabled?'Откройте Mini App из бота и нажмите «Старт», чтобы получать уведомления.':'Тестовая версия · уведомления не отправляются.'}</p>}
   <Link className={styles.inlineLink} to='/favorites'>Открыть избранное<ChevronRight size={15}/></Link>
  </section>
  <section className={styles.card} aria-label='Обновления моего поиска'><div className={styles.heading}><IconTile className={styles.icon}><Sparkles size={21}/></IconTile><div><h2>Что нового для вас</h2><p>Изменения после сохранения настроек</p></div><button className={styles.refresh} aria-label='Обновить мой поиск' onClick={()=>void refetch()} disabled={isLoading}><RefreshCw size={17}/></button></div>
   {data?.feed.length?<div className={styles.feed}>{data.feed.map(item=><Link key={item.id} to={'/property/'+encodeURIComponent(item.propertyId)}><IconTile className={styles.smallIcon}>{item.kind==='price'?<Bell size={18}/>:<Sparkles size={18}/>}</IconTile><div><b>{item.name}</b><p>{item.title}</p><small>{new Date(item.at).toLocaleString('ru-RU',{timeZone:'Asia/Vladivostok',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}</small></div><ChevronRight size={16}/></Link>)}</div>:<div className={styles.empty}><Check size={26}/><h3>{c||settings.watchFavorites?'Всё актуально':'Начните со своего запроса'}</h3><p>{c||settings.watchFavorites?'Когда в каталоге появится подходящий вариант или изменится избранное, обновление будет здесь.':'Настройте поиск или включите отслеживание избранного — здесь появятся полезные обновления.'}</p></div>}
  </section>
  <p className={styles.hint}>Следим за опубликованными данными ЖК. Цены указаны «от»; наличие квартир и условия покупки уточнит менеджер.</p>
  </>}
  {(notice||save.error)&&<p className={styles.notice} role={save.error?'alert':'status'}>{save.error?(save.error as Error).message:notice}</p>}
  <Sheet open={open} onOpenChange={next=>{setOpen(next);if(!next&&params.get('draft')==='1')setParams({}, {replace:true})}}><SheetContent side='bottom' className={styles.sheet}><SheetHeader><SheetTitle>Ваш поиск квартиры</SheetTitle><SheetDescription>Сохраним параметры и покажем новые совпадения.</SheetDescription></SheetHeader><form className={styles.form} onSubmit={submit}>
   <div className={styles.two}><label><span>Город</span><NativeSelect aria-label="Город" value={draft.city} onChange={e=>setDraft({...draft,city:e.target.value})}>{[...new Set(['Все',...control.select.cities,draft.city])].map(v=><option key={v}>{v}</option>)}</NativeSelect></label>
   <label><span>Комнатность</span><NativeSelect aria-label="Комнатность" value={draft.rooms} onChange={e=>setDraft({...draft,rooms:e.target.value})}>{['Все','Студия','1','2','3','3+','4'].map(v=><option key={v}>{v}</option>)}</NativeSelect></label></div>
   <div className={styles.two}><label><span>Бюджет от, ₽</span><Input aria-label='Бюджет поиска от' inputMode='numeric' value={minText} onChange={e=>setMinText(e.target.value.replace(/\D/g,''))}/></label><label><span>Бюджет до, ₽</span><Input aria-label='Бюджет поиска до' inputMode='numeric' value={maxText} onChange={e=>setMaxText(e.target.value.replace(/\D/g,''))}/></label></div>
   <div className={styles.two}><label><span>Срок сдачи</span><NativeSelect aria-label="Срок сдачи" value={draft.delivery} onChange={e=>setDraft({...draft,delivery:e.target.value})}>{[...new Set(['Любой',...control.select.deliveryOptions,draft.delivery])].map(v=><option key={v}>{v}</option>)}</NativeSelect></label>
   <label><span>Способ покупки</span><NativeSelect aria-label="Способ покупки" value={draft.purchaseMode} onChange={e=>setDraft({...draft,purchaseMode:e.target.value as SearchCriteria['purchaseMode']})}>{Object.entries(modes).map(([v,label])=><option value={v} key={v}>{v==='any'?'Не важно':label}</option>)}</NativeSelect></label></div>
   <label><span>ЖК, район или застройщик</span><Input value={draft.q} maxLength={200} onChange={e=>setDraft({...draft,q:e.target.value})} placeholder='Необязательно'/></label>
   <div className={styles.setting}><span>У моря</span><Switch aria-label='Поиск у моря' checked={draft.sea} onCheckedChange={sea=>setDraft({...draft,sea})}/></div>
   {!valid&&<p role='alert'>Укажите корректный бюджет: от меньшей суммы к большей.</p>}{save.error&&<p role='alert'>{(save.error as Error).message}</p>}
   <button className={styles.primary} disabled={!valid||save.isPending} type='submit'>{save.isPending?'Сохраняем…':'Сохранить поиск'}<Check size={17}/></button>
  </form></SheetContent></Sheet>
 </div>;
}
