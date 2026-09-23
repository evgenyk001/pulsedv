import { useMemo } from "react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Heart,
  Instagram,
  Send
} from "lucide-react";

const PULSE_BOT_URL = "https://t.me/pulsedvbot";

function Logo() {
  return (
    <div className="logo" aria-label="PULSE.DV">
      <img src="./brand-mark.svg" alt="" aria-hidden="true" />
      <span><b>PULSE.DV</b><small>Новостройки Приморья</small></span>
    </div>
  );
}

function QrPlaceholder() {
  const cells = useMemo(() => {
    const map = [
      "11111110111",
      "10000010101",
      "10111011101",
      "10111010001",
      "10111010111",
      "10000010001",
      "11111110111",
      "00101101001",
      "11110111101",
      "10010100111",
      "11111110101"
    ];
    return map.flatMap((row, y) => [...row].map((value, x) => ({ x, y, on: value === "1" })));
  }, []);

  return (
    <a
      className="qr-block"
      href={PULSE_BOT_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="Открыть Telegram-бот PULSE.DV"
    >
      <div className="qr">
        {cells.map((cell) => <i className={cell.on ? "on" : ""} key={cell.x + "-" + cell.y} />)}
      </div>
      <span>Откройте<br />на телефоне</span>
    </a>
  );
}

export default function App() {
  return (
    <main className="page">
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
      </header>

      <section className="hero">
        <div className="copy">
          <div className="eyebrow">НОВОСТРОЙКИ ПРИМОРЬЯ</div>
          <h1>Новостройки<br />Приморья —<br /><em>в одном приложении.</em></h1>
          <p>Сравнивайте ЖК и квартиры, изучайте цены, сохраняйте варианты и выбирайте самостоятельно.</p>

          <div className="cta-row">
            <a className="primary hero-cta" href={PULSE_BOT_URL} target="_blank" rel="noreferrer">
              Открыть PULSE <ArrowRight size={21} />
            </a>
            <QrPlaceholder />
          </div>

          <div className="feature-row">
            <div><Building2 /><span>Актуальные<br />новостройки</span></div>
            <div><Heart /><span>Ваши<br />избранные</span></div>
            <div><BarChart3 /><span>Удобное<br />сравнение</span></div>
          </div>

          <div className="social-row">
            <a href="https://instagram.com" target="_blank" rel="noreferrer"><Instagram size={19} /> Мы в Instagram</a>
            <i />
            <a href={PULSE_BOT_URL} target="_blank" rel="noreferrer"><Send size={19} /> Мы в Telegram</a>
          </div>
        </div>

        <div className="visual">
          <div className="hand-note top-note">Ближе<br />к вашему завтра</div>
          <img src="./hero-visual.svg" alt="Приложение PULSE.DV на двух смартфонах" />
          <div className="hand-note side-note">Живите там,<br />где вдохновляет</div>
        </div>
      </section>

      <footer className="footer">
        <span>PULSE.DV</span><i /><span>Больше, чем квадратные метры</span>
      </footer>
    </main>
  );
}
