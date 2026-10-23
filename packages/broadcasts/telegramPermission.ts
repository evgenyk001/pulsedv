type WriteAccessApp={initDataUnsafe?:{user?:{allows_write_to_pm?:boolean}};isVersionAtLeast?:(version:string)=>boolean;requestWriteAccess?:(callback:(allowed:boolean)=>void)=>void};
/** Called only after the person explicitly enables announcements. Never on page load. */
export async function ensureAnnouncementWriteAccess(app:WriteAccessApp|undefined,timeoutMs=30000){
 if(app?.initDataUnsafe?.user?.allows_write_to_pm)return;
 if(!app?.requestWriteAccess||app.isVersionAtLeast?.('6.9')===false)throw Error('Откройте PULSE в обновлённом Telegram, чтобы разрешить сообщения от бота');
 return new Promise<void>((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Telegram не подтвердил разрешение. Попробуйте включить анонсы ещё раз')),timeoutMs);
  try{app.requestWriteAccess!(allowed=>{clearTimeout(timer);allowed?resolve():reject(Error('Анонсы не включены. Для получения сообщений разрешите боту писать вам'))})}
  catch{clearTimeout(timer);reject(Error('Не удалось запросить разрешение Telegram. Обновите Telegram и попробуйте ещё раз'))}
 });
}
