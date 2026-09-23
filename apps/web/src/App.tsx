import {
  ArrowRight,
  BarChart3,
  Building2,
  Heart,
  MapPin,
  Send,
  ShieldCheck,
  Sparkles,
  Smartphone,
  WalletCards
} from "lucide-react";

const PULSE_BOT_URL = "https://t.me/pulsedvbot";

function Logo() {
  return (
    <a className="logo" href="#top" aria-label="PULSE.DV — Новостройки Приморья">
      <img src="./brand-mark.svg" alt="" aria-hidden="true" />
      <span>
        <b>PULSE.DV</b>
        <small>Новостройки Приморья</small>
      </span>
    </a>
  );
}

function CTA({ label = "Открыть PULSE" }: { label?: string }) {
  return (
    <a className="primary" href={PULSE_BOT_URL} target="_blank" rel="noreferrer">
      <span>{label}</span>
      <ArrowRight size={20} />
    </a>
  );
}

const productPoints = [
  { icon: Building2, title: "Новостройки", text: "Проекты Приморья в одном понятном интерфейсе." },
  { icon: MapPin, title: "Карта", text: "Смотрите расположение и выбирайте удобный район." },
  { icon: Heart, title: "Избранное", text: "Сохраняйте варианты, к которым хочется вернуться." },
  { icon: BarChart3, title: "Сравнение", text: "Сопоставляйте квартиры без десятков открытых вкладок." },
  { icon: WalletCards, title: "Ипотека", text: "Понимайте сценарий покупки ещё до встречи с банком." },
  { icon: Sparkles, title: "PULSE Select", text: "Получайте подборку под свой бюджет и задачу." }
];

