/** Compare catalog labels without merging distinct classes such as comfort and comfort+. */
export function housingClassKey(value:string){
 const key=value.toLowerCase().replace(/ё/g,'е').replace(/класс|[\s_-]/g,'').replace(/плюс/g,'+');
 if(['эконом','экономичный','стандарт','типовой'].includes(key))return 'standard';
 return key;
}
export function housingClassLabel(value:string){
 const key=housingClassKey(value);
 return ({standard:'Стандарт',комфорт:'Комфорт','комфорт+':'Комфорт+',бизнес:'Бизнес','бизнес+':'Бизнес+',премиум:'Премиум',элитный:'Элитный'} as Record<string,string>)[key]??value.trim();
}
export function housingClassChoices(values:string[]){
 const unique=new Map(values.filter(v=>v.trim()).map(v=>[housingClassKey(v),housingClassLabel(v)]));
 return [...unique.values()].sort((a,b)=>a.localeCompare(b,'ru'));
}
export function housingClassMatches(value:string,selected:readonly string[]=[]){return !selected.length||selected.some(c=>housingClassKey(c)===housingClassKey(value));}
export function mentionedHousingClasses(text:string,choices:string[]){
 const normalized=text.toLowerCase().replace(/ё/g,'е').replace(/\s*плюс(?=$|[^а-я])/g,'+');
 return choices.filter(choice=>{
  const label=housingClassLabel(choice).toLowerCase();
  if(housingClassKey(choice)==='standard')return /эконом|стандарт|типов/.test(normalized);
  const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp('(?:^|[^а-я])'+escaped+'(?=$|[^а-я+])').test(normalized);
 });
}
