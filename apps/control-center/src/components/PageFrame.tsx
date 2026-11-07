import {ScreenSections} from './ScreenSections';
import React, {type ReactNode} from 'react';
import {CircleHelp,X} from 'lucide-react';
import {useLocation} from 'react-router-dom';
const guides:Record<string,{title:string;text:string}>={
 '/':{title:'С чего начать рабочий день',text:'Откройте просроченные задачи, проверьте новых клиентов и назначьте ответственных. Период на графике меняет только график. Карточки сверху ведут в соответствующие списки.'},
 '/objects':{title:'Как работать с объектами',text:'Выберите город и откройте ЖК. Вкладки в карточке разделяют основные данные, корпуса, планировки, фото и документы. Все правки в этих вкладках сохраняются одной кнопкой «Сохранить объект». Черновик не публикуется в каталоге.'},
 '/leads':{title:'Работа с клиентом',text:'Строка открывает быстрый просмотр. Нажмите «Открыть полную карточку», назначьте ответственного и укажите следующий шаг. Переписка, подборки и показы находятся в отдельной вкладке. Поля карточки сохраняются кнопкой внизу. Сообщения и действия в переписке выполняются своими кнопками.'},
 '/users':{title:'Почему числа могут различаться',text:'Подтверждённые аккаунты — клиенты, предоставившие номер. Посетители и интерес — история технических сессий. Один человек может иметь несколько сессий. Наличие истории само по себе не подтверждает передачу номера.'},
 '/tasks':{title:'Управление задачами',text:'Сначала разберите просроченные задачи. Этап меняется прямо в карточке и сохраняется сразу. «Список» удобен на телефоне, «Доска» показывает распределение работы по этапам.'},
 '/analytics':{title:'Как читать показатели',text:'Визиты, сессии, заявки и аккаунты — разные единицы. У блоков могут отличаться период и охват: они подписаны рядом. Загруженная выборка может быть меньше серверной сводки. Процент сессий с заявкой не равен конверсии всех посетителей в покупателей.'},
 '/content':{title:'Изменение контента',text:'Отредактируйте нужный баннер или раздел. Несохранённые настройки отмечаются в верхней панели. Перед сохранением проверьте подписи, порядок, изображения и назначение кнопок.'},
 '/giveaway':{title:'Участники и подтверждение',text:'Заявка показывает интерес к акции. Номер участника выдаётся после подтверждения сделки в соответствии с опубликованными правилами. Проверяйте сделку и получателя перед подтверждением.'},
 '/broadcasts':{title:'Перед отправкой рассылки',text:'Сначала сохраните черновик и проверьте предпросмотр, изображение, текст и адрес кнопки. Отправка — отдельное действие. Число подписчиков не равно числу зарегистрированных клиентов.'},
};
function PageHelp({description}:{description:string}){
 const {pathname}=useLocation();const [open,setOpen]=React.useState(false);const host=React.useRef<HTMLDivElement>(null),trigger=React.useRef<HTMLButtonElement>(null);const id=React.useId();const guide=guides[pathname]||{title:'Работа с разделом',text:description+' Поля с пояснениями раскрывают дополнительные параметры. Сохранение и немедленные действия имеют отдельные кнопки.'};
 React.useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!host.current?.contains(e.target as Node))setOpen(false)};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();setOpen(false);trigger.current?.focus()}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key)}},[open]);
 return <div className="pageHelp" ref={host}><button type="button" ref={trigger} aria-label="Как работать с разделом" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(!open)}><CircleHelp size={17}/></button>{open&&<aside className="pageHelpPanel" id={id} aria-label="Подсказка по разделу"><strong>{guide.title}</strong><p>{guide.text}</p><button type="button" className="secondaryAction" onClick={()=>{setOpen(false);trigger.current?.focus()}}><X size={14}/>Понятно</button></aside>}</div>;
}
export function PageFrame({eyebrow,title,description,action,children,className}:{eyebrow:string;title:string;description:string;action?:ReactNode;children:ReactNode;className?:string}){
 const screen=useLocation().pathname;const flow=React.useRef<HTMLDivElement>(null);
 return <div className={['page','screen-'+screen.split('/')[1],className].filter(Boolean).join(' ')}><header className="pageHeader"><div className="pageHeading"><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div><div className="pageAction">{action}<PageHelp description={description}/></div></header><ScreenSections flow={flow} screen={screen}/><div className="pageFlow" ref={flow}>{children}</div></div>;
}
export function EmptyState({title,text}:{title:string;text:string}){return <div className="emptyState"><strong>{title}</strong><span>{text}</span></div>}
