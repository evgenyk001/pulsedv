import { useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  Heart,
  Instagram,
  Send,
  X
} from "lucide-react";

const steps = [
  { key: "city", title: "Где ищем квартиру?", options: ["Владивосток", "Уссурийск", "Артём", "Всё Приморье"] },
  { key: "budget", title: "Какой бюджет рассматриваете?", options: ["до 7 млн ₽", "7–10 млн ₽", "10–15 млн ₽", "от 15 млн ₽"] },
  { key: "purchase", title: "Как планируете покупать?", options: ["Ипотека", "Наличные", "Пока не решил(а)"] }
] as const;

type Answers = Record<string, string>;

function Logo() {
  return (
    <div className="logo" aria-label="PULSE.DV">
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <rect x="3" y="20" width="8" height="23" rx="2.5" />
        <rect x="15" y="10" width="8" height="33" rx="2.5" />
        <rect x="27" y="3" width="8" height="40" rx="2.5" />
        <rect x="39" y="15" width="6" height="28" rx="2.5" />
      </svg>
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
    <div className="qr-block" aria-label="QR-код будет подключён к Telegram Mini App">
      <div className="qr">
        {cells.map((cell) => <i className={cell.on ? "on" : ""} key={cell.x + "-" + cell.y} />)}
      </div>
      <span>Откройте<br />на телефоне</span>
    </div>
  );
}

function Funnel({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState(false);

  const select = (key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    if (step < steps.length - 1) setTimeout(() => setStep((s) => s + 1), 120);
    else setTimeout(() => setStep(steps.length), 120);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    localStorage.setItem("pulse-funnel-lead", JSON.stringify({
      ...answers,
      name,
      phone,
      createdAt: new Date().toISOString()
    }));
    setDone(true);
  };

  return (
    <div className="funnel-backdrop" role="dialog" aria-modal="true" aria-label="Подбор квартиры">
      <button className="funnel-close" onClick={onClose} aria-label="Закрыть"><X size={20} /></button>
      <div className="funnel-card">
        {done ? (
          <div className="success">
            <span><Check size={26} /></span>
            <h2>Готово</h2>
            <p>Заявка сохранена. Следующим этапом подключим её напрямую к PULSE Control Center.</p>
            <button className="primary" onClick={onClose}>Закрыть</button>
          </div>
        ) : step < steps.length ? (
          <>
            <div className="progress"><i style={{ width: `${((step + 1) / (steps.length + 1)) * 100}%` }} /></div>
            <small>ШАГ {step + 1} ИЗ {steps.length + 1}</small>
            <h2>{steps[step].title}</h2>
            <div className="options">
              {steps[step].options.map((option) => (
                <button key={option} onClick={() => select(steps[step].key, option)}>
                  {option}<ArrowRight size={17} />
                </button>
              ))}
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="progress"><i style={{ width: "100%" }} /></div>
            <small>ПОСЛЕДНИЙ ШАГ</small>
            <h2>Куда отправить подборку?</h2>
            <label>Имя<input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ваше имя" /></label>
            <label>Телефон<input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" placeholder="+7 999 000-00-00" /></label>
            <button className="primary full" type="submit">Получить подборку <ArrowRight size={18} /></button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [funnelOpen, setFunnelOpen] = useState(false);

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
            <button className="primary hero-cta" onClick={() => setFunnelOpen(true)}>
              Открыть PULSE <ArrowRight size={21} />
            </button>
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
            <a href="https://t.me" target="_blank" rel="noreferrer"><Send size={19} /> Мы в Telegram</a>
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

      {funnelOpen && <Funnel onClose={() => setFunnelOpen(false)} />}
    </main>
  );
}
