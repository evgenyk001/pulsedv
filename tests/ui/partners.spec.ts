import {test,expect,type Page} from '@playwright/test';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
import {businessDay} from '../../packages/pulse-data/business';
import {OFFER_VERSION} from '../../packages/partners/offer';
import {claimExpiresOn} from '../../packages/partners/policy';
async function seed(page:Page,showGuide=false){await page.addInitScript(({state,showGuide})=>{if(!showGuide)localStorage.setItem('pulse.partner.guide.v1','seen');if(!localStorage.getItem('pulse.dv.control.state.v1'))localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion)},{state:DEFAULT_STATE,showGuide})}
// Demo shares catalog/partner fixtures in one browser. Switch the active identity
// while acting as the buyer, then restore the partner to inspect the cabinet.
async function becomeBuyer(page:Page,url:string){const id=await page.evaluate(()=>{const key='pulse.partners.v1',s=JSON.parse(localStorage.getItem(key)!);const id=s.myPartnerId;s.myPartnerId=null;localStorage.setItem(key,JSON.stringify(s));return id});await page.goto(url);await page.reload();return id;}
async function restorePartner(page:Page,id:string){await page.evaluate(id=>{const key='pulse.partners.v1',s=JSON.parse(localStorage.getItem(key)!);s.myPartnerId=id;localStorage.setItem(key,JSON.stringify(s));},id);}
for(const width of [320,390,430])test(`Partners ${width}px: invitation, buyer consent, Control review, progress, exact accrual and payout`,async({page,browserName})=>{
 // This scenario crosses both applications and several dialogs; mobile WebKit needs the whole journey budget.
 test.setTimeout(90000);
 await page.setViewportSize({width,height:844});await seed(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/pulsedv/mini-app/');await expect(page.getByRole('heading',{name:'Стоит посмотреть',exact:true})).toBeVisible();await page.screenshot({path:`test-results/neutral-home-${browserName}-${width}.png`,fullPage:true,animations:'disabled'});
 await page.goto('/pulsedv/mini-app/#/profile');await expect(page.getByRole('link',{name:/Партнёрская программа/})).toBeVisible();await page.screenshot({path:`test-results/menu-profile-${browserName}-${width}.png`,fullPage:true,animations:'disabled'});
 await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));await page.screenshot({path:`test-results/neutral-profile-footer-${browserName}-${width}.png`,animations:'disabled'});await page.getByRole('link',{name:/Партнёрская программа/}).click();
 await expect(page.getByRole('heading',{name:'Рекомендуйте PULSE',exact:true})).toBeVisible();await page.screenshot({path:`test-results/partner-start-${browserName}-${width}.png`,fullPage:true,animations:'disabled'});
 await page.getByRole('textbox',{name:'Ваше имя для приглашения'}).fill('Анна Партнёр');await page.getByRole('textbox',{name:'Ваш контактный телефон'}).fill('+79995550101');await page.getByRole('checkbox',{name:/Принимаю условия программы/}).check();await page.getByRole('button',{name:'Стать партнёром PULSE'}).click();
 await expect(page.getByRole('heading',{name:'Партнёрам',exact:true})).toBeVisible();await expect(page.getByText('Первое знакомство — первый шаг',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Не знаете номер? Отправить ссылку',exact:true}).click();await page.getByRole('button',{name:'Персональное приглашение',exact:true}).click();await page.getByRole('textbox',{name:'Название приглашения'}).fill('Знакомый из Уссурийска');await page.getByRole('button',{name:'Создать приглашение'}).click();
 const invitation=page.getByRole('dialog',{name:'Отправить ссылку покупателю',exact:true});await expect(invitation.getByRole('textbox',{name:'Ваша ссылка'})).toHaveValue(/partner-invite\?code=i/);const buyerLink=await invitation.getByRole('textbox',{name:'Ваша ссылка'}).inputValue();await invitation.getByRole('link',{name:'Посмотреть приглашение'}).click();await expect(page.getByRole('button',{name:'Получить консультацию',exact:true})).toBeDisabled();const partnerIdentity=await becomeBuyer(page,buyerLink);
 await expect(page.getByRole('heading',{name:'Вас пригласил Анна Партнёр'})).toBeVisible();await page.getByRole('link',{name:'Посмотреть квартиры'}).click();
 await page.goto('/pulsedv/mini-app/#/property/'+DEFAULT_STATE.properties[0].id);await page.getByRole('button',{name:'Узнать наличие',exact:true}).click();
 const form=page.getByRole('dialog',{name:'Узнать наличие',exact:true});await expect(form.getByRole('checkbox')).toHaveCount(2);await form.getByRole('textbox',{name:'Как к вам обращаться'}).fill('Иван Покупатель');await form.getByRole('textbox',{name:'Телефон',exact:true}).fill('+79995550202');await form.getByRole('checkbox',{name:/Я даю согласие/}).check();await form.getByRole('checkbox',{name:/Подтверждаю, что меня пригласил/}).check();await form.getByRole('button',{name:'Отправить заявку',exact:true}).click();await expect(page.getByRole('heading',{name:'Обращение создано'})).toBeVisible();await restorePartner(page,partnerIdentity);
 await page.goto('/pulsedv/control-center/#/partners');
 const referralRow=page.locator('.partnersGrid.leadRowButton').filter({hasText:'Иван Покупатель'});await expect(referralRow).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(referralRow.getByText('Кто привёл',{exact:true})).toBeVisible();await expect(referralRow.getByText('Этап покупки',{exact:true})).toBeVisible();
 const rowSurface=await referralRow.evaluate(el=>getComputedStyle(el).backgroundColor);expect(rowSurface).not.toBe('rgb(255, 255, 255)');
 await page.screenshot({path:`test-results/partner-control-list-${browserName}-${width}.png`,fullPage:true,animations:'disabled'});await referralRow.click();
 const review=page.getByRole('dialog',{name:'Партнёрская рекомендация'});await expect(review).toContainText('Партнёр: Анна Партнёр');await expect(review).toContainText('Совпадений в CRM не найдено');await expect(review.getByRole('button',{name:'Закрепить за партнёром'})).toBeDisabled();await review.getByRole('checkbox',{name:/Связались с покупателем/}).check();await review.getByRole('textbox',{name:'Внутренняя заметка проверки'}).fill('Позвонили покупателю. Приглашение подтверждено, совпадений нет.');await review.getByRole('button',{name:'Закрепить за партнёром'}).click();await expect(review.getByRole('button',{name:'Закрепить за партнёром'})).toHaveCount(0);
 await page.screenshot({path:`test-results/partner-control-${browserName}-${width}.png`,fullPage:true,animations:'disabled'});
 await review.getByRole('button',{name:'Управлять сделкой здесь'}).click();const client=review.getByRole('region',{name:'Сделка клиента'});await client.getByRole('combobox',{name:'На каком этапе покупатель'}).selectOption('showing');await client.getByRole('button',{name:'Сохранить сделку'}).click();await expect(client.getByText('Изменения сохранены. Этап обновится и у партнёра.')).toBeVisible();await expect(page).toHaveURL(/#\/partners\?referral=/);await expect(review).toBeVisible();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('pulse.dv.control.leads.v1')!).find((lead:any)=>lead.name==='Иван Покупатель').nextActionManual)).not.toBe(true);await client.getByRole('button',{name:'Чат, подборки и показы'}).click();await expect(client.getByRole('tablist',{name:'Работа с обращением'})).toBeVisible();await expect(page).toHaveURL(/#\/partners\?referral=/);await client.getByRole('button',{name:'Этап и комиссия'}).click();
 await page.goto('/pulsedv/mini-app/#/partners');await page.getByRole('button',{name:/Иван П/}).click();const details=page.getByRole('dialog',{name:'Иван П.'});await expect(details).toContainText('Организуем показ');await expect(details).not.toContainText('+79995550202');await expect(details).not.toContainText('Позвонили покупателю');await page.screenshot({path:`test-results/partner-progress-${browserName}-${width}.png`,animations:'disabled'});await page.keyboard.press('Escape');
 await page.goto('/pulsedv/control-center/#/partners');await referralRow.click();await client.getByRole('combobox',{name:'На каком этапе покупатель'}).selectOption('deal');await client.getByLabel('Комиссия агентству, ₽').fill('100000');await client.getByLabel('Комиссия поступила').fill(businessDay());await client.getByRole('button',{name:'Сохранить сделку'}).click();await expect(client.getByRole('button',{name:'Сохранить сделку'})).toBeDisabled();await expect(page).toHaveURL(/#\/partners\?referral=/);await page.keyboard.press('Escape');
 await page.goto('/pulsedv/control-center/#/partners');await page.locator('.partnersGrid.leadRowButton').filter({hasText:'Иван Покупатель'}).click();await review.getByRole('button',{name:'Проверить комиссию и начислить'}).click();await expect(review).toContainText('28 200');
 await page.goto('/pulsedv/mini-app/#/partners');await expect(page.getByText('28 200 ₽',{exact:true}).first()).toBeVisible();await page.screenshot({path:`test-results/partner-cabinet-${browserName}-${width}.png`,fullPage:true,animations:'disabled'});await page.getByRole('button',{name:/Иван П/}).click();await details.getByRole('combobox',{name:'Статус получателя'}).selectOption('person');const receivingForm=details.getByRole('region',{name:'Получение вознаграждения'});await receivingForm.getByRole('combobox',{name:'Как получить деньги'}).selectOption('sbp');await expect(receivingForm.getByRole('combobox',{name:'Как получить деньги'})).toHaveValue('sbp');await receivingForm.getByLabel('Телефон для перевода по СБП').fill('+79995550101');await receivingForm.getByLabel('Банк получателя').fill('Тестовый банк');await details.getByRole('button',{name:'Запросить оформление выплаты'}).click();await expect(details).toContainText('Партнёр запросил оформление выплаты');
 await page.goto('/pulsedv/control-center/#/partners');await page.locator('.partnersGrid.leadRowButton').filter({hasText:'Иван Покупатель'}).click();const receiving=review.getByRole('region',{name:'Согласование получения вознаграждения'});await expect(review.getByRole('button',{name:'Зафиксировать выплату'})).toBeDisabled();await receiving.getByRole('combobox',{name:'Как получить деньги'}).selectOption('sbp');await receiving.getByLabel('Телефон для перевода по СБП').fill('+79995550101');await receiving.getByLabel('Банк получателя').fill('Тестовый банк');await receiving.getByRole('checkbox',{name:'Согласовали способ получения с партнёром и проверили данные получателя'}).check();await receiving.getByRole('button',{name:'Подтвердить договорённость'}).click();await expect(receiving.getByText('Получение согласовано',{exact:true})).toBeVisible();await review.getByLabel('Удержания из начисления, ₽').fill('3666');await expect(review.getByLabel('Удержания из начисления, ₽')).toHaveValue('3666');await review.getByLabel('Платёжный документ / номер операции').fill('Перевод №001');await review.getByLabel('Договор и подтверждающие документы').fill('Договор №001 / акт');await expect(review.getByLabel('Удержания из начисления, ₽')).toHaveValue('3666');await expect(review.getByText(/К переводу:.*24\s534/)).toBeVisible();await review.getByRole('checkbox',{name:'Документы проверены, перевод выполнен'}).check();await review.getByRole('button',{name:'Зафиксировать выплату'}).click();await expect(review).toContainText('24 534');await expect(review.getByRole('button',{name:'Зафиксировать выплату'})).toHaveCount(0);
 await page.goto('/pulsedv/mini-app/#/partners');await page.getByRole('tab',{name:'Выплаты',exact:true}).click();await expect(page.getByRole('region',{name:'Ваши начисления'}).getByText('24 534 ₽',{exact:true})).toBeVisible();await page.getByRole('button',{name:/Иван П/}).click();await expect(details).toContainText('Выплата подтверждена агентством');await expect(details.getByRole('group',{name:'Путь клиента: Выплата получена',exact:true})).toBeVisible();await expect(details).not.toContainText('Перевод №001');await expect(details).not.toContainText('Договор №001');await page.screenshot({path:`test-results/partner-paid-${browserName}-${width}.png`,animations:'disabled'});await page.keyboard.press('Escape');
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('Buyer can decline referral sharing and normal consultation has no partner',async({page})=>{
 await seed(page);await page.goto('/pulsedv/mini-app/#/partners');await page.getByRole('textbox',{name:'Ваше имя для приглашения'}).fill('Анна');await page.getByRole('textbox',{name:'Ваш контактный телефон'}).fill('+79995550101');await page.getByRole('checkbox',{name:/Принимаю условия программы/}).check();await page.getByRole('button',{name:'Стать партнёром PULSE'}).click();await page.getByRole('button',{name:'Не знаете номер? Отправить ссылку',exact:true}).click();const buyerLink=await page.getByRole('textbox',{name:'Ваша ссылка'}).inputValue();const partnerIdentity=await becomeBuyer(page,buyerLink);await page.getByRole('button',{name:'Получить консультацию',exact:false}).click();
 await page.getByRole('textbox',{name:'Как к вам обращаться'}).fill('Без рекомендации');await page.getByRole('textbox',{name:'Телефон',exact:true}).fill('+79995550303');await page.getByRole('checkbox',{name:/Я даю согласие/}).check();await page.getByRole('button',{name:'Отправить заявку',exact:true}).click();await expect(page.getByRole('heading',{name:'Обращение создано'})).toBeVisible();await restorePartner(page,partnerIdentity);await page.goto('/pulsedv/control-center/#/partners');await expect(page.locator('.partnersGrid.leadRowButton')).toHaveCount(0);await page.goto('/pulsedv/control-center/#/leads');await expect(page.locator('.leadRowButton').filter({hasText:'Без рекомендации'})).toBeVisible();
});

for(const width of [320,390,430])test(`Partner design ${width}px: bright managed banner, left navigation and mobile Control`,async({page,browserName})=>{
 await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'reduce'});await seed(page);
 await page.goto('/pulsedv/mini-app/');
 const campaign=page.getByRole('link',{name:'Зарабатывайте с PULSE',exact:true});await expect(campaign).toBeVisible();
 await expect(campaign).toHaveAttribute('href','#/partners');await expect(campaign.getByText('Стать партнёром',{exact:true})).toBeVisible();
 await expect.poll(()=>campaign.locator('img').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
 const geometry=await campaign.evaluate(el=>{const title=el.querySelector('h1')!.getBoundingClientRect(),article=el.querySelector('article')!.getBoundingClientRect();return{right:title.right,edge:article.right,background:getComputedStyle(el.querySelector('article')!).backgroundColor}});
 expect(geometry.right).toBeLessThan(geometry.edge);expect(geometry.background).toBe('rgb(242, 13, 29)');
 await page.screenshot({path:`test-results/partner-home-${browserName}-${width}.png`,animations:'disabled'});
 await campaign.click();await expect(page.getByRole('heading',{name:'Рекомендуйте PULSE',exact:true})).toBeVisible();
 const back=page.getByRole('link',{name:'Вернуться в профиль',exact:true});const box=await back.boundingBox();expect(box!.x+box!.width).toBeLessThan(width/2);
 await back.click();await expect(page).toHaveURL(/#\/profile$/);
 await page.goto('/pulsedv/control-center/#/content');
 // Find the managed campaign by its persisted title value, which is editable rather than static text.
 const cards=page.locator('.bannerCampaignCard');let campaignIndex=-1;for(let i=0;i<await cards.count();i++)if(await cards.nth(i).getByRole('textbox',{name:'Заголовок',exact:true}).inputValue()==='Зарабатывайте с PULSE')campaignIndex=i;
 expect(campaignIndex).toBeGreaterThanOrEqual(0);const editor=cards.nth(campaignIndex);await expect(editor.getByRole('combobox',{name:'Куда ведёт'})).toHaveValue('/partners');
 await editor.getByRole('checkbox',{name:'Показывать Зарабатывайте с PULSE',exact:true}).uncheck();
 await page.goto('/pulsedv/mini-app/');await expect(page.getByRole('link',{name:'Зарабатывайте с PULSE',exact:true})).toHaveCount(0);
 await page.goto('/pulsedv/control-center/#/partners');await expect(page.getByRole('heading',{name:'Партнёры',exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.locator('.partnersNotice').evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe('rgb(243, 244, 246)');
 await page.screenshot({path:`test-results/partner-control-empty-${browserName}-${width}.png`,fullPage:true,animations:'disabled'});
});
test('Existing demo receives the partner campaign once and preserves later removal',async({page})=>{
 const old={...DEFAULT_STATE,banners:DEFAULT_STATE.banners.filter(b=>b.id!=='partner-program')};
 await page.addInitScript(state=>{if(!localStorage.getItem('pulse.dv.control.state.v1'))localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion)},old);
 await page.goto('/pulsedv/mini-app/');await expect(page.getByRole('link',{name:'Зарабатывайте с PULSE',exact:true})).toBeVisible();
 await page.evaluate(()=>{const key='pulse.dv.control.state.v1',state=JSON.parse(localStorage.getItem(key)!);state.banners=state.banners.filter((b:{id:string})=>b.id!=='partner-program');localStorage.setItem(key,JSON.stringify(state))});
 await page.reload();await expect(page.getByRole('link',{name:'Зарабатывайте с PULSE',exact:true})).toHaveCount(0);
});

for(const width of [320,390])test(`Partner offer ${width}px: full document, public URL, archive and left back button`,async({page,browserName})=>{
 await page.setViewportSize({width,height:844});await seed(page);await page.goto('/pulsedv/mini-app/#/partner-offer');
 await expect(page.getByRole('heading',{name:'Оферта партнёрской программы',exact:true})).toBeVisible();
 await expect(page.getByText('Шаблон публичной оферты',{exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'5. Закрепление на 1 календарный месяц'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'8. Недобросовестные действия и ответственность'})).toBeVisible();
 await expect(page.getByText(/В = К ×/)).toContainText('0,30');
 const back=page.getByRole('link',{name:'Вернуться к партнёрской программе'}),box=await back.boundingBox();expect(box!.x+box!.width).toBeLessThan(width/2);
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/partner-offer-${browserName}-${width}.png`,fullPage:true,animations:'disabled'});
 await back.click();await expect(page).toHaveURL(/#\/partners$/);
 await page.goto('/pulsedv/mini-app/#/partner-offer?version=partners-v1');await expect(page.getByText(/Срок закрепления в этой редакции не установлен/)).toBeVisible();
 await page.goto('/pulsedv/mini-app/#/partner-offer?version=partners-v3-2026-10-16');await expect(page.getByRole('heading',{name:'5. Закрепление на 6 календарных месяцев'})).toBeVisible();
 await page.goto('/pulsedv/partner-offer/');await expect(page.getByRole('heading',{name:'Оферта партнёрской программы',exact:true})).toBeVisible();await expect(page.getByText('Шаблон для подготовки к запуску',{exact:true})).toBeVisible();await expect(page.locator('body')).toHaveAttribute('data-version','partners-v4-2026-10-18');
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('Partner cabinet refreshes by standard action and return, without pull or polling',async({page})=>{
 await seed(page);await page.goto('/pulsedv/mini-app/#/partners');await page.getByRole('textbox',{name:'Ваше имя для приглашения'}).fill('Анна');await page.getByRole('textbox',{name:'Ваш контактный телефон'}).fill('+79995550101');await page.getByRole('checkbox',{name:/Принимаю условия программы/}).check();await page.getByRole('button',{name:'Стать партнёром PULSE'}).click();
 const invite=page.getByRole('button',{name:'Не знаете номер? Отправить ссылку',exact:true});await expect(invite).toBeEnabled();await page.clock.install();
 await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('pulse.partners.v1')!);s.partners[0].status='paused';localStorage.setItem('pulse.partners.v1',JSON.stringify(s))});
 await page.clock.runFor(35000);await expect(invite).toBeEnabled();await expect(page.getByText(/Новые приглашения временно недоступны/)).toHaveCount(0);
 await expect(page.locator('[data-refreshing]')).toHaveCount(0);await expect(page.getByText(/потяните вниз для обновления|Обновлено/)).toHaveCount(0);await page.getByRole('button',{name:'Обновить рекомендации'}).click();
 await expect(page.getByText(/Новые приглашения временно недоступны/)).toBeVisible();await expect(invite).toBeDisabled();
 await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('pulse.partners.v1')!);s.partners[0].status='active';localStorage.setItem('pulse.partners.v1',JSON.stringify(s));window.dispatchEvent(new Event('focus'))});
 await expect(invite).toBeEnabled();await expect(page.getByText(/Новые приглашения временно недоступны/)).toHaveCount(0);
});

test('Existing partner reads the archive and explicitly accepts the new offer before inviting again',async({page})=>{
 await seed(page);await page.addInitScript(()=>{if(localStorage.getItem('pulse.partners.v1'))return;localStorage.setItem('pulse.partners.v1',JSON.stringify({myPartnerId:'old-partner',partners:[{id:'old-partner',userId:null,name:'Анна',phone:'+79995550101',code:'p01234567890123456789',status:'active',termsVersion:'partners-v1',createdAt:new Date().toISOString()}],invitations:[],referrals:[],rewards:[]}))});
 await page.goto('/pulsedv/mini-app/#/partners');const invite=page.getByRole('button',{name:'Не знаете номер? Отправить ссылку',exact:true});await expect(invite).toBeDisabled();
 await expect(page.getByRole('button',{name:'Принять новую редакцию'})).toHaveCount(0);
 await page.getByRole('link',{name:'Оферта и принятая редакция'}).click();await expect(page.getByText(/Срок закрепления в этой редакции не установлен/)).toBeVisible();await page.getByRole('link',{name:'Вернуться к партнёрской программе'}).click();
 await page.getByRole('button',{name:'Ознакомиться',exact:true}).click();const accept=page.getByRole('button',{name:'Принять новую редакцию'});await expect(accept).toBeDisabled();await page.getByRole('checkbox',{name:'Принимаю новую редакцию условий программы'}).check();await accept.click();await expect(invite).toBeEnabled();await expect(accept).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('pulse.partners.v1')!).partners[0].termsVersion)).toBe('partners-v4-2026-10-18');
});

test('Control keeps the first numeric and receiving edits when the payout drawer opens repeatedly',async({page})=>{
 test.setTimeout(90000);
 await page.setViewportSize({width:320,height:844});await seed(page);await page.addInitScript(()=>{const now=new Date().toISOString();localStorage.setItem('pulse.partners.v1',JSON.stringify({myPartnerId:'partner',partners:[{id:'partner',name:'Анна',phone:'+79995550101',code:'p01234567890123456789',status:'active',termsVersion:'partners-v3-2026-10-16',createdAt:now}],invitations:[],referrals:[{id:'referral',partnerId:'partner',partnerName:'Анна',leadId:null,invitationId:null,clientName:'Иван Покупатель',termsVersion:'partners-v3-2026-10-16',status:'accepted',stage:'deal',stageLabel:'Сделка',conflict:false,rejectionReason:null,revision:2,createdAt:now,acceptedAt:now,events:[],phone:'+79995550202'}],rewards:[{id:'reward',referralId:'referral',commissionRub:100000,reserveMinor:600000,baseMinor:9400000,grossMinor:2820000,status:'requested',recipientType:'person',requestedAt:now,paidOn:null,withheldMinor:0,paidMinor:0,revision:2,createdAt:now}]}))});
 await page.goto('/pulsedv/control-center/#/partners');const row=page.locator('.partnersGrid.leadRowButton').filter({hasText:'Иван Покупатель'}),drawer=page.getByRole('dialog',{name:'Партнёрская рекомендация'});
 for(let i=0;i<12;i++){await row.click();const method=drawer.getByRole('combobox',{name:'Как получить деньги'});await method.selectOption('sbp');await expect(method).toHaveValue('sbp');await expect(drawer.getByLabel('Телефон для перевода по СБП')).toBeVisible();await method.selectOption('contact');const field=drawer.getByLabel('Удержания из начисления, ₽');await field.fill(String(1000+i));await expect(field).toHaveValue(String(1000+i));await drawer.getByLabel('Платёжный документ / номер операции').fill('Перевод');await expect(field).toHaveValue(String(1000+i));await page.keyboard.press('Escape');await expect(drawer).toHaveCount(0)}
});

for(const width of [320,390,430])test(`Partner cabinet ${width}px: shared tabs, compact rule notice and explicit sheet consent`,async({page,browserName})=>{
 await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'reduce'});await seed(page);
 await page.addInitScript(()=>{if(localStorage.getItem('pulse.partners.v1'))return;localStorage.setItem('pulse.partners.v1',JSON.stringify({myPartnerId:'partner',partners:[{id:'partner',name:'Анна',phone:'+79995550101',code:'p01234567890123456789',status:'active',termsVersion:'partners-v1',createdAt:new Date().toISOString()}],invitations:[],referrals:[],rewards:[]}))});
 await page.goto('/pulsedv/mini-app/#/partners');const summary=page.getByRole('region',{name:'Сводка вознаграждения'});await expect(summary).toContainText('0 ₽');
 const box=await summary.boundingBox();expect(box!.height).toBeLessThan(330);
 await expect(page.getByRole('tablist',{name:'Разделы партнёрского кабинета'})).toBeVisible();await expect(page.getByRole('checkbox',{name:'Принимаю новую редакцию условий программы'})).toHaveCount(0);
 await expect(page.getByText(/потяните вниз для обновления|Обновлено/)).toHaveCount(0);await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/partner-cabinet-rules-${browserName}-${width}.png`,animations:'disabled'});
 await page.getByRole('button',{name:'Ознакомиться',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Обновлённые условия'});await expect(dialog).toBeVisible();await expect(dialog.getByRole('button',{name:'Принять новую редакцию'})).toBeDisabled();
 await dialog.getByRole('checkbox',{name:'Принимаю новую редакцию условий программы'}).check();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 await page.getByRole('button',{name:'Ознакомиться',exact:true}).click();await expect(dialog.getByRole('checkbox',{name:'Принимаю новую редакцию условий программы'})).not.toBeChecked();
 await dialog.getByRole('checkbox',{name:'Принимаю новую редакцию условий программы'}).check();await page.screenshot({path:`test-results/partner-cabinet-accept-${browserName}-${width}.png`,animations:'disabled'});await dialog.getByRole('button',{name:'Принять новую редакцию'}).click();await expect(dialog).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Не знаете номер? Отправить ссылку',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:'Ознакомиться',exact:true})).toHaveCount(0);
 await page.screenshot({path:`test-results/partner-cabinet-ready-${browserName}-${width}.png`,animations:'disabled'});
 await page.getByRole('tab',{name:'Мои клиенты',exact:true}).focus();await page.keyboard.press('End');await expect(page.getByRole('tab',{name:'Выплаты',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.getByText('Начислений пока нет',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Посмотреть пример',exact:true}).click();await expect(page.getByRole('dialog',{name:'Как считается вознаграждение'})).toContainText('28 200 ₽');await page.keyboard.press('Escape');
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('Expired claim explains late commission eligibility without promising a new claim',async({page})=>{
 await seed(page);await page.addInitScript(()=>{const now=new Date().toISOString();localStorage.setItem('pulse.partners.v1',JSON.stringify({myPartnerId:'partner',partners:[{id:'partner',name:'Анна',phone:'+79995550101',code:'p01234567890123456789',status:'active',termsVersion:'partners-v3-2026-10-16',createdAt:now}],invitations:[],referrals:[{id:'expired',partnerId:'partner',partnerName:'Анна',leadId:null,invitationId:null,clientName:'Иван Покупатель',termsVersion:'partners-v3-2026-10-16',status:'accepted',stage:'booking',claimStartedOn:'2000-01-01',claimExpiresOn:'2000-07-01',conflict:false,rejectionReason:null,revision:2,createdAt:now,acceptedAt:now,events:[],phone:'+79995550202'}],rewards:[]}))});
 await page.goto('/pulsedv/mini-app/#/partners');const expiredRow=page.getByRole('button',{name:/Иван П/});await expect(expiredRow).toContainText('Срок закрепа истёк');await expect(expiredRow).not.toContainText('Клиент закреплён');await expiredRow.click();const dialog=page.getByRole('dialog',{name:'Иван П.'});await expect(dialog).toContainText('Срок закрепления завершён');await expect(dialog).toContainText('Если покупка состоялась в срок');await expect(dialog).not.toContainText('Клиент закреплён за вами');await expect(dialog).not.toContainText('+79995550202');
});

for(const width of [320,390,430])test(`Partner guide ${width}px: first visit, repeat help, one starting action and no implied consent`,async({page,browserName})=>{
 await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'reduce'});await seed(page,true);
 await page.goto('/pulsedv/mini-app/#/partners');
 const guide=page.getByRole('dialog',{name:'Как привести клиента и получить выплату',exact:true});
 await expect(guide).toBeVisible();await expect(guide).toContainText('1 календарный месяц');await expect(guide).toContainText('7 дней');await expect(guide).toContainText('тот же номер');
 await expect(guide.getByRole('checkbox')).toHaveCount(0);
 const guideAction=await guide.getByRole('button',{name:'Понятно, начнём',exact:true}).boundingBox();expect(guideAction!.y+guideAction!.height).toBeLessThan(844);
 await page.screenshot({path:`test-results/partner-guide-${browserName}-${width}.png`,animations:'disabled'});
 await guide.getByRole('button',{name:'Понятно, начнём',exact:true}).click();await expect(guide).toHaveCount(0);await expect(page.getByRole('checkbox',{name:/Принимаю условия программы/})).not.toBeChecked();
 await page.reload();await expect(guide).toHaveCount(0);await page.getByRole('button',{name:'Как закрепить клиента и получить выплату',exact:true}).click();await expect(guide).toBeVisible();await page.keyboard.press('Escape');
 await page.getByRole('textbox',{name:'Ваше имя для приглашения'}).fill('Анна');await page.getByRole('textbox',{name:'Ваш контактный телефон'}).fill('+79995550101');await page.getByRole('checkbox',{name:/Принимаю условия программы/}).check();await page.getByRole('button',{name:'Стать партнёром PULSE'}).click();
 await expect(page.getByRole('button',{name:'Добавить клиента',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:'Персональное приглашение',exact:true})).toHaveCount(0);
 await page.screenshot({path:`test-results/partner-clear-start-${browserName}-${width}.png`,fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'Добавить клиента',exact:true}).click();const form=page.getByRole('dialog',{name:'Добавить клиента',exact:true});await expect(form).toContainText('Шаг 1 из 2');await expect(form.getByRole('checkbox')).not.toBeChecked();await expect(form.getByRole('button',{name:'Проверить номер',exact:true})).toBeDisabled();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

for(const width of [320,390,430])test(`Partner compact cabinet ${width}px: income, main action and real client states above the fold`,async({page,browserName})=>{
 await page.setViewportSize({width,height:740});await page.emulateMedia({reducedMotion:'reduce'});await seed(page);
 await page.addInitScript(({version,day,end})=>{
  const now=new Date().toISOString();
  const referral=(id:string,clientName:string,status:string)=>({id,partnerId:'partner',partnerName:'Анна',leadId:null,invitationId:null,clientName,termsVersion:version,status,stage:'showing',stageLabel:'Организуем показ',claimStartedOn:day,claimExpiresOn:end,conflict:false,rejectionReason:null,revision:2,createdAt:now,acceptedAt:status==='accepted'?now:null,events:[]});
  localStorage.setItem('pulse.partners.v1',JSON.stringify({myPartnerId:'partner',partners:[{id:'partner',name:'Анна',phone:'+79995550101',code:'p01234567890123456789',status:'active',termsVersion:version,createdAt:now}],invitations:[],referrals:[referral('accepted','Иван Покупатель','accepted'),referral('pending','Ольга Покупатель','pending'),{...referral('expired','Пётр Покупатель','accepted'),claimStartedOn:'2000-01-01',claimExpiresOn:'2000-02-01'}],rewards:[{id:'reward',referralId:'accepted',commissionRub:100000,reserveMinor:600000,baseMinor:9400000,grossMinor:2820000,status:'accrued',recipientType:null,requestedAt:null,paidOn:null,withheldMinor:0,paidMinor:0,revision:1,createdAt:now}]}));
 },{version:OFFER_VERSION,day:businessDay(),end:claimExpiresOn(businessDay())});
 await page.goto('/pulsedv/mini-app/#/partners');const wallet=page.getByRole('region',{name:'Сводка вознаграждения'});await expect(wallet).toContainText('28 200 ₽');
 const add=page.getByRole('button',{name:'Добавить клиента',exact:true});await expect(add).toBeEnabled();await expect(wallet.getByRole('button',{name:'Добавить клиента',exact:true})).toBeVisible();
 const actionBox=await add.boundingBox(),walletBox=await wallet.boundingBox(),listBox=await page.getByRole('region',{name:'Ваши рекомендации'}).boundingBox();expect(actionBox!.y+actionBox!.height).toBeLessThan(360);expect(walletBox!.height).toBeLessThan(330);expect(listBox!.y).toBeLessThan(530);
 await expect(page.getByRole('heading',{level:1})).toHaveCount(1);await expect(page.getByRole('heading',{level:1})).toHaveText('Партнёрам');await expect(page.getByText('Есть знакомый, который ищет квартиру?',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:/Ольга П\./})).toContainText('На проверке');await expect(page.getByRole('button',{name:/Ольга П\./}).getByRole('group',{name:'Путь клиента: Путь приостановлен',exact:true})).toBeVisible();const expired=page.getByRole('button',{name:/Пётр П\./});await expect(expired).toContainText('Срок закрепа истёк');await expect(expired).not.toContainText('Клиент закреплён');
 const help=page.getByRole('button',{name:'Как закрепить клиента и получить выплату',exact:true}),helpBox=await help.boundingBox();expect(helpBox!.width).toBeGreaterThanOrEqual(40);expect(helpBox!.y).toBeLessThan(70);
 await page.screenshot({path:`test-results/partner-compact-${browserName}-${width}.png`,animations:'disabled'});
 const art=wallet.locator('img');await expect.poll(()=>art.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
 const overlap=await wallet.evaluate(el=>{const art=el.querySelector('img')!.getBoundingClientRect(),pitch=el.querySelector('strong')!.getBoundingClientRect();return art.left<pitch.right});expect(overlap).toBe(false);
 await expect(page.getByRole('button',{name:/Иван П\./}).getByRole('group',{name:'Путь клиента: Выплата',exact:true})).toBeVisible();await expect(expired.getByRole('group',{name:'Путь клиента: Путь приостановлен',exact:true})).toBeVisible();
 await wallet.getByRole('button',{name:'Посчитать доход',exact:true}).click();await expect(page.getByRole('dialog',{name:'Как считается вознаграждение',exact:true})).toContainText('28 200 ₽');await page.keyboard.press('Escape');
 await help.click();await expect(page.getByRole('dialog',{name:'Как привести клиента и получить выплату',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(add).toBeEnabled();
 await page.getByRole('tab',{name:'Выплаты',exact:true}).click();await expect(page.getByRole('region',{name:'Ваши начисления'})).toContainText('28 200 ₽');
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

for(const width of [320,390])test(`Partner income explorer ${width}px: examples are interactive and never change real earnings`,async({page,browserName})=>{
 await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'reduce'});await seed(page);await page.goto('/pulsedv/mini-app/#/partners');
 await page.getByRole('textbox',{name:'Ваше имя для приглашения'}).fill('Анна');await page.getByRole('textbox',{name:'Ваш контактный телефон'}).fill('+79995550101');await page.getByRole('checkbox',{name:/Принимаю условия программы/}).check();await page.getByRole('button',{name:'Стать партнёром PULSE'}).click();
 const wallet=page.getByRole('region',{name:'Сводка вознаграждения'});await expect(wallet).toContainText('0 ₽');await wallet.getByRole('button',{name:'Посчитать доход'}).click();
 const calculator=page.getByRole('dialog',{name:'Как считается вознаграждение'}),result=calculator.getByRole('status',{name:'Вознаграждение в примере'});
 await expect(result).toHaveText('28 200 ₽');await expect(calculator).toContainText('Это пример, а не начисление на ваш счёт');
 await calculator.getByRole('button',{name:'200 000 ₽',exact:true}).click();await expect(result).toHaveText('56 400 ₽');await expect(calculator).toContainText('188 000 ₽');
 const slider=calculator.getByRole('slider',{name:'Комиссия агентства'});await slider.focus();await slider.press('Home');await expect(result).toHaveText('14 100 ₽');await slider.press('End');await expect(result).toHaveText('141 000 ₽');await slider.press('ArrowLeft');await expect(result).toHaveText('139 590 ₽');
 await calculator.getByRole('button',{name:'300 000 ₽',exact:true}).click();await expect(result).toHaveText('84 600 ₽');await expect(calculator.getByRole('button',{name:'300 000 ₽',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.screenshot({path:`test-results/partner-calculator-${browserName}-${width}.png`,animations:'disabled'});await page.keyboard.press('Escape');await expect(wallet).toContainText('0 ₽');await expect(wallet).not.toContainText('84 600 ₽');
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
