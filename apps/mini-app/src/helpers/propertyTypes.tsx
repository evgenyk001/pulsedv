export type PropertyStatus="draft"|"published"|"archived";

export type PropertyImage={
  id?:string;
  url:string;
  alt:string;
  sortOrder:number;
};

export type PropertyFeature={
  id?:string;
  label:string;
  icon:string;
  sortOrder:number;
};

export type PropertyFloorplan={
  id?:string;
  roomLabel:string;
  areaFrom:number|null;
  areaTo:number|null;
  priceFrom:number|null;
  imageUrl:string|null;
  sortOrder:number;
};

export type PropertyDocument={
  id?:string;
  kind:"presentation"|"document";
  name:string;
  url:string;
  mimeType:string|null;
  sizeBytes:number|null;
  sortOrder:number;
};

export type PropertyRecord={
  id:string;
  name:string;
  city:string;
  district:string;
  address:string|null;
  latitude:number|null;
  longitude:number|null;
  priceFrom:number;
  delivery:string;
  className:string;
  status:PropertyStatus;
  description:string;
  developerName:string;
  tags:string[];
  coverImageUrl:string|null;
  sortOrder:number;
  images:PropertyImage[];
  features:PropertyFeature[];
  floorplans:PropertyFloorplan[];
  documents?:PropertyDocument[];
};