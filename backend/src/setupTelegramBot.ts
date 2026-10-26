import {readConfig} from './config';
import {telegramBotApi} from './telegramBot';
const config=readConfig();
if(!config.BOT_TOKEN)throw Error('BOT_TOKEN is required');
const call=telegramBotApi(config,new AbortController().signal);
try{
 await call('setMyName',{name:'PULSEDV.RU'});
 await call('setMyDescription',{description:'Новостройки Приморья в одном приложении: каталог ЖК, планировки, избранное, сравнение и расчёт ипотеки. Нажмите «Старт», чтобы познакомиться с сервисом.'});
 await call('setMyShortDescription',{short_description:'Новостройки Приморья · подбор квартир · ипотека'});
 await call('setMyCommands',{commands:[{command:'start',description:'Открыть PULSEDV.RU и подключить номер'},{command:'help',description:'Помощь и вход в приложение'}]});
 await call('setChatMenuButton',{menu_button:{type:'web_app',text:'Открыть PULSEDV.RU',web_app:{url:config.PUBLIC_ORIGIN+'/pulsedv/mini-app/'}}});
 console.log('Telegram bot profile and menu configured.');
}catch{console.error('Telegram bot setup failed. Check connectivity and BOT_TOKEN; no secrets were printed.');process.exitCode=1;}
