import { useMemo } from "react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Calculator,
  Check,
  GitCompareArrows,
  Heart,
  Home,
  MapPin,
  MessageCircle,
  Search,
  Send,
  Smartphone,
  Sparkles
} from "lucide-react";

const PULSE_BOT_URL = "https://t.me/pulsedvbot";

const taskLinks = [
  { href: "#find", label: "Найти квартиру", icon: Search },
  { href: "#compare", label: "Сравнить варианты", icon: GitCompareArrows },
  { href: "#mortgage", label: "Понять ипотеку", icon: Calculator },
  { href: "#select", label: "Получить подбор", icon: Sparkles },
  { href: "#expert", label: "Спросить специалиста", icon: MessageCircle },
  { href: "#app", label: "Открыть приложение", icon: Smartphone }
];

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

function QrPlaceholder() {
  const cells = useMemo(() => {
    const map = [
      "11111110111","10000010101","10111011101","10111010001",
      "10111010111","10000010001","11111110111","00101101001",
      "11110111101","10010100111","11111110101"
    ];
    return map.flatMap((row, y) =>
      [...row].map((value, x) => ({ x, y, on: value === "1" }))
    );
  }, []);

  return (
    <a className="qr-block" href={PULSE_BOT_URL} target="_blank" rel="noreferrer">
      <div className="qr" aria-hidden="true">
        {cells.map((cell) => (
          <i className={cell.on ? "on" : ""} key={cell.x + "-" + cell.y} />
        ))}
      </div>
      <span>Откройте<br />на телефоне</span>
    </a>
  );
}

