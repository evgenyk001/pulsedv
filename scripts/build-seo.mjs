import {readFile, writeFile, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

// One public origin. GitHub Pages is a preview, not a second search-facing site.
export const origin = 'https://pulsedv.ru';

const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json = value => JSON.stringify(value).replace(/</g,'\\u003c');
const areas = ['Приморский край','Владивосток','Артём','Уссурийск'].map(name=>({'@type':'Place',name}));
function schema(title,description){
 const url = origin+'/';
 const graph=[{'@type':'Organization','@id':origin+'/#organization',name:'PULSE.DV',url:origin+'/',logo:origin+'/assets/pulse-mark-180-v2.png',description:'Агентство недвижимости и сервис подбора жилья в Приморском крае',areaServed:areas,sameAs:['https://www.instagram.com/pulse.dv/']},
 {'@type':'WebSite','@id':origin+'/#website',url:origin+'/',name:'PULSE.DV',inLanguage:'ru-RU',publisher:{'@id':origin+'/#organization'}},
 {'@type':'WebPage','@id':url+'#webpage',url,name:title,description,inLanguage:'ru-RU',isPartOf:{'@id':origin+'/#website'},about:{'@id':origin+'/#organization'}}];
 return {'@context':'https://schema.org','@graph':graph};
}
function metadata(title,description,preview){
 const url=origin+'/';
 return `<!-- PULSE SEO start -->
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="${preview?'noindex,follow':'index,follow,max-image-preview:large'}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="ru_RU">
  <meta property="og:site_name" content="PULSE.DV">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${origin}/assets/pulse-phones-v2.webp">
  <meta property="og:image:width" content="1254">
  <meta property="og:image:height" content="1254">
  <meta property="og:image:alt" content="Приложение PULSE.DV для выбора новостроек Приморья">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${json(schema(title,description))}</script>
  <!-- PULSE SEO end -->`;
}
export async function buildSeo({directory=new URL('../dist/',import.meta.url),preview=false}={}){
 const root = directory instanceof URL?fileURLToPath(directory):directory;
 const file=root+'/index.html';
 let home=await readFile(file,'utf8');
 if(!/<head>[\s\S]*?<\/head>/.test(home))throw new Error('Landing head is missing');
 home=home.replace(/<head>([\s\S]*?)<\/head>/,(_,head)=>{
  const clean=head.replace(/\s*<!-- PULSE SEO start -->[\s\S]*?<!-- PULSE SEO end -->/g,'').replace(/\s*<title>[\s\S]*?<\/title>/g,'').replace(/\s*<meta name="description"[^>]*>/g,'');
  return '<head>'+clean+metadata('PULSE.DV — новостройки и ипотека в Приморском крае','Агентство недвижимости PULSE.DV: подбор новостроек во Владивостоке, Артёме и Уссурийске. Сравнивайте ЖК, сохраняйте квартиры и рассчитывайте ипотеку в приложении.',preview)+'\n</head>';
 });
 await writeFile(file,home);
 const urls=['/'];
 if(preview)await rm(root+'/sitemap.xml',{force:true});
 else await writeFile(root+'/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(path=>`  <url><loc>${origin}${path}</loc></url>`).join('\n')}\n</urlset>\n`);
 await writeFile(root+'/robots.txt',`User-agent: *\nDisallow: /api/\nDisallow: /media/\nDisallow: /mini-app/\nDisallow: /control-center/\nDisallow: /pulsedv/mini-app/\nDisallow: /pulsedv/control-center/\n${preview?'':'Sitemap: '+origin+'/sitemap.xml\n'}`);
}
if(process.argv[1]===fileURLToPath(import.meta.url))await buildSeo({preview:process.argv.includes('--preview')});
