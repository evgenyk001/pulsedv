import { api, runtime } from '../../../../packages/pulse-data/runtime';
export type OutputType={provider:'2gis';key:string};
export async function getMapConfig():Promise<OutputType>{
 if(runtime.enabled)return api('/public/map');
 const key=import.meta.env.VITE_2GIS_KEY;
 if(key)return {provider:'2gis',key};
 throw new Error('Карта доступна после подключения сервера и ключа 2ГИС');
}