function CTA({ children = "Открыть PULSE" }: { children?: string }) {
  return (
    <a className="primary" href={PULSE_BOT_URL} target="_blank" rel="noreferrer">
      <span>{children}</span>
      <ArrowRight size={20} />
    </a>
  );
}

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
        <a className="header-cta" href={PULSE_BOT_URL} target="_blank" rel="noreferrer">
          Открыть PULSE <ArrowRight size={18} />
        </a>
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
            Сравнивайте ЖК и квартиры, сохраняйте варианты и выбирайте
            подходящее в одном понятном сервисе.
          </p>

          <div className="cta-row">
            <CTA />
            <QrPlaceholder />
          </div>

          <div className="hero-points">
            <span><Building2 size={20} /> Новостройки</span>
            <span><Heart size={20} /> Избранное</span>
            <span><BarChart3 size={20} /> Сравнение</span>
          </div>
        </div>

        <div className="visual">
          <div className="hand-note top-note">Ближе<br />к вашему завтра</div>
          <div className="visual-orbit" aria-hidden="true" />
          <img src="./hero-visual.svg" alt="Приложение PULSE.DV на двух смартфонах" />
          <div className="hand-note side-note">Живите там,<br />где вдохновляет</div>
        </div>
      </section>

      <nav className="task-nav" aria-label="Что можно сделать в PULSE.DV">
        {taskLinks.map(({ href, label, icon: Icon }) => (
          <a href={href} key={href}>
            <Icon size={20} />
            <span>{label}</span>
            <ArrowRight size={16} />
          </a>
        ))}
      </nav>

      <section className="statement section-wrap">
        <p className="section-kicker">PULSE.DV</p>
        <h2>
          Приложение и команда,<br />
          которые помогают <em>выбрать квартиру</em><br />
          без хаоса из сотен объявлений.
        </h2>
      </section>

      <section className="story-block section-wrap" id="find">
        <div className="section-copy">
          <span className="step-number">01</span>
          <h3>Найти подходящие новостройки</h3>
          <p>
            Сначала — не конкретный дом, а ваша задача: район, бюджет,
            срок сдачи, планировка и формат покупки.
          </p>
          <a className="text-link" href={PULSE_BOT_URL} target="_blank" rel="noreferrer">
            Начать подбор <ArrowRight size={18} />
          </a>
        </div>
        <div className="showcase search-showcase">
          <div className="search-shell"><Search size={18} /> ЖК, район или застройщик</div>
          <div className="project-grid">
            <article><div className="fake-photo p1" /><b>Вид на море</b><span>Владивосток · Патрокл</span><strong>от 6,2 млн ₽</strong></article>
            <article><div className="fake-photo p2" /><b>Ближе к центру</b><span>Владивосток</span><strong>от 7,8 млн ₽</strong></article>
            <article><div className="fake-photo p3" /><b>Для семьи</b><span>Уссурийск</span><strong>от 5,9 млн ₽</strong></article>
          </div>
        </div>
      </section>

      <section className="story-block reverse section-wrap" id="compare">
        <div className="section-copy">
          <span className="step-number">02</span>
          <h3>Сравнить то, что действительно важно</h3>
          <p>
            Цена, площадь, срок сдачи, первоначальный взнос и ориентировочный
            платёж — в одном экране, без переключения между десятью вкладками.
          </p>
        </div>
        <div className="showcase compare-card">
          <div className="compare-head"><span>Сравнение</span><b>2 квартиры</b></div>
          <div className="compare-columns">
            <div><div className="compare-photo cp1" /><b>54,6 м²</b><span>9,85 млн ₽</span></div>
            <div><div className="compare-photo cp2" /><b>58,1 м²</b><span>10,4 млн ₽</span></div>
          </div>
          <div className="compare-lines">
            <span><i>Срок сдачи</i><b>IV кв. 2027</b><b>II кв. 2028</b></span>
            <span><i>Отделка</i><b>White box</b><b>Чистовая</b></span>
            <span><i>До центра</i><b>18 мин</b><b>12 мин</b></span>
          </div>
        </div>
      </section>

      <section className="story-block section-wrap" id="mortgage">
        <div className="section-copy">
          <span className="step-number">03</span>
          <h3>Понять ипотеку до разговора с банком</h3>
          <p>
            Выберите программу, измените первоначальный взнос или срок —
            PULSE пересчитает сценарий и покажет ориентировочный платёж.
          </p>
          <small>Расчёт предварительный и не является решением банка.</small>
        </div>
        <div className="showcase mortgage-card">
          <div className="mortgage-top"><span>Семейная ипотека</span><b>от 6%</b></div>
          <div className="mortgage-price">9 850 000 ₽</div>
          <div className="slider-row"><span>Первоначальный взнос</span><b>2 500 000 ₽</b></div>
          <div className="fake-slider"><i /></div>
          <div className="mortgage-output">
            <span><small>Платёж в месяц</small><b>≈ 44 800 ₽</b></span>
            <span><small>Срок</small><b>30 лет</b></span>
          </div>
        </div>
      </section>

      <section className="story-block reverse section-wrap" id="select">
        <div className="section-copy">
          <span className="step-number">04</span>
          <h3>PULSE Select — подбор под вашу ситуацию</h3>
          <p>
            Отвечаете на несколько простых вопросов. Сервис сужает выбор,
            а специалист подключается уже к понятной задаче.
          </p>
          <CTA children="Пройти подбор" />
        </div>
        <div className="showcase select-card">
          <div className="select-step active"><Check size={17} /><span>Город</span><b>Владивосток</b></div>
          <div className="select-step active"><Check size={17} /><span>Бюджет</span><b>до 10 млн ₽</b></div>
          <div className="select-step active"><Check size={17} /><span>Покупка</span><b>Ипотека</b></div>
          <div className="select-step"><Sparkles size={17} /><span>Результат</span><b>Подбираем варианты</b></div>
        </div>
      </section>

      <section className="story-block section-wrap" id="expert">
        <div className="section-copy">
          <span className="step-number">05</span>
          <h3>Если нужен человек — он рядом</h3>
          <p>
            PULSE не заменяет специалиста там, где важен опыт. Мы подключаемся
            к переговорам, показам и оформлению, когда это действительно нужно.
          </p>
        </div>
        <div className="showcase expert-card">
          <div className="expert-avatar">P</div>
          <div>
            <small>Специалист PULSE.DV</small>
            <h4>Разберём вашу ситуацию</h4>
            <p>Объясним варианты простыми словами и поможем пройти путь дальше.</p>
          </div>
          <a href={PULSE_BOT_URL} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Написать</a>
        </div>
      </section>

      <section className="app-section section-wrap" id="app">
        <div className="app-copy">
          <p className="section-kicker">ОДИН СЕРВИС</p>
          <h2>Сохраняйте выбор<br />и возвращайтесь к нему<br /><em>когда удобно.</em></h2>
          <p>Главная, каталог, карта, подбор, избранное и расчёты — внутри PULSE.</p>
          <div className="cta-row">
            <CTA />
            <QrPlaceholder />
          </div>
        </div>
        <div className="app-visual">
          <img src="./hero-visual.svg" alt="Интерфейс приложения PULSE.DV" />
        </div>
      </section>

      <section className="final-cta section-wrap">
        <div>
          <span className="section-kicker">PULSE.DV</span>
          <h2>Начните не с объявления.<br />Начните с того, что подходит вам.</h2>
        </div>
        <CTA children="Подобрать квартиру" />
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
