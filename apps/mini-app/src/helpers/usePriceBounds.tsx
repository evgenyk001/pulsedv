import { useCatalogMeta } from './useCatalog';
export function usePriceBounds(){
 const {data,isLoading,error}=useCatalogMeta();
 return {data:data?{minPriceRub:data.minPriceRub,maxPriceRub:data.maxPriceRub,stepRub:data.stepRub}:undefined,isLoading,error};
}
