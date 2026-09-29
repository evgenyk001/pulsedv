const mortgageNames:Record<string,string>={
  family:"Семейная ипотека",
  farEast:"Дальневосточная ипотека",
  it:"IT-ипотека",
  standard:"Базовая ипотека",
};

const number=(value:unknown)=>typeof value==="number"&&Number.isFinite(value)?value:null;
const text=(value:unknown)=>typeof value==="string"&&value.trim()?value.trim():null;
const rub=(value:unknown)=>number(value)===null?null:Math.round(number(value)!).toLocaleString("ru-RU")+" ₽";
const area=(from:unknown,to:unknown)=>{
  const a=number(from),b=number(to);
  if(a===null&&b===null)return null;
  if(a!==null&&b!==null&&a!==b)return a.toLocaleString("ru-RU")+"–"+b.toLocaleString("ru-RU")+" м²";
  return (a??b)!.toLocaleString("ru-RU")+" м²";
};

export function parseLegacyLeadContext(comment:string|null|undefined):Record<string,unknown>|null{
  if(!comment||!comment.trim().startsWith("{"))return null;
  try{
    const value=JSON.parse(comment);
    if(!value||typeof value!=="object"||Array.isArray(value))return null;
    const known=["program","price","down","years","rate","payment","rooms","areaFrom","areaTo","floorplanId","propertyName"];
    return known.some(key=>key in value)?value:null;
  }catch{return null}
}

export function cleanManagerComment(comment:string|null|undefined){
  return parseLegacyLeadContext(comment)?"":comment??"";
}

export function leadRequestContext(requestContext:Record<string,unknown>|undefined,comment:string|null|undefined){
  if(requestContext&&Object.keys(requestContext).length)return requestContext;
  return parseLegacyLeadContext(comment)??{};
}

export function describeLeadRequestContext(context:Record<string,unknown>,source:string){
  const lines:string[]=[];
  const propertyName=text(context.propertyName);
  if(propertyName)lines.push(propertyName);
  if(source.startsWith("mortgage")||context.program||context.payment){
    const program=text(context.program);
    if(program)lines.push(mortgageNames[program]||program);
    const price=rub(context.price);if(price)lines.push("Стоимость "+price);
    const down=rub(context.down);if(down)lines.push("Первоначальный взнос "+down);
    const years=number(context.years);if(years!==null)lines.push("Срок "+years+" "+(years%10===1&&years%100!==11?"год":years%10>=2&&years%10<=4&&(years%100<10||years%100>=20)?"года":"лет"));
    const rate=number(context.rate);if(rate!==null)lines.push("Ставка "+rate.toLocaleString("ru-RU")+"%");
    const payment=rub(context.payment);if(payment)lines.push("Платёж ≈ "+payment+"/мес");
    return {title:"Ипотечный расчёт",lines};
  }
  if(source==="floorplan"||context.floorplanId||context.rooms){
    const rooms=text(context.rooms);if(rooms)lines.push(rooms==="Студия"?rooms:rooms+" комн.");
    const square=area(context.areaFrom,context.areaTo);if(square)lines.push("Площадь "+square);
    const price=rub(context.price);if(price)lines.push("Цена "+price);
    return {title:"Интерес к планировке",lines};
  }
  return {title:"Контекст обращения",lines};
}
