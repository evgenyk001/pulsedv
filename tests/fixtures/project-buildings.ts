import {DEFAULT_PROPERTIES,type PulseProperty,type ProjectBuilding} from '../../packages/pulse-data/model';
export const building=(id:string,name:string,year:number,status:ProjectBuilding['status']='building'):ProjectBuilding=>({id,name,phase:'Очередь '+id,sections:'1–2',status,address:null,deliveryYear:year,deliveryQuarter:4,commissioningDate:year+'-12-01',handoverDate:(year+1)+'-06-30',floorsFrom:12,floorsTo:24,totalApartments:240,availableApartments:12});
export function complexProject():PulseProperty{return {...structuredClone(DEFAULT_PROPERTIES[0]),id:'multi-project',name:'ЖК Многокорпусный',city:'Владивосток',delivery:'2027–2030',priceFrom:4,projectDetails:{commissioningDate:null,totalApartments:900,availableApartments:70,constructionType:'Монолитно-кирпичный',ceilingHeight:2.8,parkingType:'underground',buildings:[building('early','Корпус Восток',2027),building('late','Башня Запад',2030),building('ready','Готовый дом',2025,'completed')]},floorplans:[
 {id:'early-plan',buildingId:'early',sectionLabel:'1',roomLabel:'1',areaFrom:40,areaTo:40,priceFrom:8,priceTo:8,isExact:true,imageUrl:null,sortOrder:0},
 {id:'late-plan',buildingId:'late',roomLabel:'1',areaFrom:41,areaTo:41,priceFrom:5,priceTo:5,isExact:true,imageUrl:null,sortOrder:1},
 {id:'ready-plan',buildingId:'ready',roomLabel:'2',areaFrom:60,areaTo:60,priceFrom:9,priceTo:9,isExact:true,imageUrl:null,sortOrder:2},
 {id:'common-plan',roomLabel:'Студия',areaFrom:25,areaTo:25,priceFrom:4,priceTo:4,isExact:true,imageUrl:null,sortOrder:3}
]};}
