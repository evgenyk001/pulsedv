import React from 'react';
import {ArrowLeft,ChevronRight,Pencil,KeyRound} from 'lucide-react';
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from '../components/Sheet';
import './phoneEntry.css';
export const phoneCountries=[{name:'Россия',flag:'🇷🇺',code:'7',digits:10},{name:'Казахстан',flag:'🇰🇿',code:'7',digits:10},{name:'Беларусь',flag:'🇧🇾',code:'375',digits:9},{name:'Армения',flag:'🇦🇲',code:'374',digits:8},{name:'Кыргызстан',flag:'🇰🇬',code:'996',digits:9},{name:'Узбекистан',flag:'🇺🇿',code:'998',digits:9},{name:'Китай',flag:'🇨🇳',code:'86',digits:11},{name:'Другая страна',flag:'🌐',code:'',digits:0}];
export function phoneValue(value:string,index:number){
 const country=phoneCountries[index]??phoneCountries[0];let digits=value.replace(/\D/g,'');
 if(country.code&&digits.length>country.digits&&digits.startsWith(country.code))digits=digits.slice(country.code.length);
 if(index===0&&digits.length===11&&digits.startsWith('8'))digits=digits.slice(1);
 return digits.slice(0,country.digits||15);
}
export function fullPhone(value:string,index:number){const c=phoneCountries[index]??phoneCountries[0];return '+'+c.code+phoneValue(value,index)}
export function displayPhone(value:string){const digits=value.replace(/\D/g,'');return /^7\d{10}$/.test(digits)?'+7 '+digits.slice(1,4)+' '+digits.slice(4,7)+' '+digits.slice(7,9)+' '+digits.slice(9):'+'+digits}
export type PhoneEntryProps={channel?:'call'|'sms';stage:'phone'|'code';phone:string;busy:boolean;available:boolean|null;error:string;retrySeconds:number;onRequest:(phone:string)=>void;onVerify:(code:string)=>void;onBack:()=>void;onRetry:()=>void;onReload:()=>void;onPasskey?:()=>void};
export function PhoneEntry(p:PhoneEntryProps){
 const [country,setCountry]=React.useState(0),[value,setValue]=React.useState(''),[consent,setConsent]=React.useState(false),[confirm,setConfirm]=React.useState(false),[countries,setCountries]=React.useState(false),[code,setCode]=React.useState('');
 const call=p.channel!=='sms',digits=call?4:6;
 const codeInput=React.useRef<HTMLInputElement>(null);
 const input=React.useRef<HTMLInputElement>(null),last=React.useRef('');const c=phoneCountries[country],number=fullPhone(value,country);
 const valid=c.digits?value.replace(/\D/g,'').length===c.digits:/^[1-9]\d{6,14}$/.test(value.replace(/\D/g,''));
 React.useEffect(()=>{setCode('');last.current=''},[p.stage,p.phone]);
 React.useEffect(()=>{if(p.stage==='code'&&code.length===digits&&!p.busy&&last.current!==code){last.current=code;p.onVerify(code)}},[code,p.stage,p.busy,p.onVerify,digits]);
 const numberInput=(next:string)=>{setValue(phoneValue(next,country))};
 return <main className="phoneEntry"><section className="phoneEntry__body">
  {p.stage==='code'&&<button type="button" className="phoneEntry__back" aria-label="Изменить номер телефона" onClick={p.onBack} disabled={p.busy}><ArrowLeft size={23}/></button>}
  <div className="phoneEntry__art" role="img" aria-label={p.stage==='phone'||call?'Телефон':'Сообщение'}>{p.stage==='phone'||call?'☎️':'💬'}</div>
  <h1>{p.stage==='phone'?'Ваш телефон':call?'Ожидайте звонка':'Код из SMS'}</h1>
  {p.stage==='phone'?<p className="phoneEntry__subtitle">Введите номер телефона</p>:<button className="phoneEntry__number" type="button" onClick={p.onBack} disabled={p.busy}>{displayPhone(p.phone)}<Pencil size={15}/></button>}
  <form onSubmit={e=>{e.preventDefault();if(p.stage==='phone'){if(valid&&consent)setConfirm(true)}else if(code.length===digits&&!p.busy&&last.current!==code){last.current=code;p.onVerify(code)}}}>
   {p.stage==='phone'?<><button type="button" className="phoneEntry__country" onClick={()=>setCountries(true)} disabled={p.busy}><span className="phoneEntry__flag">{c.flag}</span><span>{c.name}</span><ChevronRight size={19}/></button>
    <label className="phoneEntry__phone"><span>{c.code?'+'+c.code:'+'}</span><input ref={input} type="tel" inputMode="tel" autoComplete="tel-national" aria-label="Номер телефона" placeholder={c.code==='7'?'000 000 00 00':'Номер телефона'} value={c.code==='7'?value.replace(/^(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})$/,(_m,a,b,c,d)=>[a,b,c,d].filter(Boolean).join(' ')):value} onChange={e=>numberInput(e.target.value)} maxLength={24} disabled={p.busy} required/></label>
    <label className="phoneEntry__consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={p.busy}/><span>Согласен на <a href="#/personal-data-consent">обработку персональных данных</a></span></label>
   </>:<><label className="phoneEntry__codeLabel" htmlFor="pwa-phone-code">{call?'Введите последние 4 цифры входящего номера':'Введите 6 цифр'}</label>{call&&<p className="phoneEntry__callHint">Отвечать на звонок не нужно</p>}
    <div className={'phoneEntry__digits'+(p.error?' phoneEntry__digits--error':'')} style={{'--code-digits':digits} as React.CSSProperties}>
     <div className="phoneEntry__cells" aria-hidden="true">{Array.from({length:digits},(_,i)=><span key={i} className={'phoneEntry__cell'+(i===Math.min(code.length,digits-1)?' phoneEntry__cell--current':'')}>{code[i]??''}</span>)}</div>
     <input ref={codeInput} id="pwa-phone-code" className="phoneEntry__digitInput" aria-label={call?'Последние 4 цифры входящего номера':'Код из SMS'} aria-describedby={p.error?'pwa-phone-error':undefined} aria-invalid={!!p.error} type="text" inputMode="numeric" autoComplete={call?'off':'one-time-code'} pattern={'[0-9]{'+digits+'}'} maxLength={digits} autoFocus value={code} onChange={e=>{const next=e.target.value.replace(/\D/g,'').slice(0,digits);if(next.length<digits)last.current='';setCode(next)}} disabled={p.busy} required/>
    </div>
    <div className="phoneEntry__verification" role="status" aria-live="polite">{p.busy?'Проверяем…':''}</div>
    <div className="phoneEntry__retry">{p.retrySeconds>0?<p className="phoneEntry__retryTime">{call?'Повторный звонок через':'Повторная отправка через'} {p.retrySeconds} с</p>:<button className="phoneEntry__resend" type="button" disabled={p.busy} onClick={()=>{last.current='';setCode('');p.onRetry();codeInput.current?.focus()}}>{call?'Позвонить ещё раз':'Отправить код ещё раз'}</button>}</div></>}

   {p.error&&<p id="pwa-phone-error" className="phoneEntry__error" role="alert">{p.error}</p>}
   {p.stage==='phone'&&(p.available===false?<div className="phoneEntry__unavailable" role="status"><p>Вход временно недоступен</p><button type="button" onClick={p.onReload}>Повторить</button></div>:<button className="phoneEntry__primary" type="submit" disabled={p.busy||p.available!==true||(!valid||!consent)}>{p.busy?'Подождите…':'Продолжить'}</button>)}
   {p.stage==='phone'&&p.onPasskey&&<button type="button" className="phoneEntry__passkey" onClick={p.onPasskey} disabled={p.busy}><KeyRound size={18}/>Войти с ключом доступа</button>}
  </form>
 </section>
 <Sheet open={confirm} onOpenChange={v=>{if(!p.busy)setConfirm(v)}}><SheetContent side="bottom" className="phoneEntry__confirm"><SheetHeader><SheetTitle>{displayPhone(number)}</SheetTitle><SheetDescription>Правильно ли указан номер?</SheetDescription></SheetHeader><button className="phoneEntry__edit" disabled={p.busy} onClick={()=>{setConfirm(false);requestAnimationFrame(()=>input.current?.focus())}}>Изменить</button><button className="phoneEntry__primary" disabled={p.busy} onClick={()=>{setConfirm(false);p.onRequest(number)}}>Продолжить</button></SheetContent></Sheet>
 <Sheet open={countries} onOpenChange={setCountries}><SheetContent side="bottom" className="phoneEntry__countries"><SheetHeader><SheetTitle>Страна</SheetTitle><SheetDescription className="sr-only">Выберите телефонный код страны</SheetDescription></SheetHeader>{phoneCountries.map((item,i)=><button className="phoneEntry__countryOption" key={item.name} type="button" onClick={()=>{setCountry(i);setValue('');setCountries(false);requestAnimationFrame(()=>input.current?.focus())}}><span>{item.flag}</span>{item.name}<small>{item.code?'+'+item.code:''}</small></button>)}</SheetContent></Sheet>
 </main>;
}
