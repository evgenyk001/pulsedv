export type OutputType={provider:"2gis";key:string};

export async function getMapConfig():Promise<OutputType>{
  throw new Error("Ключ 2ГИС будет подключён через самостоятельный backend PULSE.DV");
}
