import {createHash} from 'node:crypto';
import {SaxesParser} from 'saxes';
import {z} from 'zod';
import type {Database} from './database';

const feedConfig = z.array(z.object({
  propertyId:z.string().min(1).max(120),
  projectName:z.string().min(1),
  url:z.string().regex(/^https:\/\/plan7\.ru\/storage\/cat_feeds\/farpost\/[0-9]+\/save\.xml$/),
})).max(100).refine(items=>new Set(items.map(item=>item.propertyId)).size===items.length);
export type FeedConfig = z.infer<typeof feedConfig>[number];
export const parseFeedConfig = (value:string) => feedConfig.parse(JSON.parse(value));

const namespace = 'http://webmaster.yandex.ru/schemas/feed/realty/2010-06';
const maxBytes = 16 * 1024 * 1024;
const positive = z.coerce.number().finite().positive();
type FeedApartment = {
  id:string;externalId:string;roomLabel:string;area:number;price:number;image:string;
  apartment:{building:string;entrance:string|null;number:string;floor:number;floorsTotal:number};
};
const field = z.string().trim().min(1).max(120);

export function parseApartmentFeed(xml:string,projectName:string,city:string) {
  const parser = new SaxesParser({xmlns:true});
  const path:string[] = [];
  const apartments:FeedApartment[] = [];
  const ids = new Set<string>();
  let generation = '';
  let text = '';
  let externalId = '';
  let isPlan = false;
  let data:Record<string,string> = {};
  parser.on('doctype',()=>{throw new Error('DTD запрещён');});
  parser.on('opentag',tag=>{
    if(tag.uri!==namespace || (!path.length && tag.local!=='realty-feed')) throw new Error('Неизвестный формат XML');
    path.push(tag.local);
    text='';
    if(path.length===2 && tag.local==='offer'){
      externalId=field.parse(tag.attributes['internal-id']?.value);
      data={};
    }
    isPlan=tag.local==='image' && tag.attributes.tag?.value==='plan';
  });
  parser.on('text',value=>{text+=value;});
  parser.on('cdata',value=>{text+=value;});
  parser.on('closetag',tag=>{
    const key=path.slice(2).join('/');
    if(path.length===2 && tag.local==='generation-date') generation=text.trim();
    if(path[1]==='offer' && path.length>2 && tag.local!=='image') data[key]=text.trim();
    if(path[1]==='offer' && path.length===3 && isPlan) data.plan??=text.trim();
    if(path.length===2 && tag.local==='offer'){
      if(ids.has(externalId) || data['building-name']!==projectName || data['location/locality-name']!==city ||
         data.type!=='продажа' || data.category!=='квартира' || data['price/currency']!=='RUB') throw new Error('Фид содержит дубли или записи другого проекта');
      ids.add(externalId);
      const rooms=z.string().regex(/^\d+$/).parse(data.rooms);
      const image=z.string().url().refine(value=>new URL(value).origin==='https://plan7.ru').parse(data.plan);
      const section=field.parse(data['building-section']);
      const parts=section.match(/^(.*?),\s*(подъезд\s+.+)$/i);
      apartments.push({
        id:'feed-'+createHash('sha256').update(externalId).digest('hex').slice(0,32),
        externalId,
        roomLabel:data.studio==='1' || rooms==='0'?'Студия':rooms,
        area:positive.parse(data['area/value']?.replace(',','.')),
        price:positive.parse(data['price/value'])/1_000_000,
        image,
        apartment:{
          building:parts?.[1]??section, entrance:parts?.[2]??null,
          number:field.parse(data.apartment),
          floor:z.coerce.number().int().parse(field.parse(data.floor)),
          floorsTotal:z.coerce.number().int().positive().parse(field.parse(data['floors-total'])),
        },
      });
    }
    path.pop();
    text='';
  });
  parser.write(xml).close();
  const date = z.iso.datetime({offset:true}).parse(generation);
  if (!apartments.length) throw new Error('Пустой фид');
  return {generation:date,apartments};
}

