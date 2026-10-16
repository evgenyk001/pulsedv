import type {RuntimeConfig} from './config';
import {PARTNER_TERMS_VERSION} from '../../packages/partners/model';

export type DeploymentIssue={level:'error'|'warning';message:string};
/** Configuration checks only: external delivery and DNS must be verified on the target VPS. */
export function deploymentIssues(config:RuntimeConfig):DeploymentIssue[]{
 const issues:DeploymentIssue[]=[];
 const error=(message:string)=>issues.push({level:'error',message});
 if(config.NODE_ENV!=='production')error('NODE_ENV должен быть production');
 const host=new URL(config.PUBLIC_ORIGIN).hostname;
 if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.example.com')||host.endsWith('.test')||host==='example.com')error('Укажите настоящий публичный домен вместо шаблона');
 const password=decodeURIComponent(new URL(config.DATABASE_URL).password);
 if(!/^[A-Za-z0-9_-]{32,}$/.test(password)||/replace|password|example/i.test(password))error('Задайте случайный URL-safe пароль PostgreSQL длиной от 32 символов');
 if(!/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(config.BOT_TOKEN))error('Настройте BOT_TOKEN для входа Telegram, закрепов и уведомлений');
 if(!config.MAP_2GIS_KEY.trim())error('Настройте MAP_2GIS_KEY для рабочей карты');
 if(!config.LEGAL_OPERATOR_NAME||!config.LEGAL_OPERATOR_INN||!config.LEGAL_OPERATOR_ADDRESS||!config.LEGAL_CONTACT_EMAIL)error('Заполните реквизиты оператора и контакт на страницах согласия и политики');
 if(!/^\d{10}(\d{2})?$/.test(config.LEGAL_OPERATOR_INN))error('ИНН оператора должен содержать 10 или 12 цифр');
 if(config.PARTNER_OFFER_PUBLISHED){
  if(config.PARTNER_OFFER_APPROVED_VERSION!==PARTNER_TERMS_VERSION)error('Утверждённая редакция оферты не совпадает с текущей');
  if(!/^\d{13}(\d{2})?$/.test(config.LEGAL_OPERATOR_REGISTRATION))error('Для партнёрской программы укажите ОГРН/ОГРНИП');
 }else issues.push({level:'warning',message:'Партнёрская оферта не опубликована: новые партнёры не смогут принять условия'});
 return issues;
}
