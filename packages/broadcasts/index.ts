export type BroadcastContent={kind:'apartment'|'promotion'|'giveaway'|'news';title:string;body:string;imageUrl:string|null;buttonLabel:string;buttonPath:string};
export type Broadcast=BroadcastContent&{id:string;version:number;status:'draft'|'queued'|'completed'|'cancelled'|'demo';createdAt:string;sentAt:string|null;total:number;sent:number;pending:number;failed:number;skipped:number};
export type BroadcastList={items:Broadcast[];page:number;hasMore:boolean;subscribers:number;telegramReady:boolean;testReady:boolean};
export const broadcastKinds={apartment:'Квартира дня',promotion:'Акция',giveaway:'Розыгрыш',news:'Новость'} as const;
export const broadcastText=(c:BroadcastContent)=>c.title.trim()+'\n\n'+c.body.trim();
export function broadcastError(c:BroadcastContent){
 if(!c.title.trim()||!c.body.trim())return 'Заполните заголовок и текст сообщения';
 if(c.title.length>120||c.body.length>3500)return 'Сократите заголовок до 120, текст до 3500 символов';
 if(c.imageUrl&&broadcastText(c).length>1024)return 'У сообщения с фото может быть до 1024 символов вместе с заголовком';
 if(!c.buttonLabel.trim()||c.buttonLabel.length>40)return 'Укажите название кнопки — до 40 символов';
 if(!validBroadcastPath(c.buttonPath))return 'Выберите раздел приложения или укажите полную HTTPS-ссылку';
 return '';
}
export function validBroadcastPath(path:string){
 if(/^\/(catalog|mortgage|selection|partners|profile)(\?[^#\s]*)?$/.test(path)||/^\/property\/[a-zA-Z0-9_-]{1,100}$/.test(path))return true;
 try{const u=new URL(path);return u.protocol==='https:'&&!u.username&&!u.password&&path.length<=500}catch{return false}
}
export const blankBroadcast=():BroadcastContent=>({kind:'news',title:'',body:'',imageUrl:null,buttonLabel:'Открыть PULSE',buttonPath:'/catalog'});
