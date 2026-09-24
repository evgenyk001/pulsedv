import {properties,programs,icon,money,mln} from "./data.js";

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

const state={
  route:location.hash.slice(1)||"home",
  catalogView:"list",
  sort:"popular",
  sheet:null,
  q:"",
  filterCity:"Все",
  filterRooms:"Все",
  filterDelivery:"Любой",
  filterSea:false,
  selectStep:0,
  selectedCity:"Владивосток",
  rooms:"2",
  budgetMin:4900000,
  budgetMax:12800000,
  delivery:"Любой",
  mortgage:true,
  priorities:new Set(["sea"]),
  favorites:new Set(JSON.parse(localStorage.getItem("pulse_favorites")||"[]")),
  compare:new Set(),
  mortgageProgram:"family",
  price:9000000,
  down:2000000,
  years:25,
  rate:6,
  forceOnboarding:false
};

const saveFav=()=>localStorage.setItem("pulse_favorites",JSON.stringify([...state.favorites]));
const go=route=>{state.route=route;state.sheet=null;location.hash=route;window.scrollTo({top:0,behavior:"instant"});render();};
const annuity=(loan,rate,years)=>{if(loan<=0)return 0;const m=years*12,r=rate/100/12;if(!r)return loan/m;const f=(1+r)**m;return loan*(r*f)/(f-1);};

