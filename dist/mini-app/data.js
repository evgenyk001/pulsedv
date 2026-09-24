export const properties=[
  {id:"prim",name:"ЖК Приморский",city:"Владивосток",district:"Центр",price:7800000,delivery:"I кв. 2027",className:"Бизнес",developer:"Партнёр PULSE.DV",rooms:["1","2","3+"],tags:["Старт продаж","центр"],img:"https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=80"},
  {id:"sun",name:"ЖК Солнечный",city:"Владивосток",district:"Патрокл",price:6200000,delivery:"IV кв. 2026",className:"Комфорт+",developer:"Партнёр PULSE.DV",rooms:["Студия","1","2"],tags:["Вид на море","sea","quiet"],img:"https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=900&q=80"},
  {id:"east",name:"ЖК Восточный",city:"Уссурийск",district:"Новый район",price:5400000,delivery:"2027",className:"Комфорт",developer:"Партнёр PULSE.DV",rooms:["1","2","3+"],tags:["Парковка","quiet"],img:"https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80"},
  {id:"air",name:"ЖК Аэропорт",city:"Артём",district:"Северный",price:4900000,delivery:"2026",className:"Комфорт",developer:"Партнёр PULSE.DV",rooms:["Студия","1","2"],tags:["Новый район","parking"],img:"https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=900&q=80"}
];

export const programs={
  family:{label:"Семейная",rate:6,maxYears:30,minDown:.201,limit:6000000},
  farEast:{label:"Дальневосточная",rate:2,maxYears:20,minDown:.201,limit:6000000},
  it:{label:"IT",rate:6,maxYears:30,minDown:.201,limit:9000000},
  standard:{label:"Базовая",rate:18,maxYears:30,minDown:.201,limit:Infinity}
};

export const icons={
  home:'<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  building:'<path d="M5 21V4h10v17M9 8h2m-2 4h2m-2 4h2m6 5V9h3v12M3 21h18"/>',
  spark:'<path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5zM19 3v4M17 5h4M5 15v6M2 18h6"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  filter:'<path d="M4 6h16M7 12h10M10 18h4"/>',
  chev:'<path d="m9 18 6-6-6-6"/>',
  map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/>',
  percent:'<path d="m19 5-14 14M7 5h.01M17 19h.01"/><circle cx="7" cy="5" r="2"/><circle cx="17" cy="19" r="2"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  back:'<path d="m15 18-6-6 6-6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  compare:'<path d="M8 3 4 7l4 4M4 7h12M16 21l4-4-4-4M20 17H8"/>'
};

export const icon=(name,cls="")=>'<svg class="svg '+cls+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+(icons[name]||icons.info)+'</svg>';
export const money=n=>new Intl.NumberFormat("ru-RU").format(Math.round(n));
export const mln=n=>(n/1e6).toFixed(n%1e6?1:0).replace(".",",")+" млн ₽";
