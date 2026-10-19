export type MapConfig={provider:'yandex'|'2gis';key:string};

/** Browser map keys are public; restrict them to the application's domains. */
export function configuredMap(keys:{yandex?:string;twoGis?:string}):MapConfig|null{
 const yandex=keys.yandex?.trim(),twoGis=keys.twoGis?.trim();
 if(yandex)return {provider:'yandex',key:yandex};
 if(twoGis)return {provider:'2gis',key:twoGis};
 return null;
}
