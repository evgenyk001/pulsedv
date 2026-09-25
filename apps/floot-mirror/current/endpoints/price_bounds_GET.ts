import superjson from "superjson";
import { db } from "../helpers/db";
import type { OutputType } from "./price_bounds_GET.schema";

const STEP=100_000;
const FALLBACK_MIN=4_000_000;
const FALLBACK_MAX=25_000_000;

export async function handle(){
  try{
    const unitRows=await db.selectFrom("units")
      .innerJoin("properties","units.propertyId","properties.id")
      .select(["units.price"])
      .where("properties.status","=","published")
      .where("units.status","not in",["archived","sold"])
      .where("units.price","is not",null)
      .execute();

    const unitPrices=unitRows
      .map(row=>row.price==null?NaN:Number(row.price))
      .filter(price=>Number.isFinite(price)&&price>0);

    let prices=unitPrices;
    if(prices.length===0){
      const propertyRows=await db.selectFrom("properties")
        .select(["priceFrom"])
        .where("status","=","published")
        .execute();
      prices=propertyRows.map(row=>Number(row.priceFrom)*1_000_000).filter(price=>Number.isFinite(price)&&price>0);
    }

    const rawMin=prices.length?Math.min(...prices):FALLBACK_MIN;
    const rawMax=prices.length?Math.max(...prices):FALLBACK_MAX;
    const minPriceRub=Math.floor(rawMin/STEP)*STEP;
    const maxPriceRub=Math.max(minPriceRub+STEP,Math.ceil(rawMax/STEP)*STEP);
    const payload:OutputType={minPriceRub,maxPriceRub,stepRub:STEP};

    return new Response(superjson.stringify(payload),{headers:{"Content-Type":"application/json"}});
  }catch(error){
    console.error("Price bounds load error",error);
    const payload:OutputType={minPriceRub:FALLBACK_MIN,maxPriceRub:FALLBACK_MAX,stepRub:STEP};
    return new Response(superjson.stringify(payload),{headers:{"Content-Type":"application/json"}});
  }
}