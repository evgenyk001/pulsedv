import type {PulseVisitorProfile} from '../../../packages/pulse-data';
export function clientName(profile:PulseVisitorProfile){
 const client=profile.client;
 return [client?.firstName,client?.lastName].filter(Boolean).join(' ').trim()
  ||(client?.username?'@'+client.username:'')||client?.phone
  ||(client?.telegramId?'Клиент Telegram '+client.telegramId:'Посетитель '+profile.sessionId.slice(0,8));
}
export function clientSearch(profile:PulseVisitorProfile){
 const c=profile.client;
 return [profile.sessionId,profile.userId,c?.firstName,c?.lastName,c?.phone,c?.telegramId,c?.username].filter(Boolean).join(' ');
}
