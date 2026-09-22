import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  ChevronLeft,
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

const EMPTY_LEAD: Lead = {
  city: "",
  budget: "",
  downPayment: "",
  purchase: "",
  rooms: "",
  name: "",
  phone: ""
};

const steps = [
  {
    key: "city",
    title: "Где ищем квартиру?",
    subtitle: "Выберите город — это займёт несколько секунд.",
    options: ["Владивосток", "Уссурийск", "Артём", "Всё Приморье"]
  },
  {
    key: "budget",
    title: "Какой бюджет рассматриваете?",
    subtitle: "Можно выбрать приблизительный диапазон.",
    options: ["до 7 млн ₽", "7–10 млн ₽", "10–15 млн ₽", "от 15 млн ₽"]
  },
  {
    key: "downPayment",
    title: "Первоначальный взнос",
    subtitle: "Укажите ориентир — точный расчёт сделаем позже.",
    options: ["до 1 млн ₽", "1–2 млн ₽", "2–4 млн ₽", "от 4 млн ₽"]
  },
  {
    key: "purchase",
    title: "Как планируете покупать?",
    subtitle: "Это поможет сразу отобрать подходящие сценарии.",
    options: ["Ипотека", "Наличные", "Пока не решил(а)"]
  },
  {
    key: "rooms",
    title: "Сколько комнат нужно?",
    subtitle: "Выберите то, что рассматриваете сейчас.",
    options: ["Студия", "1-комнатная", "2-комнатная", "3+ комнаты"]
  }
] as const;

function PulseMark() {
  return (
    <div className="brand" aria-label="PULSE.DV">
      <svg className="brand-mark" viewBox="0 0 44 44" aria-hidden="true">
        <rect x="2" y="17" width="8" height="23" rx="2.4" />
        <rect x="13" y="8" width="8" height="32" rx="2.4" />
        <rect x="24" y="2" width="8" height="38" rx="2.4" />
        <rect x="35" y="13" width="7" height="27" rx="2.4" />
      </svg>
      <span>
        <strong>PULSE.DV</strong>
        <small>Новостройки Приморья</small>
      </span>
    </div>
  );
}

function QrPlaceholder() {
  const cells = useMemo(() => {
    const pattern = [
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
    ];
    return pattern.flatMap((row, y) =>
      [...row].map((value, x) => ({ x, y, on: value === "1" }))
    );
  }, []);

  return (
    <div className="qr-wrap" aria-label="QR для открытия PULSE будет подключён к Mini App">
      <div className="qr">
        {cells.map((cell) => (
          <span
            key={cell.x + "-" + cell.y}
            className={cell.on ? "qr-cell on" : "qr-cell"}
          />
        ))}
      </div>
      <span className="qr-caption">Открыть<br />на телефоне</span>
    </div>
  );
}

function MiniHome() {
  return (
    <div className="mini-screen">
      <div className="mini-status"><span>9:41</span><span>•••</span></div>
      <div className="mini-top">
        <div className="mini-brand"><span className="mini-logo">▥</span><b>PULSE.DV</b></div>
        <span className="mini-avatar">◦</span>
      </div>
      <div className="mini-search"><Search size={14} /> ЖК, район или застройщик</div>
      <div className="mini-hero">
        <div className="mini-photo bridge-art" />
        <div className="mini-hero-copy">
          <small>Новостройки Приморья</small>
          <b>Квартира, которую хочется показывать друзьям</b>
          <span>Владивосток · Артём · Уссурийск</span>
        </div>
        <button>Смотреть проекты <ArrowRight size={12} /></button>
      </div>
      <div className="mini-actions">
        <span><Building2 />Каталог</span>
        <span><MapPin />На карте</span>
        <span><BarChart3 />Ипотека</span>
        <span><Sparkles />PULSE Select</span>
      </div>
      <div className="mini-recommend">
        <small>ВЫБОР PULSE.DV</small>
        <b>Стоит посмотреть</b>
        <div className="mini-project-row">
          <div className="mini-project-img" />
          <div><b>ЖК «Босфор»</b><span>от 7,8 млн ₽</span></div>
          <Heart size={14} />
        </div>
      </div>
      <div className="mini-nav">
        <span className="active">⌂<small>Главная</small></span>
        <span>▥<small>Каталог</small></span>
        <span>✦<small>Подбор</small></span>
        <span>♡<small>Избранное</small></span>
      </div>
    </div>
  );
}

