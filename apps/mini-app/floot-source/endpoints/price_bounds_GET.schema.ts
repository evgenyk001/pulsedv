import superjson from "superjson";

export type OutputType={minPriceRub:number;maxPriceRub:number;stepRub:number};

export async function getPriceBounds(init?:RequestInit):Promise<OutputType>{
  const response=await fetch("/_api/price_bounds",{method:"GET",...init});
  if(!response.ok) throw new Error("Не удалось загрузить диапазон цен");
  return superjson.parse<OutputType>(await response.text());
}