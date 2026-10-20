import type {PartnerReferral} from './model';
export function partnerNextAction(r:PartnerReferral){
 if(r.status==='rejected')return {title:'Рекомендация не принята',detail:'Причина и история сохранены в карточке.',anchor:'partner-history'};
 if(r.reward?.status==='paid')return {title:'Выплата завершена',detail:'Сумма, дата и подтверждение сохранены. Все действия доступны в истории.',anchor:'partner-history'};
 if(r.status==='pending'||r.antifraud&&!r.antifraud.reviewed)return {title:r.conflict?'Разберите совпадения и подтвердите клиента':'Проверьте рекомендацию',detail:'Свяжитесь с покупателем, проверьте совпадения и запишите результат.',anchor:'partner-review'};
 if(r.reward&&r.reward.status!=='void')return r.reward.payoutStage==='agreed'?{title:'Выплатите деньги и сохраните подтверждение',detail:'Получение согласовано. Отмечайте выплату после реального перевода или выдачи наличных.',anchor:'partner-payment'}:{title:'Согласуйте получение с партнёром',detail:'Позвоните партнёру или попросите его заполнить данные. Затем подтвердите договорённость.',anchor:'partner-receiving'};
 if(r.stage==='lost')return {title:'Покупка не состоялась',detail:'Уточните причину. Вознаграждение без состоявшейся покупки не начисляется.',anchor:'partner-deal'};
 if(['deal','closed'].includes(r.stage))return {title:'Проверьте поступление комиссии и начислите вознаграждение',detail:'Сохраните сумму и фактическую дату поступления комиссии, затем подтвердите начисление.',anchor:'partner-accrual'};
 return {title:'Продолжайте вести покупателя',detail:'Обновляйте этап, готовьте подборки, согласуйте показы и записывайте следующий шаг здесь.',anchor:'partner-deal'};
}
