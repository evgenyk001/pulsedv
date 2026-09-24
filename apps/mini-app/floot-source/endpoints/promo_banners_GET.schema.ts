import superjson from "superjson";

export type PromoBanner={
  id:string;
  imageUrl:string|null;
  title:string;
  body:string;
  ctaLabel:string|null;
  actionUrl:string|null;
  audience:string;
  city:string|null;
};

export type OutputType={banners:PromoBanner[]};

export async function getPromoBanners(init?:RequestInit):Promise<OutputType>{
  const response=await fetch("/_api/promo_banners",{method:"GET",...init});
  if(!response.ok) throw new Error("Не удалось загрузить баннеры");
  return superjson.parse<OutputType>(await response.text());
}