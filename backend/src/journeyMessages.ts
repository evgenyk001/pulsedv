import type {Sql} from './database';
import type {Journey,JourneyMessage} from '../../packages/journey/model';
export async function messagePage(sql:Sql,leadId:string,before?:number){
 const rows=(await sql.query('select sequence,document from journey_messages where lead_id=$1 and ($2::bigint is null or sequence<$2) order by sequence desc limit 51',[leadId,before??null])).rows;
 const page=rows.slice(0,50);
 return {messages:page.map(r=>r.document as JourneyMessage).reverse(),messagesBefore:rows.length>50?Number(page.at(-1)!.sequence):null};
}
export async function withMessages(sql:Sql,journey:Journey):Promise<Journey>{return {...journey,...await messagePage(sql,journey.leadId)};}
