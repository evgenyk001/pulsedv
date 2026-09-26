import { z } from 'zod';
const text=(max=200)=>z.string().trim().max(max);
const https=z.string().max(2048).refine(value=>{try{return value.startsWith('/media/')||new URL(value).protocol==='https:';}catch{return false;}},'Нужна HTTPS-ссылка или внутренний /media/ путь');
const nullableText=(max=200)=>text(max).nullable();
const image=https.nullable();
const id=text(120).regex(/^[a-zA-Z0-9_-]+$/);
const rule=z.object({id,eventType:text(80).min(1),label:text(160).min(1),weight:z.number().int().min(-100).max(100),maxCount:z.number().int().min(1).max(100)}).strict();
export const engineSchema=z.object({rules:z.array(rule).max(50),thresholds:z.object({warm:z.number().int().min(1).max(100),hot:z.number().int().min(1).max(100),urgent:z.number().int().min(1).max(100)})}).refine(x=>x.thresholds.warm<x.thresholds.hot&&x.thresholds.hot<x.thresholds.urgent,'Пороги должны возрастать: warm < hot < urgent');
const property=z.object({
 id,name:text().min(1),city:text(100).min(1),district:text(100),address:nullableText(400),latitude:z.number().min(-90).max(90).nullable(),longitude:z.number().min(-180).max(180).nullable(),priceFrom:z.number().min(0).max(10000),delivery:text(100),className:text(100),status:z.enum(['draft','published','archived']),description:text(10000),developerName:text(),tags:z.array(text(100)).max(20),coverImageUrl:image,sortOrder:z.number().int(),
 images:z.array(z.object({id:id.optional(),url:https,alt:text(),sortOrder:z.number().int()})).max(50),
 features:z.array(z.object({id:id.optional(),label:text(),icon:text(50),sortOrder:z.number().int()})).max(30),
 floorplans:z.array(z.object({id:id.optional(),roomLabel:text(30).min(1),areaFrom:z.number().positive().nullable(),areaTo:z.number().positive().nullable(),priceFrom:z.number().positive().nullable(),imageUrl:image,sortOrder:z.number().int()})).max(200)
}).superRefine((p,ctx)=>{
 if(p.status==='published'&&(!p.coverImageUrl||!p.developerName||!p.delivery||p.priceFrom<=0))ctx.addIssue({code:'custom',message:'Для публикации нужны обложка, застройщик, срок сдачи и цена'});
 if((p.latitude===null)!==(p.longitude===null))ctx.addIssue({code:'custom',message:'Укажите обе координаты'});
 for(const plan of p.floorplans)if(plan.areaFrom&&plan.areaTo&&plan.areaFrom>plan.areaTo)ctx.addIssue({code:'custom',message:'Минимальная площадь больше максимальной'});
});
const actionUrl=nullableText(2048).refine(value=>!value||(/^\/(?!\/)/.test(value))||value.startsWith('https://'),'Недопустимая ссылка');
export const stateSchema=z.object({
 properties:z.array(property).max(2000),
 banners:z.array(z.object({id,title:text(250),body:text(1000),imageUrl:image,ctaLabel:nullableText(100),actionUrl,city:nullableText(100),audience:nullableText(),enabled:z.boolean(),sortOrder:z.number().int()})).max(100),
 mortgagePrograms:z.array(z.object({id:z.enum(['family','farEast','it','standard']),label:text(100),rate:z.number().min(0).max(60),maxYears:z.number().int().min(1).max(40),minDownPct:z.number().min(0).max(99),subsidizedLimit:z.number().positive(),totalLimit:z.number().positive(),blended:z.boolean(),hint:text(2000)})).min(1).max(4),
 select:z.object({
  cities:z.array(text(100).min(1)).min(1).max(30),
  roomOptions:z.array(text(30).min(1)).min(1).max(10),
  deliveryOptions:z.array(text(100).min(1)).min(1).max(30),
  mortgageEnabled:z.boolean(),
  seaEnabled:z.boolean(),
  smartQueryEnabled:z.boolean(),
  whatIfEnabled:z.boolean(),
  maxPreferences:z.number().int().min(1).max(6),
  preferenceEnabled:z.object({
    sea:z.boolean(),family:z.boolean(),parking:z.boolean(),center:z.boolean(),courtyard:z.boolean(),finish:z.boolean()
  }),
  weights:z.object({city:z.number().min(0).max(100),budget:z.number().min(0).max(100),rooms:z.number().min(0).max(100),delivery:z.number().min(0).max(100),preferences:z.number().min(0).max(100)})
 }),
 content:z.object({onboardingEnabled:z.boolean(),onboardingVersion:text(50).min(1)}),leadEngine:engineSchema,updatedAt:z.string()
}).superRefine((s,ctx)=>{for(const key of ['properties','banners','mortgagePrograms'] as const)if(new Set(s[key].map(x=>x.id)).size!==s[key].length)ctx.addIssue({code:'custom',message:`Повторяющиеся ID: ${key}`});});
export const phoneSchema=text(30).transform(value=>value.replace(/[^\d+]/g,'').replace(/^8(?=\d{10}$)/,'+7').replace(/^7(?=\d{10}$)/,'+7')).pipe(z.string().regex(/^\+[1-9]\d{9,14}$/,'Укажите телефон в международном формате'));
export const leadSchema=z.object({idempotencyKey:z.uuid(),source:text(100).min(1),propertyId:id.nullable().optional(),name:text(100).min(2),phone:phoneSchema,comment:nullableText(3000).optional(),consent:z.literal(true),consentVersion:text(100).min(1)}).strict();
const eventTypes=['page_view','onboarding_complete','property_view','favorite_add','favorite_remove','compare_add','compare_remove','catalog_filter','mortgage_program','mortgage_calculated','select_submit','property_share','lead_form_open','contact_click','return_visit'] as const;
export const eventsSchema=z.object({events:z.array(z.object({idempotencyKey:z.uuid(),eventType:z.enum(eventTypes),entityType:nullableText(80).optional(),entityId:nullableText(200).optional(),metadata:z.record(z.string(),z.unknown()).default({}),occurredAt:z.iso.datetime()})).min(1).max(100)});
export function safeMetadata(input:Record<string,unknown>){
 const allowed=['city','district','priceFrom','min','max','rooms','delivery','sea','mortgage','topScore','strongCount','program','price','down','years','rate','payment','results','source','purchaseMode','preferences'];
 return Object.fromEntries(Object.entries(input).filter(([key,value])=>allowed.includes(key)&&(typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)||typeof value==='string'&&value.length<=150)));
}


