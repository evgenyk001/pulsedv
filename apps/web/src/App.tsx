import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  Heart,
  Instagram,
  MapPin,
  Search,
  Send,
  Sparkles,
  X
} from "lucide-react";

type Lead = {
  city: string;
  budget: string;
  downPayment: string;
  purchase: string;
  rooms: string;
  name: string;
  phone: string;
};

const INITIAL_LEAD: Lead = {
  city: "",
  budget: "",
  downPayment: "",
  purchase: "",
  rooms: "",
  name: "",
  phone: ""
};

const steps = [
  { key: "city", title: "Где ищем квартиру?", options: ["Владивосток", "Уссурийск", "Артём", "Всё Приморье"] },
  { key: "budget", title: "Какой бюджет?", options: ["до 7 млн ₽", "7–10 млн ₽", "10–15 млн ₽", "от 15 млн ₽"] },
  { key: "downPayment", title: "Первоначальный взнос", options: ["до 1 млн ₽", "1–2 млн ₽", "2–4 млн ₽", "от 4 млн ₽"] },
  { key: "purchase", title: "Как планируете покупать?", options: ["Ипотека", "Наличные", "Пока не решил(а)"] },
  { key: "rooms", title: "Сколько комнат?", options: ["Студия", "1-комнатная", "2-комнатная", "3+ комнаты"] }
] as const;

function Brand() {
  return (
    <div className="brand">
      <svg className="brandMark" viewBox="0 0 44 44" aria-hidden="true">
        <rect x="2" y="18" width="8" height="22" rx="2.5" />
        <rect x="13" y="9" width="8" height="31" rx="2.5" />
        <rect x="24" y="2" width="8" height="38" rx="2.5" />
        <rect x="35" y="14" width="7" height="26" rx="2.5" />
      </svg>
      <div>
        <strong>PULSE.DV</strong>
        <span>Новостройки Приморья</span>
      </div>
    </div>
  );
}

function Qr() {
  const matrix = useMemo(
    () => [
      "11111110101",
      "10000010111",
      "10111010001",
      "10111010111",
      "10111010001",
      "10000010101",
      "11111110111",
      "00101001001",
      "11101111101",
      "10011000111",
      "11101110101"
    ],
    []
  );

  return (
    <div className="qrBlock">
      <div className="qrGrid" aria-hidden="true">
        {matrix.flatMap((row, y) =>
          [...row].map((cell, x) => <span key={x + "-" + y} className={cell === "1" ? "on" : ""} />)
        )}
      </div>
      <span>Открыть<br />на телефоне</span>
    </div>
  );
}

function HomeScreen() {
  return (
    <div className="screen">
      <div className="status"><b>9:41</b><span>•••</span></div>
      <div className="appTop">
        <div className="appLogo"><i>▥</i><b>PULSE.DV</b></div>
        <span className="circle">○</span>
      </div>
      <div className="search"><Search size={13} /> ЖК, район или застройщик</div>
      <div className="coverCard">
        <div className="coverShade" />
        <small>Новостройки Приморья</small>
        <strong>Квартира, которую хочется показывать друзьям</strong>
        <span>Владивосток · Артём · Уссурийск</span>
        <button type="button">Смотреть проекты <ArrowRight size={11} /></button>
      </div>
      <div className="quickGrid">
        <span><Building2 />Каталог</span>
        <span><MapPin />На карте</span>
        <span><BarChart3 />Ипотека</span>
        <span><Sparkles />PULSE Select</span>
      </div>
      <div className="phoneSection">
        <small>ВЫБОР PULSE.DV</small>
        <div className="miniProject">
          <i />
          <div><b>ЖК «Босфор»</b><span>от 7,8 млн ₽</span></div>
          <Heart size={13} />
        </div>
      </div>
      <div className="phoneNav">
        <span className="active">⌂<small>Главная</small></span>
        <span>▥<small>Каталог</small></span>
        <span>✦<small>Подбор</small></span>
        <span>♡<small>Избранное</small></span>
      </div>
    </div>
  );
}

function CatalogScreen() {
  return (
    <div className="screen catalogScreen">
      <div className="status"><b>9:41</b><span>•••</span></div>
      <small className="catalogEyebrow">КАТАЛОГ PULSE.DV</small>
      <h3>Новостройки</h3>
      <p>По району, бюджету и сроку сдачи.</p>
      <div className="segment"><b>≡&nbsp; Список</b><span>⌖&nbsp; Карта</span></div>
      <div className="search"><Search size={13} /> ЖК, район, застройщик</div>
      <div className="chips"><b>Все</b><span>Владивосток</span><span>Уссурийск</span></div>
      <div className="catalogCard">
        <i className="picOne" />
        <div><small>ВИД НА МОРЕ</small><b>ЖК Солнечный</b><span>Владивосток · Патрокл</span><strong>от 6,2 млн ₽</strong></div>
        <Heart size={13} />
      </div>
      <div className="catalogCard">
        <i className="picTwo" />
        <div><small>СТАРТ ПРОДАЖ</small><b>ЖК Приморский</b><span>Владивосток · Центр</span><strong>от 7,8 млн ₽</strong></div>
        <Heart size={13} />
      </div>
      <div className="phoneNav">
        <span>⌂<small>Главная</small></span>
        <span className="active">▥<small>Каталог</small></span>
        <span>✦<small>Подбор</small></span>
        <span>♡<small>Избранное</small></span>
      </div>
    </div>
  );
}

function Device({ children, className }: { children: React.ReactNode; className: string }) {
  return <div className={"device " + className}>{children}</div>;
}

