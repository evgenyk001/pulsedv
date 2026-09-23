import { useMemo } from "react";
import { Send } from "lucide-react";
import UseAnimations from "react-useanimations";
import activity from "react-useanimations/lib/activity";
import arrowRightCircle from "react-useanimations/lib/arrowRightCircle";
import heart from "react-useanimations/lib/heart";
import home from "react-useanimations/lib/home";
import instagram from "react-useanimations/lib/instagram";

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
    return map.flatMap((row, y) =>
      [...row].map((value, x) => ({ x, y, on: value === "1" }))
    );
  }, []);

  return (
    <a
      className="qr-block"
      href={PULSE_BOT_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="Открыть PULSE в Telegram"
    >
      <div className="qr" aria-hidden="true">
        {cells.map((cell) => (
          <i className={cell.on ? "on" : ""} key={cell.x + "-" + cell.y} />
        ))}
      </div>
      <span>
        Откройте
        <br />
        на телефоне
      </span>
    </a>
  );
}

function Feature({
  animation,
  children
}: {
  animation: typeof home;
  children: React.ReactNode;
}) {
  return (
    <div className="feature">
      <span className="feature-icon" aria-hidden="true">
        <UseAnimations animation={animation} size={28} strokeColor="#11131a" />
      </span>
      <span>{children}</span>
    </div>
  );
}

function Features() {
  return (
    <div className="feature-row">
      <Feature animation={home}>
        Актуальные
        <br />
        новостройки
      </Feature>
      <Feature animation={heart}>
        Ваши
        <br />
        избранные
      </Feature>
      <Feature animation={activity}>
        Удобное
        <br />
        сравнение
      </Feature>
    </div>
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
          Открыть PULSE
          <UseAnimations
            animation={arrowRightCircle}
            size={20}
            strokeColor="#ffffff"
          />
        </a>
      </header>

      <section className="hero">
        <div className="copy">
          <div className="eyebrow">НОВОСТРОЙКИ ПРИМОРЬЯ</div>

          <h1>
            Новостройки
            <br />
            Приморья —
            <br />
            <em>в одном приложении.</em>
          </h1>

          <p>
            Сравнивайте ЖК и квартиры, сохраняйте варианты и выбирайте
            подходящее в одном понятном сервисе.
          </p>

          <div className="cta-row">
            <a
              className="primary hero-cta"
              href={PULSE_BOT_URL}
              target="_blank"
              rel="noreferrer"
            >
              <span>Открыть PULSE</span>
              <UseAnimations
                animation={arrowRightCircle}
                size={24}
                strokeColor="#ffffff"
              />
            </a>
            <QrPlaceholder />
          </div>

          <div className="desktop-meta">
            <Features />
            <div className="social-row">
              <a href="https://instagram.com" target="_blank" rel="noreferrer">
                <UseAnimations
                  animation={instagram}
                  size={20}
                  strokeColor="#69707b"
                />
                Мы в Instagram
              </a>
              <i />
              <a href={PULSE_BOT_URL} target="_blank" rel="noreferrer">
                <Send size={19} />
                Мы в Telegram
              </a>
            </div>
          </div>
        </div>

        <div className="visual">
          <div className="hand-note top-note">
            Ближе
            <br />к вашему завтра
          </div>

          <div className="visual-orbit" aria-hidden="true" />
          <img
            src="./hero-visual.svg"
            alt="Приложение PULSE.DV на двух смартфонах"
          />

          <div className="hand-note side-note">
            Живите там,
            <br />
            где вдохновляет
          </div>
        </div>

        <div className="mobile-meta">
          <Features />
        </div>
      </section>

      <footer className="footer">
        <span>PULSE.DV</span>
        <i />
        <span>Больше, чем квадратные метры</span>
      </footer>
    </main>
  );
}