async function download(url:string) {
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15_000)});
  if(!response.ok || !response.body) throw new Error('Фид недоступен');
  const reader=response.body.getReader();
  const decoder=new TextDecoder('utf-8',{fatal:true});
  let size=0;
  let xml='';
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>maxBytes)throw new Error('Фид превышает допустимый размер');
      xml+=decoder.decode(value,{stream:true});
    }
    return xml+decoder.decode();
  }finally{await reader.cancel();}
}

export async function syncApartmentFeed(db:Database,config:FeedConfig,apply=false){
  const scope=[config.propertyId,config.url];
  const property=(await db.query('select city from catalog_properties where id=$1',scope.slice(0,1))).rows[0];
  if(!property)throw new Error('Карточка проекта не найдена');
  try{
    const snapshot=parseApartmentFeed(await download(config.url),config.projectName,property.city);
    return await db.transaction(async sql=>{
      const current=(await sql.query('select city from catalog_properties where id=$1 for update',[config.propertyId])).rows[0];
      if(!current || current.city!==property.city)throw new Error('Карточка проекта изменилась');
      const previous=(await sql.query('select * from catalog_feed_state where property_id=$1',[config.propertyId])).rows[0];
      if(previous?.source && previous.source!==config.url)throw new Error('У проекта уже подключён другой источник');
      if(previous?.generation && +new Date(previous.generation)>=+new Date(snapshot.generation)){
        if(apply)await sql.query('update catalog_feed_state set checked_at=now(),error=null where property_id=$1',[config.propertyId]);
        return {unchanged:true,generation:snapshot.generation};
      }
      const rows=JSON.stringify(snapshot.apartments);
      const incoming=`select * from jsonb_to_recordset($2::jsonb)
        as x(id text,"externalId" text,"roomLabel" text,area numeric,price numeric,image text,apartment jsonb)`;
      const changes=(await sql.query(`with incoming as (${incoming}), old as (
        select * from catalog_feed_apartments where property_id=$1
      )
      select count(*) filter(where old.id is null and incoming.id is not null)::int as added,
        count(*) filter(where old.id is not null and incoming.id is not null and
          (not old.active or (old.room_label,old.area_from,old.price_from,old.image_url,old.apartment)
            is distinct from (incoming."roomLabel",incoming.area,incoming.price,incoming.image,incoming.apartment)))::int as updated,
        count(*) filter(where old.active and incoming.id is null)::int as hidden
      from incoming full join old using(id)`,[config.propertyId,rows])).rows[0];
      if(apply){
        await sql.query(`insert into catalog_feed_state(property_id,source) values($1,$2)
          on conflict(property_id) do nothing`,scope);
        await sql.query(`insert into catalog_feed_apartments(property_id,id,external_id,room_label,area_from,price_from,image_url,apartment)
          select $1,id,"externalId","roomLabel",area,price,image,apartment from (${incoming}) x
          on conflict(property_id,id) do update set room_label=excluded.room_label,area_from=excluded.area_from,
          price_from=excluded.price_from,image_url=excluded.image_url,apartment=excluded.apartment,active=true`,[config.propertyId,rows]);
        await sql.query('update catalog_feed_apartments set active=false where property_id=$1 and active and not (id=any($2::text[]))',
          [config.propertyId,snapshot.apartments.map(item=>item.id)]);
        await sql.query('update catalog_feed_state set generation=$2,checked_at=now(),successful_at=now(),error=null,changes=$3 where property_id=$1',
          [config.propertyId,snapshot.generation,JSON.stringify(changes)]);
      }
      return {generation:snapshot.generation,total:snapshot.apartments.length,...changes};
    });
  }catch(error){
    if(apply) await db.query(`insert into catalog_feed_state(property_id,source,error)
      select id,$2,'Не удалось загрузить или проверить фид' from catalog_properties where id=$1
      on conflict(property_id) do update set checked_at=now(),error=excluded.error where catalog_feed_state.source=excluded.source`,scope);
    throw error;
  }
}
