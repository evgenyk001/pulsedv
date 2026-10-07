import {test,expect} from '@playwright/test';
import {businessDay} from '../../packages/pulse-data/business';

for(const width of [320,390,430])test(`Finance mobile ${width}px: header, native dates and large amounts stay inside`,async({page,browserName})=>{
 await page.setViewportSize({width,height:844});
 await page.addInitScript(({day})=>{
  const now=new Date().toISOString();
  localStorage.setItem('pulse.dv.control.leads.v1',JSON.stringify([{id:'58f80f88-bd0f-45e1-b385-73549757791a',name:'Тест мобильных финансов',phone:'+79990000479',source:'test',propertyId:null,comment:null,status:'deal',manager:null,createdAt:now,updatedAt:now,sessionId:'mobile-finance',userId:null,score:0,priority:'cold',scoreReasons:[],topPropertyId:null,city:null,mortgageProgram:null,nextAction:null,finance:{commissionRub:2500000,agentPayoutRub:1000000,expectedPaymentOn:null,receivedOn:day,agentPaidOn:null}}]));
 },{day:businessDay()});
 await page.goto('/pulsedv/control-center/#/analytics');
 const panel=page.getByRole('region',{name:'Финансовый результат'});
 await expect(panel.getByRole('heading',{name:'Финансовый результат'})).toBeVisible();
 await expect(panel.locator('article').first().locator('strong')).toHaveText(/2\s?500\s?000/);
 const bounds=await panel.evaluate(node=>{
  const rect=node.getBoundingClientRect(),button=node.querySelector('.financeHeading button')!.getBoundingClientRect(),description=node.querySelector('.financeHeading p')!.getBoundingClientRect();
  const inputs=[...node.querySelectorAll('input[type="date"]')].map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}});
  const amounts=[...node.querySelectorAll('.metrics strong')].map(el=>{const range=document.createRange();range.selectNodeContents(el);const r=range.getBoundingClientRect(),card=el.closest('article')!.getBoundingClientRect();return {left:r.left,right:r.right,cardLeft:card.left,cardRight:card.right}});
  return {left:rect.left,right:rect.right,buttonTop:button.top,descriptionBottom:description.bottom,inputs,amounts,overflow:document.documentElement.scrollWidth>window.innerWidth+1};
 });
 expect(bounds.overflow).toBe(false);
 expect(bounds.buttonTop).toBeGreaterThanOrEqual(bounds.descriptionBottom+10);
 expect(bounds.inputs[1].top).toBeGreaterThanOrEqual(bounds.inputs[0].bottom+10);
 for(const input of bounds.inputs){expect(input.left).toBeGreaterThanOrEqual(bounds.left-1);expect(input.right).toBeLessThanOrEqual(bounds.right+1)}
 for(const amount of bounds.amounts){expect(amount.left).toBeGreaterThanOrEqual(amount.cardLeft);expect(amount.right).toBeLessThanOrEqual(amount.cardRight)}
 await panel.getByLabel('С',{exact:true}).fill(businessDay());
 await panel.getByRole('button',{name:'Обновить',exact:true}).click();
 await expect(panel.locator('article')).toHaveCount(4);
 await panel.screenshot({path:`test-results/finance-${browserName}-${width}.png`});
});