function MiniCatalog() {
  return (
    <div className="mini-screen catalog-screen">
      <div className="mini-status"><span>9:41</span><span>•••</span></div>
      <small className="eyebrow">КАТАЛОГ PULSE.DV</small>
      <h3>Новостройки</h3>
      <p>Подбирайте спокойно — по району, бюджету и сроку сдачи.</p>
      <div className="segmented"><b>≡&nbsp; Список</b><span>⌖&nbsp; Карта</span></div>
      <div className="mini-search"><Search size={14} /> ЖК, район, застройщик</div>
      <div className="catalog-chips"><b>Все</b><span>Владивосток</span><span>Уссурийск</span></div>
      <div className="property-card">
        <div className="property-picture one" />
        <div className="property-copy"><small>ВИД НА МОРЕ</small><b>ЖК Солнечный</b><span>Владивосток · Патрокл</span><strong>от 6,2 млн ₽</strong></div>
        <Heart size={14} />
      </div>
      <div className="property-card">
        <div className="property-picture two" />
        <div className="property-copy"><small>СТАРТ ПРОДАЖ</small><b>ЖК Приморский</b><span>Владивосток · Центр</span><strong>от 7,8 млн ₽</strong></div>
        <Heart size={14} />
      </div>
      <div className="mini-nav">
        <span>⌂<small>Главная</small></span>
        <span className="active">▥<small>Каталог</small></span>
        <span>✦<small>Подбор</small></span>
        <span>♡<small>Избранное</small></span>
      </div>
    </div>
  );
}

function LeadModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [lead, setLead] = useState<Lead>(EMPTY_LEAD);
  const [done, setDone] = useState(false);
  const current = steps[step];

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  const select = (value: string) => {
    setLead((prev) => ({ ...prev, [current.key]: value }));
    window.setTimeout(() => {
      if (step < steps.length - 1) setStep((s) => s + 1);
      else setStep(steps.length);
    }, 120);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    localStorage.setItem("pulse-lead-draft", JSON.stringify({ ...lead, createdAt: new Date().toISOString() }));
    setDone(true);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Подбор квартиры">
      <button className="modal-close" onClick={onClose} aria-label="Закрыть"><X /></button>
      <div className="lead-card">
        {!done && (
          <div className="lead-progress">
            <span style={{ width: `${Math.min(((step + 1) / (steps.length + 1)) * 100, 100)}%` }} />
          </div>
        )}

        {done ? (
          <div className="success">
            <span className="success-icon"><Check /></span>
            <small>PULSE.DV</small>
            <h2>Готово. Заявка сохранена.</h2>
            <p>На следующем этапе подключим отправку в PULSE Control Center. Пока данные сохранены на этом устройстве как тестовый лид.</p>
            <button className="primary" onClick={onClose}>Вернуться на сайт</button>
          </div>
        ) : step < steps.length ? (
          <>
            <div className="lead-head">
              <span>Шаг {step + 1} из {steps.length + 1}</span>
              <h2>{current.title}</h2>
              <p>{current.subtitle}</p>
            </div>
            <div className="option-grid">
              {current.options.map((option) => {
                const active = lead[current.key] === option;
                return (
                  <button key={option} className={active ? "option active" : "option"} onClick={() => select(option)}>
                    <span>{option}</span>{active ? <Check size={18} /> : <ArrowRight size={18} />}
                  </button>
                );
              })}
            </div>
            {step > 0 && (
              <button className="back-button" onClick={() => setStep((s) => s - 1)}><ChevronLeft size={18} /> Назад</button>
            )}
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="lead-head">
              <span>Последний шаг</span>
              <h2>Куда отправить подборку?</h2>
              <p>Оставьте контакт. Мы используем его только для связи по подбору недвижимости.</p>
            </div>
            <label>Имя<input required value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} placeholder="Евгений" /></label>
            <label>Телефон<input required inputMode="tel" value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} placeholder="+7 999 000-00-00" /></label>
            <button className="primary wide" type="submit">Получить подборку <ArrowRight size={18} /></button>
            <button className="back-button" type="button" onClick={() => setStep(steps.length - 1)}><ChevronLeft size={18} /> Назад</button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [leadOpen, setLeadOpen] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

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
    <main className="site-shell">
      <div className="ambient" aria-hidden="true">
        <span className="ambient-red" />
        <span className="ambient-blue" />
        <svg className="bridge-lines" viewBox="0 0 900 540">
          <path d="M60 420 C210 360 315 350 452 380 C595 410 710 335 860 280" />
          <path d="M462 380 L520 165 L590 380" />
          <path d="M520 165 L520 82" />
          <path d="M520 170 L455 370 M520 170 L580 372 M520 170 L410 382 M520 170 L630 365" />
          <path d="M60 445 C245 410 330 402 460 425 C615 450 720 390 865 335" />
        </svg>
      </div>

      <header className="topbar">
        <PulseMark />
        <div className="top-actions">
          <a className="social-mini" href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>
          <a className="social-mini" href="https://t.me" target="_blank" rel="noreferrer" aria-label="Telegram"><Send size={18} /></a>
          <button className="top-cta" onClick={() => setLeadOpen(true)}>Подобрать квартиру <ArrowRight size={17} /></button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="hero-kicker">ВСЕ НОВОСТРОЙКИ ПРИМОРЬЯ</div>
          <h1>Новостройки<br />Приморья —<br /><em>в одном приложении.</em></h1>
          <p>Сравнивайте ЖК и квартиры, сохраняйте варианты и получайте подборку под ваш бюджет — спокойно и без лишнего шума.</p>

          <div className="hero-actions">
            <button className="primary hero-primary" onClick={() => setLeadOpen(true)}>Подобрать квартиру <ArrowRight /></button>
            <QrPlaceholder />
          </div>

          <div className="feature-row">
            <div><Building2 /><span>Актуальные<br />новостройки</span></div>
            <div><Heart /><span>Ваши<br />избранные</span></div>
            <div><BarChart3 /><span>Удобное<br />сравнение</span></div>
          </div>

          <div className="social-row">
            <a href="https://instagram.com" target="_blank" rel="noreferrer"><Instagram size={18} /> Мы в Instagram</a>
            <span />
            <a href="https://t.me" target="_blank" rel="noreferrer"><Send size={18} /> Мы в Telegram</a>
          </div>
        </div>

        <div className="product-stage" aria-label="Превью приложения PULSE.DV">
          <div className="hand-note note-top">Ближе<br />к вашему завтра</div>
          <div className="red-orbit" />
          <div className="phone phone-front"><MiniHome /></div>
          <div className="phone phone-back"><MiniCatalog /></div>

          <div className="float-card map-card">
            <div className="float-card-head"><span className="pulse-dot" /> 12 новостроек</div>
            <small>на карте</small>
            <div className="map-art"><span /><span /><span /></div>
          </div>

          <div className="float-card apartment-card">
            <div className="apartment-art" />
            <small>2-комнатная, 58 м²</small>
            <b>12,4 млн ₽</b>
          </div>

          <div className="hand-note note-bottom">Приморье<br />в твоём ритме</div>
        </div>
      </section>

      <footer className="footline">
        <span>PULSE.DV</span>
        <i />
        <span>Больше, чем квадратные метры</span>
      </footer>

      {leadOpen && <LeadModal onClose={() => setLeadOpen(false)} />}
    </main>
  );
}
