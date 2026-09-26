import { PageFrame } from "../components/PageFrame";
import { usePulseEvents, usePulseState } from "../data";
import { updatePulseState, type PulseEvent } from "../../../../packages/pulse-data";

const preferenceLabels={
  sea:"Вид на море",
  family:"Для семьи",
  parking:"Парковка",
  center:"Ближе к центру",
  courtyard:"Красивый двор",
  finish:"С отделкой",
} as const;

const weightLabels={
  city:"Город",
  budget:"Бюджет / платёж",
  rooms:"Комнаты",
  delivery:"Срок сдачи",
  preferences:"Приоритеты",
} as const;

const metaText=(event:PulseEvent,key:string)=>{
  const value=event.metadata[key];
  return typeof value==="string"?value:"";
};
const metaNumber=(event:PulseEvent,key:string)=>{
  const value=event.metadata[key];
  return typeof value==="number"&&Number.isFinite(value)?value:0;
};
const money=(value:number)=>value?new Intl.NumberFormat("ru-RU",{maximumFractionDigits:0}).format(value)+" ₽":"—";

export function SelectPage(){
  const state=usePulseState();
  const events=usePulseEvents();
  const submissions=events.filter(event=>event.eventType==="select_submit");
  const uniqueSessions=new Set(submissions.map(event=>event.sessionId)).size;
  const averageMatch=submissions.length
    ?Math.round(submissions.reduce((sum,event)=>sum+metaNumber(event,"topScore"),0)/submissions.length)
    :0;

  const patch=(patch:Partial<typeof state.select>)=>updatePulseState(current=>({...current,select:{...current.select,...patch}}));
  const patchWeight=(key:keyof typeof state.select.weights,value:number)=>patch({weights:{...state.select.weights,[key]:value}});
  const patchPreference=(key:keyof typeof state.select.preferenceEnabled,value:boolean)=>{
    const preferenceEnabled={...state.select.preferenceEnabled,[key]:value};
    patch({
      preferenceEnabled,
      ...(key==="sea"?{seaEnabled:value}:{})
    });
  };

  return <PageFrame
    eyebrow="MATCHING"
    title="PULSE Select"
    description="Управление новым подбором и реальные прохождения клиентов — в одном месте."
  >
    <section className="metrics">
      <article><span>Прохождения</span><strong>{submissions.length}</strong><small>завершили PULSE Select</small></article>
      <article><span>Пользователи</span><strong>{uniqueSessions}</strong><small>уникальные сессии</small></article>
      <article><span>Средний Match</span><strong>{averageMatch}%</strong><small>по завершённым подборам</small></article>
      <article><span>Последний Match</span><strong>{submissions[0]?metaNumber(submissions[0],"topScore"):0}%</strong><small>{submissions[0]?new Date(submissions[0].createdAt).toLocaleString("ru-RU"):"пока нет данных"}</small></article>
    </section>

    <section className="panel">
      <span className="kicker">Логика Mini App</span>
      <h2>Что видит клиент</h2>
      <p>Эти настройки идут в тот же PULSE Select, который сейчас работает в Mini App. После изменения сохраните конфигурацию в верхней панели Control.</p>
      <div className="formGrid" style={{marginTop:16}}>
        <label className="controlField wide"><span>Города через запятую</span><input value={state.select.cities.join(", ")} onChange={e=>patch({cities:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})}/></label>
        <label className="controlField wide"><span>Комнаты</span><input value={state.select.roomOptions.join(", ")} onChange={e=>patch({roomOptions:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})}/></label>
        <label className="controlField wide"><span>Дополнительные сроки сдачи</span><input value={state.select.deliveryOptions.join(", ")} onChange={e=>patch({deliveryOptions:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})}/></label>

        <label className="switchControl">
          <span><b>Умная строка запроса</b><small>«Опишите квартиру своими словами» на первом шаге.</small></span>
          <input type="checkbox" aria-label="Умная строка запроса" checked={state.select.smartQueryEnabled} onChange={e=>patch({smartQueryEnabled:e.target.checked})}/>
        </label>
        <label className="switchControl">
          <span><b>Ипотечный сценарий</b><small>Разрешить подбор по взносу и комфортному платежу.</small></span>
          <input type="checkbox" aria-label="Ипотечный сценарий" checked={state.select.mortgageEnabled} onChange={e=>patch({mortgageEnabled:e.target.checked})}/>
        </label>
        <label className="switchControl">
          <span><b>«А что если?»</b><small>Показывать сценарии пересчёта после результата.</small></span>
          <input type="checkbox" aria-label="А что если" checked={state.select.whatIfEnabled} onChange={e=>patch({whatIfEnabled:e.target.checked})}/>
        </label>
        <label className="controlField">
          <span>Максимум личных приоритетов</span>
          <input type="number" aria-label="Максимум личных приоритетов" min="1" max="6" value={state.select.maxPreferences} onChange={e=>patch({maxPreferences:Math.max(1,Math.min(6,Number(e.target.value)||1))})}/>
        </label>
      </div>
    </section>

    <section className="panel">
      <span className="kicker">Приоритеты клиента</span>
      <h2>Что можно выбрать на шаге «Характер»</h2>
      <p>Отключённый приоритет исчезает из интерфейса и больше не подхватывается умной строкой. «Вид на море» по-прежнему доступен только во Владивостоке.</p>
      <div className="formGrid" style={{marginTop:16}}>
        {(Object.keys(preferenceLabels) as (keyof typeof preferenceLabels)[]).map(key=>
          <label className="switchControl" key={key}>
            <span><b>{preferenceLabels[key]}</b><small>{key==="sea"?"Только Владивосток":"Мягкий приоритет ранжирования"}</small></span>
            <input type="checkbox" aria-label={preferenceLabels[key]} checked={state.select.preferenceEnabled[key]&&(key!=="sea"||state.select.seaEnabled)} onChange={e=>patchPreference(key,e.target.checked)}/>
          </label>
        )}
      </div>
    </section>

    <section className="panel">
      <span className="kicker">Вес ранжирования</span>
      <h2>Как PULSE расставляет варианты</h2>
      <p>Существующая система весов сохранена. Новый Select продолжает использовать именно эти значения.</p>
      <div className="weightGrid">
        {(Object.keys(state.select.weights) as (keyof typeof state.select.weights)[]).map(key=>
          <label className="controlField" key={key}>
            <span>{weightLabels[key]}</span>
            <input type="number" min="0" max="100" value={state.select.weights[key]} onChange={e=>patchWeight(key,Math.max(0,Math.min(100,Number(e.target.value)||0)))}/>
          </label>
        )}
      </div>
    </section>

    <section className="tableCard liveTable">
      <div className="tableHead eventGrid"><span>Запрос клиента</span><span>Финансы</span><span>Результат</span><span>Время</span></div>
      {submissions.length===0
        ?<div className="emptyState"><strong>Пока нет прохождений Select</strong><span>После первого завершённого подбора здесь появятся ответы клиента и итог PULSE Match.</span></div>
        :submissions.slice(0,40).map(event=>{
          const city=metaText(event,"city")||"—";
          const rooms=metaText(event,"rooms")||"—";
          const delivery=metaText(event,"delivery");
          const purchaseMode=metaText(event,"purchaseMode");
          const preferences=metaText(event,"preferences").split(",").filter(Boolean);
          const resultCount=metaNumber(event,"results");
          const strongCount=metaNumber(event,"strongCount");
          const score=metaNumber(event,"topScore");
          const finance=purchaseMode==="mortgage"
            ?`Платёж до ${money(metaNumber(event,"payment"))} · взнос ${money(metaNumber(event,"down"))}`
            :`${money(metaNumber(event,"min"))} — ${money(metaNumber(event,"max"))}`;
          return <div className="tableRow eventGrid" key={event.id}>
            <span className="nextAction"><b>{city} · {rooms==="Студия"?"Студия":rooms+" комн."}</b><small>{delivery&&delivery!=="Не важно"?"Срок: "+delivery:"Любой срок"}{preferences.length?" · "+preferences.map(id=>preferenceLabels[id as keyof typeof preferenceLabels]||id).join(", "):""}</small></span>
            <span className="nextAction"><b>{purchaseMode==="mortgage"?"Ипотека":"По стоимости"}</b><small>{finance}</small></span>
            <span className="scoreCell"><span className="scoreBadge"><b>{score}%</b><small>PULSE MATCH</small></span><small>{resultCount} вариантов · {strongCount} сильных</small></span>
            <span className="nextAction"><b>Посетитель {event.sessionId.slice(0,8)}…</b><small>{new Date(event.createdAt).toLocaleString("ru-RU")}</small></span>
          </div>;
        })}
    </section>
  </PageFrame>;
}
