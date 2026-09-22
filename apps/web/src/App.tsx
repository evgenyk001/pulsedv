import { useState } from "react";
import { ArrowRight, Check, Instagram, Send, X } from "lucide-react";

const PULSE_URL = import.meta.env.VITE_PULSE_TG_URL || "";

const steps = [
  { key: "city", title: "Где ищем?", options: ["Владивосток", "Уссурийск", "Артём", "Всё Приморье"] },
  { key: "budget", title: "Какой бюджет?", options: ["до 7 млн ₽", "7–10 млн ₽", "10–15 млн ₽", "от 15 млн ₽"] },
  { key: "purchase", title: "Как планируете покупать?", options: ["Ипотека", "Наличные", "Пока не решил(а)"] }
] as const;

type Answers = Record<string, string>;

function Logo() {
  return (
    <a href="#top" className="logo" aria-label="PULSE.DV">
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <rect x="3" y="20" width="8" height="23" rx="2.5" />
        <rect x="15" y="10" width="8" height="33" rx="2.5" />
        <rect x="27" y="3" width="8" height="40" rx="2.5" />
        <rect x="39" y="15" width="6" height="28" rx="2.5" />
      </svg>
      <span><b>PULSE.DV</b><small>Новостройки Приморья</small></span>
    </a>
  );
}

function Funnel({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState(false);

  const select = (key: string, value: string) => {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    if (step < steps.length - 1) setTimeout(() => setStep(step + 1), 110);
    else setTimeout(() => setStep(steps.length), 110);
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
    <div className="funnel-backdrop" role="dialog" aria-modal="true">
      <button className="funnel-close" onClick={onClose} aria-label="Закрыть"><X size={20} /></button>
      <div className="funnel-card">
        {done ? (
          <div className="funnel-success">
            <span><Check size={26} /></span>
            <h2>Готово</h2>
            <p>Заявка сохранена. После подключения Control Center она будет сразу уходить менеджеру PULSE.DV.</p>
            <button className="btn-primary" onClick={onClose}>Вернуться</button>
          </div>
        ) : step < steps.length ? (
          <>
            <div className="funnel-progress"><i style={{ width: `${((step + 1) / (steps.length + 1)) * 100}%` }} /></div>
            <small>ШАГ {step + 1} ИЗ {steps.length + 1}</small>
            <h2>{steps[step].title}</h2>
            <div className="funnel-options">
              {steps[step].options.map((option) => (
                <button key={option} onClick={() => select(steps[step].key, option)}>
                  {option}<ArrowRight size={17} />
                </button>
              ))}
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="funnel-progress"><i style={{ width: "100%" }} /></div>
            <small>ПОСЛЕДНИЙ ШАГ</small>
            <h2>Куда отправить подборку?</h2>
            <label>Имя<input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ваше имя" /></label>
            <label>Телефон<input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" placeholder="+7 999 000-00-00" /></label>
            <button className="btn-primary full" type="submit">Получить подборку <ArrowRight size={18} /></button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [funnelOpen, setFunnelOpen] = useState(false);

  const openPulse = () => {
    if (PULSE_URL) window.open(PULSE_URL, "_blank", "noopener,noreferrer");
    else setFunnelOpen(true);
  };

  return (
    <main id="top" className="page">
      <header className="header">
        <Logo />
        <div className="header-actions">
          <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>
          <a href="https://t.me" target="_blank" rel="noreferrer" aria-label="Telegram"><Send size={18} /></a>
          <button onClick={() => setFunnelOpen(true)}>Подобрать квартиру <ArrowRight size={17} /></button>
        </div>
      </header>

      <section className="hero">
        <div className="copy">
          <div className="kicker">ВСЕ НОВОСТРОЙКИ ПРИМОРЬЯ</div>
          <h1>Новостройки<br />Приморья —<br /><em>в одном приложении.</em></h1>
          <p>Выбирайте районы, сравнивайте варианты и сохраняйте понравившиеся квартиры — всё в PULSE.DV.</p>

          <div className="cta-row">
            <button className="btn-primary" onClick={() => setFunnelOpen(true)}>
              Подобрать квартиру <ArrowRight size={20} />
            </button>
            <button className="btn-secondary" onClick={openPulse}>
              <Send size={18} /> Открыть PULSE
            </button>
          </div>

          <div className="micro-copy">
            <span><b>01</b> Актуальные новостройки</span>
            <span><b>02</b> Избранное и сравнение</span>
            <span><b>03</b> Подбор под ваш бюджет</span>
          </div>

          <div className="social-copy">
            <a href="https://instagram.com" target="_blank" rel="noreferrer"><Instagram size={17} /> Instagram</a>
            <a href="https://t.me" target="_blank" rel="noreferrer"><Send size={17} /> Telegram</a>
          </div>
        </div>

        <div className="visual-wrap">
          <div className="visual-haze" />
          <img src="./hero-visual.svg" alt="PULSE.DV — приложение для новостроек Приморья" className="hero-visual" />
          <div className="handwriting top">Ближе<br />к вашему завтра</div>
          <div className="handwriting bottom">Приморье<br />в твоём ритме</div>
        </div>
      </section>

      <footer className="footer">
        <span>PULSE.DV</span>
        <i />
        <span>Больше, чем квадратные метры</span>
      </footer>

      {funnelOpen && <Funnel onClose={() => setFunnelOpen(false)} />}
    </main>
  );
}