export default function App() {
  return (
    <main className="page" id="top">
      <div className="scene" aria-hidden="true">
        <span className="sea-glow" />
        <span className="red-loop" />
        <svg className="bridge-bg" viewBox="0 0 900 520">
          <path d="M60 420C212 362 326 354 455 382C596 413 714 344 866 286" />
          <path d="M458 382L520 165L590 382M520 165V84M520 171L454 373M520 171L584 373M520 171L413 383M520 171L637 365" />
          <path d="M62 447C240 414 340 408 467 430C619 458 726 402 870 350" />
        </svg>
      </div>

      <header className="header">
        <Logo />
        <CTA />
      </header>

      <section className="hero">
        <div className="copy">
          <div className="eyebrow">НОВОСТРОЙКИ ПРИМОРЬЯ</div>
          <h1>
            Новостройки<br />
            Приморья —<br />
            <em>в одном приложении.</em>
          </h1>
          <p>
            PULSE.DV помогает спокойно выбирать квартиру: смотреть проекты,
            сохранять понравившееся и понимать свой сценарий покупки.
          </p>
          <div className="hero-cta-row">
            <CTA />
            <span className="hero-note">Владивосток · Артём · Уссурийск</span>
          </div>

          <div className="hero-proof">
            <span><Building2 size={19} /> Новостройки</span>
            <span><Heart size={19} /> Избранное</span>
            <span><Sparkles size={19} /> PULSE Select</span>
          </div>
        </div>

        <div className="visual">
          <div className="hand-note top-note">Ближе<br />к вашему завтра</div>
          <div className="visual-orbit" aria-hidden="true" />
          <img src="./hero-visual.svg" alt="Приложение PULSE.DV на двух смартфонах" />
          <div className="hand-note side-note">Приморье<br />в твоём ритме</div>
        </div>
      </section>

      <section className="intro section-wrap">
        <span className="section-kicker">PULSE.DV</span>
        <h2>
          Не ещё один сайт с объявлениями.<br />
          <em>Новый способ выбирать новостройку.</em>
        </h2>
        <p>
          Мы собрали привычный путь поиска квартиры в одном мобильном продукте —
          без перегруженных таблиц, бесконечных звонков и десятков вкладок.
        </p>
      </section>

      <section className="product-film section-wrap">
        <div className="film-copy">
          <span className="section-kicker">ПРОДУКТ</span>
          <h3>Всё важное — в одном месте.</h3>
          <p>
            PULSE создан так, чтобы выбор недвижимости ощущался так же просто,
            как привычное мобильное приложение.
          </p>
        </div>

        <div className="film-stage">
          <div className="film-glow" />
          <img src="./hero-visual.svg" alt="Интерфейс PULSE.DV" />
          <span className="floating-tag tag-one"><Heart size={17} /> Сохраняйте понравившееся</span>
          <span className="floating-tag tag-two"><MapPin size={17} /> Смотрите на карте</span>
          <span className="floating-tag tag-three"><Sparkles size={17} /> Получайте подбор</span>
        </div>
      </section>

      <section className="features section-wrap">
        <div className="features-head">
          <span className="section-kicker">ВНУТРИ PULSE</span>
          <h3>Функции, которые помогают выбрать.</h3>
        </div>
        <div className="feature-grid">
          {productPoints.map(({ icon: Icon, title, text }) => (
            <article className="feature-card" key={title}>
              <span className="feature-icon"><Icon size={23} /></span>
              <h4>{title}</h4>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="dark-story">
        <div className="dark-inner section-wrap">
          <div className="dark-copy">
            <span className="section-kicker">СПОКОЙНЕЕ. ПОНЯТНЕЕ. БЛИЖЕ.</span>
            <h2>
              Вы выбираете не квадратные метры.<br />
              <em>Вы выбираете следующую главу жизни.</em>
            </h2>
            <p>
              Поэтому PULSE показывает не только объект, но и контекст:
              где он находится, как выглядит, сколько стоит и как может выглядеть путь к покупке.
            </p>
          </div>
          <div className="dark-cards">
            <article>
              <span>01</span>
              <b>Смотрите</b>
              <p>Проекты, квартиры и расположение.</p>
            </article>
            <article>
              <span>02</span>
              <b>Сохраняйте</b>
              <p>Всё, что хочется сравнить позже.</p>
            </article>
            <article>
              <span>03</span>
              <b>Выбирайте</b>
              <p>С опорой на свои цели и бюджет.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="trust section-wrap">
        <div className="trust-copy">
          <span className="section-kicker">НЕ ТОЛЬКО ТЕХНОЛОГИЯ</span>
          <h3>За приложением стоит команда PULSE.DV.</h3>
          <p>
            Когда нужен живой специалист, мы подключаемся: объясняем,
            показываем, сопровождаем и помогаем пройти путь дальше.
          </p>
        </div>
        <div className="trust-card">
          <span className="trust-icon"><ShieldCheck size={28} /></span>
          <div>
            <small>PULSE.DV</small>
            <b>Недвижимость понятным языком.</b>
            <p>Приложение помогает выбрать. Команда помогает принять решение спокойно.</p>
          </div>
        </div>
      </section>

      <section className="app-final section-wrap">
        <div className="app-final-copy">
          <span className="section-kicker">PULSE НА ТЕЛЕФОНЕ</span>
          <h2>
            Ваш выбор всегда<br />
            <em>под рукой.</em>
          </h2>
          <p>
            Откройте PULSE в Telegram и посмотрите, как выглядит новый способ искать новостройки Приморья.
          </p>
          <CTA label="Открыть приложение" />
        </div>
        <div className="app-final-visual">
          <div className="app-halo" />
          <img src="./hero-visual.svg" alt="PULSE.DV на смартфонах" />
        </div>
      </section>

      <section className="final-cta section-wrap">
        <div>
          <span className="section-kicker">PULSE.DV</span>
          <h2>Больше, чем квадратные метры.</h2>
          <p>Новостройки Приморья — в одном красивом и понятном приложении.</p>
        </div>
        <CTA label="Открыть PULSE" />
      </section>

      <footer className="footer">
        <Logo />
        <div className="footer-links">
          <a href={PULSE_BOT_URL} target="_blank" rel="noreferrer"><Send size={17}/> Telegram</a>
          <span>© PULSE.DV</span>
          <span>Больше, чем квадратные метры</span>
        </div>
      </footer>
    </main>
  );
}
