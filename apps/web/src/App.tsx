import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Calculator,
  Check,
  Heart,
  Instagram,
  MapPin,
  Search,
  Send,
  Sparkles
} from "lucide-react";

const PULSE_URL = import.meta.env.VITE_PULSE_TG_URL || "";

function PulseMark() {
  return (
    <a className="brand" href="#top" aria-label="PULSE.DV — наверх">
      <svg className="brand-mark" viewBox="0 0 44 44" aria-hidden="true">
        <rect x="2" y="17" width="8" height="23" rx="2.5" />
        <rect x="13" y="8" width="8" height="32" rx="2.5" />
        <rect x="24" y="2" width="8" height="38" rx="2.5" />
        <rect x="35" y="13" width="7" height="27" rx="2.5" />
      </svg>
      <span>
        <strong>PULSE.DV</strong>
        <small>Новостройки Приморья</small>
      </span>
    </a>
  );
}

function QrMock() {
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
    <div className="qr-group" aria-label="QR будет связан с Telegram Mini App">
      <div className="qr">
        {cells.map((cell) => (
          <span
            key={`${cell.x}-${cell.y}`}
            className={cell.on ? "qr-cell on" : "qr-cell"}
          />
        ))}
      </div>
      <div>
        <b>Откройте на телефоне</b>
        <span>QR подключим к Mini App</span>
      </div>
    </div>
  );
}

function PhoneHome() {
  return (
    <div className="phone-screen">
      <div className="phone-status"><span>9:41</span><span>● ● ●</span></div>
      <div className="phone-head">
        <span className="phone-brand"><i>▥</i><b>PULSE.DV</b></span>
        <span className="phone-user">○</span>
      </div>
      <div className="app-search"><Search size={13} /> ЖК, район или застройщик</div>

      <div className="app-hero-card">
        <div className="app-hero-bg" />
        <div className="app-hero-copy">
          <small>Новостройки Приморья</small>
          <strong>Квартира, которую хочется показывать друзьям</strong>
          <span>Владивосток · Уссурийск · Артём</span>
        </div>
        <button type="button">Смотреть проекты <ArrowRight size={11} /></button>
      </div>

      <div className="app-actions">
        <span><Building2 />Каталог</span>
        <span><MapPin />На карте</span>
        <span><Calculator />Ипотека</span>
        <span><Sparkles />PULSE Select</span>
      </div>

      <div className="app-selection">
        <small>ВЫБОР PULSE.DV</small>
        <div className="app-selection-head"><b>Стоит посмотреть</b><span>Все →</span></div>
        <div className="mini-listing">
          <i />
          <div><b>ЖК «Босфор»</b><span>от 7,8 млн ₽</span></div>
          <Heart size={13} />
        </div>
      </div>

      <div className="app-nav">
        <span className="active">⌂<small>Главная</small></span>
        <span>▥<small>Каталог</small></span>
        <span>✦<small>Подбор</small></span>
        <span>♡<small>Избранное</small></span>
      </div>
    </div>
  );
}

function PhoneCatalog() {
  return (
    <div className="phone-screen catalog">
      <div className="phone-status"><span>9:41</span><span>● ● ●</span></div>
      <small className="catalog-label">КАТАЛОГ PULSE.DV</small>
      <h3>Новостройки</h3>
      <p>Подбирайте спокойно — по району, бюджету и сроку сдачи.</p>
      <div className="catalog-switch"><b>≡&nbsp; Список</b><span>⌖&nbsp; Карта</span></div>
      <div className="app-search"><Search size={13} /> ЖК, район, застройщик</div>
      <div className="chips"><b>Все</b><span>Владивосток</span><span>Уссурийск</span></div>

      <div className="property">
        <i className="pic pic-one" />
        <div><small>ВИД НА МОРЕ</small><b>ЖК Солнечный</b><span>Владивосток · Патрокл</span><strong>от 6,2 млн ₽</strong></div>
        <Heart size={13} />
      </div>
      <div className="property">
        <i className="pic pic-two" />
        <div><small>СТАРТ ПРОДАЖ</small><b>ЖК Приморский</b><span>Владивосток · Центр</span><strong>от 7,8 млн ₽</strong></div>
        <Heart size={13} />
      </div>

      <div className="app-nav">
        <span>⌂<small>Главная</small></span>
        <span className="active">▥<small>Каталог</small></span>
        <span>✦<small>Подбор</small></span>
        <span>♡<small>Избранное</small></span>
      </div>
    </div>
  );
}