function nav(){
  const items=[["home","home","Главная"],["catalog","building","Каталог"],["selection","spark","Подбор"],["favorites","heart","Избранное"]];
  return '<nav class="nav">'+items.map(([r,i,l])=>'<button data-go="'+r+'" class="'+(state.route===r?"active":"")+'">'+icon(i)+'<span>'+l+'</span></button>').join("")+'</nav>';
}
function shell(content){return '<div class="app"><div class="page">'+content+'</div>'+nav()+'</div>'+(state.sheet?sheet():"")+onboarding();}
function header(){return '<header class="header"><div class="brand"><div class="logo"><i></i><i></i><i></i></div><div><b>PULSE.DV</b><small>Новостройки Приморья</small></div></div><div class="header-actions"><button class="icon-btn" data-sheet="notifications">'+icon("bell")+'</button><button class="icon-btn" data-go="profile">'+icon("user")+'</button></div></header>';}
function propertyCard(p,compact=false){
  const fav=state.favorites.has(p.id);
  return '<article class="property card '+(compact?"compact":"")+'" data-property="'+p.id+'"><div class="property-media" style="background-image:url(\''+p.img+'\')"><span class="badge">'+p.tags[0]+'</span><button class="heart '+(fav?"active":"")+'" data-fav="'+p.id+'">'+icon("heart")+'</button></div><div class="property-body"><h3>'+p.name+'</h3><p>'+p.city+' · '+p.district+'</p><div class="price">от '+mln(p.price)+'</div><div class="delivery">'+p.delivery+'</div></div></article>';
}
function home(){
  return shell(
    header()+
    '<form class="search" id="homeSearch">'+icon("search")+'<input id="homeSearchInput" placeholder="ЖК, район или застройщик"><button>'+icon("chev")+'</button></form>'+
    '<section class="hero card"><span class="kicker">PULSE Select</span><h2>Новостройки Приморья — спокойно и понятно</h2><p>Сравниваем проекты, бюджет и ипотечные сценарии в одном приложении.</p><button class="hero-cta" data-go="selection">Подобрать вариант</button></section>'+
    '<div class="quick-grid">'+
      '<button class="quick" data-go="catalog"><span class="quick-icon">'+icon("building")+'</span><span><b>Каталог</b><small>Все новостройки</small></span>'+icon("chev")+'</button>'+
      '<button class="quick" data-go="catalog-map"><span class="quick-icon">'+icon("map")+'</span><span><b>На карте</b><small>По районам</small></span>'+icon("chev")+'</button>'+
      '<button class="quick" data-go="mortgage"><span class="quick-icon">'+icon("percent")+'</span><span><b>Ипотека</b><small>Умный расчёт</small></span>'+icon("chev")+'</button>'+
      '<button class="quick" data-go="selection"><span class="quick-icon">'+icon("spark")+'</span><span><b>PULSE Select</b><small>Подбор под вас</small></span>'+icon("chev")+'</button>'+
    '</div>'+
    '<section><div class="section-head"><div><span class="eyebrow">Выбор PULSE.DV</span><h2>Стоит посмотреть</h2></div><button class="text-btn" data-go="catalog">Все →</button></div><div class="rail">'+properties.slice(0,3).map(p=>propertyCard(p)).join("")+'</div></section>'+
    '<button class="quick card" data-go="selection"><span class="quick-icon">'+icon("spark")+'</span><span><b>Не хочется искать самому?</b><small>Соберём короткую подборку под ваш бюджет</small></span>'+icon("chev")+'</button>'
  );
}
function filtered(){
  let arr=[...properties],q=state.q.toLowerCase();
  if(q)arr=arr.filter(p=>(p.name+" "+p.city+" "+p.district).toLowerCase().includes(q));
  if(state.filterCity!=="Все")arr=arr.filter(p=>p.city===state.filterCity);
  if(state.filterRooms!=="Все")arr=arr.filter(p=>p.rooms.includes(state.filterRooms));
  if(state.filterDelivery!=="Любой")arr=arr.filter(p=>p.delivery.includes(state.filterDelivery));
  if(state.filterSea)arr=arr.filter(p=>p.tags.some(t=>/море|sea/i.test(t)));
  if(state.sort==="priceAsc")arr.sort((a,b)=>a.price-b.price);
  if(state.sort==="priceDesc")arr.sort((a,b)=>b.price-a.price);
  return arr;
}
function catalog(map=false){
  if(map)state.catalogView="map";
  const arr=filtered();
  const list='<div class="meta"><span>'+arr.length+' проекта</span><button class="sort-btn" data-sheet="sort">↕ '+(state.sort==="priceDesc"?"Сначала дороже":state.sort==="priceAsc"?"Сначала дешевле":"По популярности")+'</button></div><div class="list">'+arr.map(p=>propertyCard(p,true)).join("")+'</div>';
  const mapView='<div class="map-placeholder"><span class="pin red" style="left:18%;top:28%">6,2 млн</span><span class="pin" style="right:16%;top:42%">7,8 млн</span><span class="pin" style="left:38%;bottom:22%">5,4 млн</span></div>';
  return shell('<div><span class="eyebrow">Каталог PULSE.DV</span><h1 class="title">Новостройки</h1><p class="subtitle">Подбирайте спокойно — по району, бюджету и сроку сдачи.</p></div>'+
    '<div class="segmented"><button data-view="list" class="'+(state.catalogView==="list"?"active":"")+'">Список</button><button data-view="map" class="'+(state.catalogView==="map"?"active":"")+'">Карта</button></div>'+
    '<div class="search">'+icon("search")+'<input id="catalogSearch" value="'+state.q+'" placeholder="ЖК, район, застройщик"><button data-sheet="filters">'+icon("filter")+'</button></div>'+
    (state.catalogView==="list"?list:mapView));
}
function selectionMatches(){
  return properties.map(p=>{
    let score=0,why=[];
    if(p.city===state.selectedCity){score+=28;why.push("город");}
    if(p.rooms.includes(state.rooms)){score+=24;why.push("комнатность");}
    if(p.price>=state.budgetMin&&p.price<=state.budgetMax){score+=28;why.push("бюджет");}
    if(state.delivery==="Любой"||p.delivery.includes(state.delivery)){score+=10;why.push("срок");}
    for(const pr of state.priorities){
      if(p.tags.some(t=>t.toLowerCase().includes(pr==="sea"?"sea":pr))){score+=5;why.push(pr==="sea"?"вид на море":pr);}
    }
    return {...p,score:Math.min(score,100),why};
  }).sort((a,b)=>b.score-a.score);
}
function selection(){
  const s=state.selectStep,top=selectionMatches()[0];
  let body="";
  if(s===0)body='<div class="step-icon">'+icon("building")+'</div><span class="eyebrow">Шаг 1 из 4</span><h2>Где ищем квартиру?</h2><p>Выберите город. Остальные параметры настроим дальше.</p><div class="choice-grid">'+["Владивосток","Уссурийск","Артём"].map(v=>'<button class="choice '+(state.selectedCity===v?"active":"")+'" data-city="'+v+'">'+v+'</button>').join("")+'</div>';
  if(s===1)body='<div class="step-icon">'+icon("percent")+'</div><span class="eyebrow">Шаг 2 из 4</span><h2>Комфортный бюджет</h2><p>Два независимых ползунка не перекрывают друг друга и стабильно работают на телефоне.</p><div class="slider-line">'+
    '<div class="slider-row"><span>От</span><input class="range" id="budgetMin" type="range" min="4000000" max="25000000" step="100000" value="'+state.budgetMin+'" style="--fill:'+((state.budgetMin-4000000)/21000000*100)+'%"><b>'+mln(state.budgetMin)+'</b></div>'+
    '<div class="slider-row"><span>До</span><input class="range" id="budgetMax" type="range" min="4000000" max="25000000" step="100000" value="'+state.budgetMax+'" style="--fill:'+((state.budgetMax-4000000)/21000000*100)+'%"><b>'+mln(state.budgetMax)+'</b></div></div>';
  if(s===2)body='<div class="step-icon">'+icon("spark")+'</div><span class="eyebrow">Шаг 3 из 4</span><h2>Какой формат нужен?</h2><p>Только параметры, которые реально влияют на подбор.</p><div class="choice-grid">'+["Студия","1","2","3+"].map(v=>'<button class="choice '+(state.rooms===v?"active":"")+'" data-rooms="'+v+'">'+v+'</button>').join("")+'</div>';
  if(s===3)body='<div class="step-icon">'+icon("spark")+'</div><span class="eyebrow">Шаг 4 из 4</span><h2>Что для вас важнее?</h2><p>Мягкие приоритеты не отсекают варианты жёстко — они помогают расставить проекты по полезности.</p><div class="chips">'+
    [["sea","Вид на море"],["quiet","Тишина"],["center","Ближе к центру"],["parking","Парковка"]].map(([k,l])=>'<button class="chip '+(state.priorities.has(k)?"active":"")+'" data-priority="'+k+'">'+l+'</button>').join("")+
    '</div><div class="field-title"><span>Срок сдачи</span></div><div class="chips">'+["Любой","2026","2027"].map(v=>'<button class="chip '+(state.delivery===v?"active":"")+'" data-delivery="'+v+'">'+v+'</button>').join("")+
    '</div><div style="margin-top:12px" class="switch-row"><div><strong>Нужна ипотека</strong><small>Учтём при консультации менеджера</small></div><button class="switch '+(state.mortgage?"on":"")+'" data-switch="mortgage"><i></i></button></div>';
  return shell('<div><span class="eyebrow">PULSE Select</span><h1 class="title">Найдём ваш вариант</h1><p class="subtitle">Четыре коротких шага. Результат обновляется по ходу выбора.</p></div>'+
    '<div class="progress">'+[0,1,2,3].map(i=>'<i class="'+(i<=s?"on":"")+'"></i>').join("")+'</div>'+
    '<section class="select-card card">'+body+'</section>'+
    '<div class="select-result"><div><b>'+(top?"Лучшее совпадение: "+top.score+"%":"Подбираем")+'</b><small>'+(top?top.name+" · "+top.city:"Меняйте параметры")+'</small></div>'+icon("chev")+'</div>'+
    '<div class="actions">'+(s>0?'<button class="secondary back" data-select-back>'+icon("back")+' Назад</button>':"")+'<button class="primary" data-select-next>'+(s===3?"Показать варианты":"Продолжить")+' →</button></div>'+
    '<div class="note">PULSE Select не скрывает варианты — он помогает расставить их по приоритету.</div>');
}
function mortgage(){
  const p=programs[state.mortgageProgram];
  state.years=Math.min(state.years,p.maxYears);
  if(state.mortgageProgram!=="standard")state.rate=p.rate;
  const minDown=Math.ceil(state.price*p.minDown/100000)*100000;
  if(state.down<minDown)state.down=minDown;
  const loan=Math.max(0,state.price-state.down),over=Number.isFinite(p.limit)&&loan>p.limit;
  const neededDown=Number.isFinite(p.limit)?Math.max(minDown,state.price-p.limit):minDown;
  const payment=over?0:annuity(loan,state.rate,state.years),total=payment*state.years*12;
  const programButtons=Object.entries(programs).map(([k,v])=>'<button data-program="'+k+'" class="'+(state.mortgageProgram===k?"active":"")+'"><span>'+v.label+'</span><b>'+v.rate+'%</b></button>').join("");
  const result=over
    ?'<div class="warning">'+icon("info")+'<div><b>Для этой программы нужен больший первоначальный взнос.</b><br>Чтобы уложиться в лимит кредита, ПВ должен быть не меньше '+money(neededDown)+' ₽.</div></div>'
    :'<section class="result card"><span class="eyebrow">Ориентировочный платёж</span><div class="payment">'+money(payment)+' ₽ / мес</div><div class="result-grid"><div><span>Сумма кредита</span><b>'+money(loan)+' ₽</b></div><div><span>Переплата</span><b>'+money(Math.max(total-loan,0))+' ₽</b></div><div><span>Всего выплат</span><b>'+money(total)+' ₽</b></div><div><span>Доход, ориентир</span><b>от '+money(payment/.45)+' ₽</b></div></div></section>';
  return shell('<div><span class="eyebrow">Ипотека PULSE.DV</span><h1 class="title">Расчёт платежа</h1><p class="subtitle">Понятный расчёт без смешанных ставок и перегруженных схем.</p></div>'+
    '<div class="mortgage-programs">'+programButtons+'</div>'+
    '<div class="rule-strip"><div><b>'+p.maxYears+'</b>лет максимум</div><div><b>'+(p.minDown*100).toFixed(1).replace(".",",")+'%</b>ПВ от</div><div><b>'+(Number.isFinite(p.limit)?mln(p.limit):"—")+'</b>'+(Number.isFinite(p.limit)?"лимит кредита":"рыночная программа")+'</div></div>'+
    '<section class="calc card">'+
      '<div><div class="field-title"><span>Стоимость квартиры</span><b>'+money(state.price)+' ₽</b></div><div class="input-shell"><input id="priceInput" value="'+money(state.price)+'"><span>₽</span></div><input class="range" id="priceRange" type="range" min="3000000" max="30000000" step="100000" value="'+state.price+'" style="--fill:'+((state.price-3000000)/27000000*100)+'%"></div>'+
      '<div><div class="field-title"><span>Первоначальный взнос</span><b>'+money(state.down)+' ₽</b></div><div class="input-shell"><input id="downInput" value="'+money(state.down)+'"><span>₽</span></div><input class="range" id="downRange" type="range" min="'+minDown+'" max="'+Math.max(minDown,state.price-100000)+'" step="100000" value="'+state.down+'" style="--fill:'+((state.down-minDown)/Math.max(1,state.price-100000-minDown)*100)+'%"></div>'+
      '<div><div class="field-title"><span>Срок</span><b>'+state.years+' лет</b></div><input class="range" id="yearsRange" type="range" min="5" max="'+p.maxYears+'" step="1" value="'+state.years+'" style="--fill:'+((state.years-5)/Math.max(1,p.maxYears-5)*100)+'%"></div>'+
      '<div><div class="field-title"><span>Ставка</span><b>'+state.rate+'%</b></div><div class="input-shell"><input id="rateInput" value="'+state.rate+'"><span>%</span></div></div>'+
    '</section>'+result+'<button class="primary" data-sheet="lead">Получить точный расчёт</button><div class="note">Предварительный расчёт. Банк отдельно проверяет объект, страховку и персональную ставку.</div>');
}
function favorites(){
  const arr=properties.filter(p=>state.favorites.has(p.id));
  return shell('<div><span class="eyebrow">Ваш шорт-лист</span><h1 class="title">Избранное</h1><p class="subtitle">Сохраняйте сильные варианты и сравнивайте 2–3 проекта без широкой таблицы.</p></div>'+
    (arr.length?'<div class="list">'+arr.map(p=>propertyCard(p,true)+'<button class="secondary" data-compare="'+p.id+'">'+(state.compare.has(p.id)?"✓ В сравнении":"Добавить к сравнению")+'</button>').join("")+'</div>':'<div class="card" style="padding:28px;text-align:center"><b>Пока ничего не сохранено</b><p class="subtitle">Нажмите сердечко на карточке ЖК.</p></div>')+
    (arr.length?'<button class="primary" '+(state.compare.size<2?'disabled style="opacity:.35"':"")+' data-sheet="compare">Сравнить '+(state.compare.size||"")+'</button>':""));
}
function profile(){
  return shell('<div><span class="eyebrow">Ваш PULSE.DV</span><h1 class="title">Помощь с покупкой</h1><p class="subtitle">Избранное, подборы и связь с менеджером — в одном месте.</p></div><section class="card profile-menu">'+
    '<button class="profile-item" data-go="favorites"><span class="quick-icon">'+icon("heart")+'</span><span><b>Избранное</b><small>Ваш шорт-лист объектов</small></span>'+icon("chev")+'</button>'+
    '<button class="profile-item" data-go="selection"><span class="quick-icon">'+icon("spark")+'</span><span><b>PULSE Select</b><small>Повторить подбор</small></span>'+icon("chev")+'</button>'+
    '<button class="profile-item" data-replay-onboarding><span class="quick-icon">'+icon("info")+'</span><span><b>Показать знакомство</b><small>Повторно открыть onboarding</small></span>'+icon("chev")+'</button></section>'+
    '<button class="primary" data-sheet="lead">Связаться с PULSE.DV</button>');
}
function property(id){
  const p=properties.find(x=>x.id===id)||properties[0];
  return shell('<button class="icon-btn" data-go="catalog">'+icon("back")+'</button><div class="property card"><div class="property-media" style="height:300px;background-image:url(\''+p.img+'\')"><span class="badge">'+p.tags[0]+'</span><button class="heart '+(state.favorites.has(p.id)?"active":"")+'" data-fav="'+p.id+'">'+icon("heart")+'</button></div><div class="property-body" style="padding:20px"><span class="eyebrow">'+p.className+'</span><h1 class="title" style="font-size:30px">'+p.name+'</h1><p>'+p.city+' · '+p.district+'</p><div class="price" style="font-size:22px">от '+mln(p.price)+'</div><div class="rule-strip" style="margin-top:18px"><div><b>'+p.delivery+'</b>срок сдачи</div><div><b>'+p.className+'</b>класс</div><div><b>'+p.rooms.join(", ")+'</b>планировки</div></div></div></div><button class="primary" data-sheet="lead">Получить презентацию</button>');
}
function sheetWrap(title,desc,body){return '<div class="sheet-backdrop" data-close-sheet></div><section class="sheet"><i class="grab"></i><h3>'+title+'</h3><p class="desc">'+desc+'</p>'+body+'</section>';}
function sheet(){
  if(state.sheet==="filters")return sheetWrap("Фильтры","Оставьте только подходящие проекты.",
    '<div class="field-title"><span>Город</span></div><div class="chips">'+["Все","Владивосток","Уссурийск","Артём"].map(v=>'<button class="chip '+(state.filterCity===v?"active":"")+'" data-filter-city="'+v+'">'+v+'</button>').join("")+'</div>'+
    '<div class="field-title"><span>Комнатность</span></div><div class="chips">'+["Все","Студия","1","2","3+"].map(v=>'<button class="chip '+(state.filterRooms===v?"active":"")+'" data-filter-rooms="'+v+'">'+v+'</button>').join("")+'</div>'+
    '<div class="field-title"><span>Срок сдачи</span></div><div class="chips">'+["Любой","2026","2027"].map(v=>'<button class="chip '+(state.filterDelivery===v?"active":"")+'" data-filter-delivery="'+v+'">'+v+'</button>').join("")+'</div>'+
    '<div class="field-title"><span>Особенности</span></div><button class="chip '+(state.filterSea?"active":"")+'" data-filter-sea>Вид на море</button><div style="height:16px"></div><button class="primary" data-close-sheet>Показать '+filtered().length+' проекта</button>');
  if(state.sheet==="sort")return sheetWrap("Сортировка","Выберите порядок проектов.",'<div class="chips">'+[["popular","По популярности"],["priceAsc","Сначала дешевле"],["priceDesc","Сначала дороже"]].map(([k,l])=>'<button class="chip '+(state.sort===k?"active":"")+'" data-sort="'+k+'">'+l+'</button>').join("")+'</div>');
  if(state.sheet==="compare"){
    const arr=properties.filter(p=>state.compare.has(p.id));
    return sheetWrap("Сравнение проектов","Карточки адаптированы под телефон — без горизонтального скролла.",'<div class="compare-list">'+arr.map((p,i)=>'<div class="compare-card"><div class="compare-head"><div class="compare-num">'+(i+1)+'</div><div><b>'+p.name+'</b><small>'+p.city+' · '+p.district+'</small></div></div><div class="compare-facts"><div><span>Цена от</span><b>'+mln(p.price)+'</b></div><div><span>Срок сдачи</span><b>'+p.delivery+'</b></div><div><span>Класс</span><b>'+p.className+'</b></div><div><span>Застройщик</span><b>'+p.developer+'</b></div></div></div>').join("")+'</div>');
  }
  if(state.sheet==="lead")return sheetWrap("Связаться с PULSE.DV","Оставьте номер — менеджер свяжется и уточнит детали.",'<div class="input-shell"><input placeholder="Ваше имя"></div><div style="height:10px"></div><div class="input-shell"><input placeholder="Телефон" inputmode="tel"></div><div style="height:14px"></div><button class="primary" data-close-sheet>Отправить</button>');
  if(state.sheet==="notifications")return sheetWrap("Уведомления","В рабочей версии важные уведомления будут приходить в чат Telegram-бота.",'<div class="card" style="padding:16px"><b>Изменение цены</b><p class="subtitle">ЖК из избранного стал дешевле.</p></div>');
  return "";
}
function onboarding(){
  if(localStorage.getItem("pulse_onboarding_version")==="7"&&!state.forceOnboarding)return "";
  const slide=Number(localStorage.getItem("pulse_onboarding_slide")||0);
  const slides=[
    ["Новостройки Приморья — в одном месте","Сравнивайте проекты, районы и цены без десятков вкладок."],
    ["PULSE Select подскажет, с чего начать","Короткий подбор расставит варианты по вашим приоритетам."],
    ["От интереса — к реальной сделке","Сохраняйте, сравнивайте и связывайтесь с командой PULSE.DV."]
  ];
  const [h,p]=slides[slide];
  return '<div class="onboarding"><div class="onboarding-inner"><button class="on-skip" data-on-skip>Пропустить</button><div class="on-art"><div class="on-mark">PULSE</div></div><h1>'+h+'</h1><p>'+p+'</p><button class="primary" data-on-next>'+(slide===2?"Начать":"Продолжить")+'</button><div class="on-dots">'+slides.map((_,i)=>'<i class="'+(i===slide?"on":"")+'"></i>').join("")+'</div></div></div>';
}
function render(){
  let html;
  if(state.route==="home")html=home();
  else if(state.route==="catalog")html=catalog();
  else if(state.route==="catalog-map")html=catalog(true);
  else if(state.route==="selection")html=selection();
  else if(state.route==="mortgage")html=mortgage();
  else if(state.route==="favorites")html=favorites();
  else if(state.route==="profile")html=profile();
  else if(state.route.startsWith("property:"))html=property(state.route.split(":")[1]);
  else html=home();
  $("#app").innerHTML=html;
  bind();
}
function bind(){
  $$("[data-go]").forEach(el=>el.onclick=()=>go(el.dataset.go));
  $$("[data-sheet]").forEach(el=>el.onclick=e=>{e.stopPropagation();state.sheet=el.dataset.sheet;render();});
  $$("[data-close-sheet]").forEach(el=>el.onclick=()=>{state.sheet=null;render();});
  $$("[data-fav]").forEach(el=>el.onclick=e=>{e.stopPropagation();const id=el.dataset.fav;state.favorites.has(id)?state.favorites.delete(id):state.favorites.add(id);saveFav();render();});
  $$("[data-property]").forEach(el=>el.onclick=e=>{if(!e.target.closest("[data-fav]"))go("property:"+el.dataset.property);});
  $$("[data-view]").forEach(el=>el.onclick=()=>{state.catalogView=el.dataset.view;render();});
  const cs=$("#catalogSearch");if(cs)cs.oninput=()=>{state.q=cs.value;render();};
  const hs=$("#homeSearch");if(hs)hs.onsubmit=e=>{e.preventDefault();state.q=$("#homeSearchInput").value;go("catalog");};
  $$("[data-sort]").forEach(el=>el.onclick=()=>{state.sort=el.dataset.sort;state.sheet=null;render();});
  $$("[data-filter-city]").forEach(el=>el.onclick=()=>{state.filterCity=el.dataset.filterCity;render();});
  $$("[data-filter-rooms]").forEach(el=>el.onclick=()=>{state.filterRooms=el.dataset.filterRooms;render();});
  $$("[data-filter-delivery]").forEach(el=>el.onclick=()=>{state.filterDelivery=el.dataset.filterDelivery;render();});
  const fs=$("[data-filter-sea]");if(fs)fs.onclick=()=>{state.filterSea=!state.filterSea;render();};
  $$("[data-city]").forEach(el=>el.onclick=()=>{state.selectedCity=el.dataset.city;render();});
  $$("[data-rooms]").forEach(el=>el.onclick=()=>{state.rooms=el.dataset.rooms;render();});
  $$("[data-priority]").forEach(el=>el.onclick=()=>{const k=el.dataset.priority;state.priorities.has(k)?state.priorities.delete(k):state.priorities.add(k);render();});
  $$("[data-delivery]").forEach(el=>el.onclick=()=>{state.delivery=el.dataset.delivery;render();});
  const sw=$('[data-switch="mortgage"]');if(sw)sw.onclick=()=>{state.mortgage=!state.mortgage;render();};
  const sn=$("[data-select-next]");if(sn)sn.onclick=()=>{if(state.selectStep<3){state.selectStep++;render();}else{state.filterCity=state.selectedCity;state.filterRooms=state.rooms;state.catalogView="list";go("catalog");}};
  const sb=$("[data-select-back]");if(sb)sb.onclick=()=>{state.selectStep--;render();};
  const bmin=$("#budgetMin");if(bmin)bmin.oninput=()=>{state.budgetMin=Math.min(+bmin.value,state.budgetMax-100000);render();};
  const bmax=$("#budgetMax");if(bmax)bmax.oninput=()=>{state.budgetMax=Math.max(+bmax.value,state.budgetMin+100000);render();};
  $$("[data-program]").forEach(el=>el.onclick=()=>{state.mortgageProgram=el.dataset.program;const p=programs[state.mortgageProgram];state.rate=p.rate;state.years=Math.min(state.years,p.maxYears);render();});
  [["priceRange","price"],["downRange","down"],["yearsRange","years"]].forEach(([id,key])=>{const el=$("#"+id);if(el)el.oninput=()=>{state[key]=+el.value;render();};});
  const pi=$("#priceInput");if(pi)pi.onchange=()=>{const n=+pi.value.replace(/\D/g,"");if(n)state.price=n;render();};
  const di=$("#downInput");if(di)di.onchange=()=>{const n=+di.value.replace(/\D/g,"");if(n)state.down=n;render();};
  const ri=$("#rateInput");if(ri)ri.onchange=()=>{const n=+ri.value.replace(",",".");if(n)state.rate=n;render();};
  $$("[data-compare]").forEach(el=>el.onclick=()=>{const id=el.dataset.compare;if(state.compare.has(id))state.compare.delete(id);else if(state.compare.size<3)state.compare.add(id);render();});
  const replay=$("[data-replay-onboarding]");if(replay)replay.onclick=()=>{state.forceOnboarding=true;localStorage.setItem("pulse_onboarding_slide","0");render();};
  const next=$("[data-on-next]");if(next)next.onclick=()=>{let s=Number(localStorage.getItem("pulse_onboarding_slide")||0);if(s<2){localStorage.setItem("pulse_onboarding_slide",String(s+1));render();}else{localStorage.setItem("pulse_onboarding_version","7");localStorage.removeItem("pulse_onboarding_slide");state.forceOnboarding=false;render();}};
  const skip=$("[data-on-skip]");if(skip)skip.onclick=()=>{localStorage.setItem("pulse_onboarding_version","7");localStorage.removeItem("pulse_onboarding_slide");state.forceOnboarding=false;render();};
}
window.addEventListener("hashchange",()=>{const route=location.hash.slice(1);if(route){state.route=route;render();}});
render();