const mediaUrl=z.string().max(2048).refine(value=>{
 try{return value.startsWith('/media/')||new URL(value).protocol==='https:';}catch{return false;}
},'Нужна HTTPS-ссылка или внутренний /media/ путь');

export const catalogPropertySchema=z.object({
 id,
 name:text().min(1),
 city:text(100).min(1),
 district:text(100),
 address:nullableText(400),
 latitude:z.number().min(-90).max(90).nullable(),
 longitude:z.number().min(-180).max(180).nullable(),
 priceFrom:z.number().min(0).max(10000),
 delivery:text(100),
 className:text(100),
 status:z.enum(['draft','published','archived']),
 description:text(10000),
 developerName:text(),
 tags:z.array(text(100)).max(20),
 coverImageUrl:mediaUrl.nullable(),
 sortOrder:z.number().int(),
 images:z.array(z.object({id:id.optional(),url:mediaUrl,alt:text(),sortOrder:z.number().int()})).max(100),
 features:z.array(z.object({id:id.optional(),label:text(),icon:text(50),sortOrder:z.number().int()})).max(50),
 floorplans:z.array(z.object({id:id.optional(),roomLabel:text(30).min(1),areaFrom:z.number().positive().nullable(),areaTo:z.number().positive().nullable(),priceFrom:z.number().positive().nullable(),imageUrl:mediaUrl.nullable(),sortOrder:z.number().int()})).max(500),
 documents:z.array(z.object({
  id:id.optional(),kind:z.enum(['presentation','document']),name:text(300).min(1),url:mediaUrl,
  mimeType:nullableText(120),sizeBytes:z.number().int().nonnegative().nullable(),sortOrder:z.number().int()
 })).max(50).default([])
}).superRefine((p,ctx)=>{
 if(p.status==='published'&&(!p.coverImageUrl||!p.developerName||!p.delivery||p.priceFrom<=0))ctx.addIssue({code:'custom',message:'Для публикации нужны обложка, застройщик, срок сдачи и цена'});
 if((p.latitude===null)!==(p.longitude===null))ctx.addIssue({code:'custom',message:'Укажите обе координаты'});
 for(const plan of p.floorplans)if(plan.areaFrom&&plan.areaTo&&plan.areaFrom>plan.areaTo)ctx.addIssue({code:'custom',message:'Минимальная площадь больше максимальной'});
});

export const catalogImportSchema=z.object({
 properties:z.array(catalogPropertySchema).min(1).max(1000),
 replace:z.object({
  images:z.boolean().default(false),
  features:z.boolean().default(false),
  floorplans:z.boolean().default(false),
  documents:z.boolean().default(false)
 }).default({images:false,features:false,floorplans:false,documents:false})
}).strict();