function ProductStage() {
  return (
    <div className="product-stage" aria-label="Превью приложения PULSE.DV">
      <div className="stage-orbit" />
      <div className="hand-note note-top">Ближе<br />к вашему завтра</div>

      <div className="phone phone-a"><PhoneHome /></div>
      <div className="phone phone-b"><PhoneCatalog /></div>

      <div className="float-card map-float">
        <div className="map-title"><span className="red-pin">●</span><b>12 новостроек</b></div>
        <span>на карте</span>
        <div className="map-mini"><i /><i /><i /></div>
      </div>

      <div className="float-card room-float">
        <div className="room-photo" />
        <b>2-комнатная, 58 м²</b>
        <span>12,4 млн ₽</span>
      </div>

      <div className="hand-note note-bottom">Приморье<br />в твоём ритме</div>
    </div>
  );
}

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={className} data-reveal>{children}</div>;
}

export default function App() {
  const [notice, setNotice] = useState(false);

  const openPulse = () => {
    if (PULSE_URL) {
      window.open(PULSE_URL, "_blank", "noopener,noreferrer");
      return;
    }
    setNotice(true);
    document.querySelector("#open-pulse")?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setNotice(false), 3600);
  };

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 }
    );

    document.querySelectorAll("[data-reveal]").forEach((node) => observer.observe(node));

    if (reduce) return () => observer.disconnect();

    const onMove = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 2;
      const y = (event.clientY / window.innerHeight - 0.5) * 2;
      document.documentElement.style.setProperty("--mx", x.toFixed(3));
      document.documentElement.style.setProperty("--my", y.toFixed(3));
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      observer.disconnect();
    };
  }, []);

  return (
    <main id="top" className="page">
      <header className="header">
        <PulseMark />
        <nav className="nav" aria-label="Навигация">
          <a href="#why">Возможности</a>
          <a href="#how">Как это работает</a>
          <a href="#open-pulse">Приложение</a>
        </nav>
        <button className="header-cta" type="button" onClick={openPulse}>
          <Send size={17} /> Открыть PULSE
        </button>
      </header>

      <section className="hero shell">
        <Reveal className="hero-copy">
          <div className="kicker">ВСЕ НОВОСТРОЙКИ ПРИМОРЬЯ</div>
          <h1>Новостройки<br />Приморья —<br /><em>в одном приложении.</em></h1>
          <p>Сравнивайте ЖК и квартиры, сохраняйте варианты и выбирайте самостоятельно — без десятков сайтов и лишнего шума.</p>

          <div className="hero-cta-row">
            <button className="primary hero-button" type="button" onClick={openPulse}>
              <Send size={20} /> Открыть PULSE <ArrowRight size={21} />
            </button>
            <QrMock />
          </div>

          <div className="hero-benefits">
            <div><Building2 /><span>Актуальные<br />новостройки</span></div>
            <div><Heart /><span>Ваши<br />избранные</span></div>
            <div><BarChart3 /><span>Удобное<br />сравнение</span></div>
          </div>
        </Reveal>

        <Reveal className="hero-visual"><ProductStage /></Reveal>
      </section>

      <div className="city-line shell" data-reveal>
        <span>Владивосток</span><i />
        <span>Уссурийск</span><i />
        <span>Артём</span><i />
        <span>Приморский край</span>
      </div>

      <section id="why" className="why section shell">
        <Reveal className="section-heading">
          <span className="section-kicker">PULSE.DV</span>
          <h2>Не ещё один сайт<br />с объявлениями.</h2>
          <p>Сайт знакомит с PULSE. Вся настоящая работа — внутри приложения.</p>
        </Reveal>

        <div className="feature-grid">
          <Reveal className="feature-card feature-large">
            <div className="feature-copy">
              <span className="feature-icon"><Sparkles /></span>
              <small>PULSE SELECT</small>
              <h3>Подбор под вашу ситуацию</h3>
              <p>Бюджет, первоначальный взнос, способ покупки и пожелания — PULSE помогает быстрее сузить выбор.</p>
              <div className="check-row"><Check size={15} /> Без перегруженных анкет</div>
            </div>
            <div className="select-demo">
              <div className="select-head"><span>1 из 5</span><b>Для каких целей<br />вы выбираете квартиру?</b></div>
              <button className="selected">⌂&nbsp;&nbsp; Для жизни <Check size={15} /></button>
              <button>↗&nbsp;&nbsp; Для инвестиций</button>
              <button>♡&nbsp;&nbsp; Для семьи</button>
            </div>
          </Reveal>

          <Reveal className="feature-card">
            <div className="feature-copy">
              <span className="feature-icon"><Building2 /></span>
              <small>ВСЁ В ОДНОМ МЕСТЕ</small>
              <h3>ЖК и квартиры без хаоса</h3>
              <p>Смотрите проекты, планировки и цены в одном понятном интерфейсе.</p>
            </div>
            <div className="stack-demo">
              <div className="stack-card back"><span>ЖК Приморский</span></div>
              <div className="stack-card front"><i /><div><small>Вид на море</small><b>ЖК Солнечный</b><strong>от 6,2 млн ₽</strong></div><Heart size={15} /></div>
            </div>
          </Reveal>

          <Reveal className="feature-card">
            <div className="feature-copy">
              <span className="feature-icon"><BarChart3 /></span>
              <small>СРАВНИВАЙТЕ СПОКОЙНО</small>
              <h3>Сохранить. Сравнить. Решить.</h3>
              <p>Избранное и сравнение помогают не держать все варианты в голове.</p>
            </div>
            <div className="compare-demo">
              <div><small>ЖК A</small><b>8,4 млн ₽</b><span>52 м²</span></div>
              <div><small>ЖК B</small><b>9,1 млн ₽</b><span>58 м²</span></div>
              <div className="compare-line"><span>Цена</span><i /></div>
              <div className="compare-line"><span>Площадь</span><i /></div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="how" className="how section">
        <div className="shell">
          <Reveal className="how-heading">
            <span className="section-kicker">КАК ЭТО РАБОТАЕТ</span>
            <h2>От интереса до<br />короткого списка — просто.</h2>
          </Reveal>

          <div className="steps">
            <Reveal className="step">
              <span>01</span>
              <div className="step-icon"><Send /></div>
              <h3>Откройте PULSE</h3>
              <p>Переходите в Telegram Mini App — без отдельной установки.</p>
            </Reveal>
            <Reveal className="step">
              <span>02</span>
              <div className="step-icon"><Sparkles /></div>
              <h3>Задайте параметры</h3>
              <p>Укажите бюджет, способ покупки и то, что важно именно вам.</p>
            </Reveal>
            <Reveal className="step">
              <span>03</span>
              <div className="step-icon"><Heart /></div>
              <h3>Сравните варианты</h3>
              <p>Сохраняйте интересные квартиры и возвращайтесь к ним когда удобно.</p>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="open-pulse" className="final section shell">
        <Reveal className="final-card">
          <div className="final-copy">
            <span className="section-kicker">PULSE.DV</span>
            <h2>Ваш следующий адрес<br />может начаться здесь.</h2>
            <p>Новостройки Приморья, подбор и сравнение — в одном приложении.</p>
            <button className="primary" type="button" onClick={openPulse}>
              <Send size={19} /> Открыть PULSE <ArrowRight size={20} />
            </button>
          </div>
          <div className="final-art">
            <div className="final-phone"><PhoneHome /></div>
            <div className="final-note">Ближе<br />к вашему дому</div>
          </div>
        </Reveal>
      </section>

      <footer className="footer shell">
        <PulseMark />
        <div className="footer-tagline">PULSE.DV — Больше, чем квадратные метры</div>
        <div className="footer-socials">
          <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>
          <a href="https://t.me" target="_blank" rel="noreferrer" aria-label="Telegram"><Send size={18} /></a>
        </div>
      </footer>

      {notice && (
        <div className="toast" role="status">
          <span><Check size={17} /></span>
          Ссылку на Mini App подключим сразу после переноса из Floot.
        </div>
      )}
    </main>
  );
}