function ProductVisual() {
  return (
    <div className="productVisual" aria-label="Превью приложения PULSE.DV">
      <div className="softBridge" aria-hidden="true">
        <svg viewBox="0 0 900 520">
          <path d="M20 405 C185 345 310 340 442 372 C585 407 695 333 880 250" />
          <path d="M462 373 L520 145 L590 374" />
          <path d="M520 145 L520 75" />
          <path d="M520 152 L455 365 M520 152 L580 365 M520 152 L410 375 M520 152 L632 352" />
        </svg>
      </div>
      <div className="orbit" />
      <div className="handwriting topNote">Ближе<br />к вашему завтра</div>
      <Device className="deviceA"><HomeScreen /></Device>
      <Device className="deviceB"><CatalogScreen /></Device>
      <div className="floating mapFloat">
        <div><span className="redDot" /><b>12 новостроек</b></div>
        <small>на карте</small>
        <div className="mapMini"><i /><i /><i /></div>
      </div>
      <div className="floating apartmentFloat">
        <div className="roomArt" />
        <b>2-комнатная, 58 м²</b>
        <span>12,4 млн ₽</span>
      </div>
      <div className="handwriting bottomNote">Приморье<br />в твоём ритме</div>
    </div>
  );
}

function LeadModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [lead, setLead] = useState<Lead>(INITIAL_LEAD);
  const [done, setDone] = useState(false);
  const current = steps[step];

  useEffect(() => {
    document.body.classList.add("modalOpen");
    return () => document.body.classList.remove("modalOpen");
  }, []);

  const select = (value: string) => {
    setLead((prev) => ({ ...prev, [current.key]: value }));
    window.setTimeout(() => {
      if (step < steps.length - 1) setStep((value) => value + 1);
      else setStep(steps.length);
    }, 110);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    localStorage.setItem("pulse-lead", JSON.stringify({ ...lead, createdAt: new Date().toISOString() }));
    setDone(true);
  };

  const progress = ((step + 1) / (steps.length + 1)) * 100;

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <button className="closeButton" type="button" onClick={onClose} aria-label="Закрыть"><X /></button>
      <div className="modalCard">
        {!done && <div className="progress"><span style={{ width: progress + "%" }} /></div>}

        {done ? (
          <div className="success">
            <div className="successIcon"><Check /></div>
            <small>PULSE.DV</small>
            <h2>Готово.</h2>
            <p>Заявка сохранена. После подключения Control Center она будет уходить туда автоматически.</p>
            <button className="primaryButton compact" type="button" onClick={onClose}>Вернуться</button>
          </div>
        ) : step < steps.length ? (
          <>
            <div className="modalTitle">
              <span>Шаг {step + 1} из {steps.length + 1}</span>
              <h2>{current.title}</h2>
            </div>
            <div className="options">
              {current.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={lead[current.key] === option ? "selected" : ""}
                  onClick={() => select(option)}
                >
                  <span>{option}</span>
                  {lead[current.key] === option ? <Check size={18} /> : <ArrowRight size={18} />}
                </button>
              ))}
            </div>
            {step > 0 && <button className="backButton" type="button" onClick={() => setStep((value) => value - 1)}><ArrowLeft size={17} /> Назад</button>}
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="modalTitle">
              <span>Последний шаг</span>
              <h2>Куда отправить подборку?</h2>
            </div>
            <label>Имя<input required value={lead.name} onChange={(event) => setLead({ ...lead, name: event.target.value })} placeholder="Ваше имя" /></label>
            <label>Телефон<input required inputMode="tel" value={lead.phone} onChange={(event) => setLead({ ...lead, phone: event.target.value })} placeholder="+7 999 000-00-00" /></label>
            <button className="primaryButton full" type="submit">Получить подборку <ArrowRight size={19} /></button>
            <button className="backButton" type="button" onClick={() => setStep(steps.length - 1)}><ArrowLeft size={17} /> Назад</button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [leadOpen, setLeadOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;

    const onMove = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 2;
      const y = (event.clientY / window.innerHeight - 0.5) * 2;
      document.documentElement.style.setProperty("--mx", x.toFixed(3));
      document.documentElement.style.setProperty("--my", y.toFixed(3));
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <main className="page">
      <header className="header">
        <Brand />
        <div className="headerActions">
          <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>
          <a href="https://t.me" target="_blank" rel="noreferrer" aria-label="Telegram"><Send size={18} /></a>
          <button type="button" onClick={() => setLeadOpen(true)}>Подобрать квартиру <ArrowRight size={17} /></button>
        </div>
      </header>

      <section className="hero">
        <div className="copy">
          <span className="kicker">ВСЕ НОВОСТРОЙКИ ПРИМОРЬЯ</span>
          <h1>Новостройки<br />Приморья —<br /><em>в одном приложении.</em></h1>
          <p>Сравнивайте ЖК и квартиры, сохраняйте варианты и выбирайте спокойно — всё в PULSE.DV.</p>

          <div className="actionRow">
            <button className="primaryButton" type="button" onClick={() => setLeadOpen(true)}>Подобрать квартиру <ArrowRight size={20} /></button>
            <Qr />
          </div>

          <div className="benefits">
            <div><Building2 /><span>Актуальные<br />новостройки</span></div>
            <div><Heart /><span>Ваши<br />избранные</span></div>
            <div><BarChart3 /><span>Удобное<br />сравнение</span></div>
          </div>
        </div>

        <ProductVisual />
      </section>

      <footer className="footer">
        <div className="socialText">
          <a href="https://instagram.com" target="_blank" rel="noreferrer"><Instagram size={17} /> Instagram</a>
          <a href="https://t.me" target="_blank" rel="noreferrer"><Send size={17} /> Telegram</a>
        </div>
        <div className="tagline"><span>PULSE.DV</span><i />Больше, чем квадратные метры</div>
      </footer>

      {leadOpen && <LeadModal onClose={() => setLeadOpen(false)} />}
    </main>
  );
}
