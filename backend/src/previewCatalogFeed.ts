import {parseFeedConfig,syncApartmentFeed} from './catalogFeed';
import {readConfig} from './config';
import {postgresDatabase} from './database';

const feeds=parseFeedConfig(process.env.PLAN7_APARTMENT_FEEDS??'[]');
if(!feeds.length)throw new Error('Задайте PLAN7_APARTMENT_FEEDS');
const db=postgresDatabase(readConfig().DATABASE_URL);
try{
  for(const feed of feeds)console.log(feed.propertyId,await syncApartmentFeed(db,feed));
}finally{await db.close();}
