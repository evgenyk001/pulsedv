import React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { recordPulseEvent } from "../../../../packages/pulse-data";
import styles from "./MortgageStoryOnboarding.module.css";

export const MORTGAGE_STORY_VERSION = "mortgage_intro_v5";
export const MORTGAGE_STORY_STORAGE = "pulse_mortgage_intro_version";
const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const slides = [
  {
    eyebrow: "ПРОГРАММА ПОД ВАШУ ЗАДАЧУ",
    title: "Начните с выбора",
    body: "Выберите ипотечную программу и тип недвижимости. Условия расчёта изменятся под ваш сценарий.",
    image: `${base}/_cdn/static/mortgage-v5-programs.webp`,
    alt: "Современный дом и карточки ипотечных программ",
  },
  {
    eyebrow: "ВАШ КОМФОРТНЫЙ ПЛАТЁЖ",
    title: "Настройте под себя",
    body: "Меняйте стоимость, первый взнос и срок. Сразу увидите, как меняется ежемесячный платёж.",
    image: `${base}/_cdn/static/mortgage-v5-payment.webp`,
    alt: "Калькулятор и три регулятора параметров ипотеки",
  },
  {
    eyebrow: "СЛЕДУЮЩИЙ ШАГ — ВМЕСТЕ",
    title: "От расчёта к решению",
    body: "Расчёт здесь предварительный. Нажмите «Получить точный расчёт» в разделе ипотеки — обсудим условия с вами.",
    image: `${base}/_cdn/static/mortgage-v5-adviser.webp`,
    alt: "Результат расчёта, сообщения и ключ от квартиры",
  },
];

export function warmMortgageArtwork(){
  const image=new Image();
  image.decoding="async";
  image.fetchPriority="low";
  image.src=slides[0].image;
}

export function MortgageStoryOnboarding({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = React.useState(0);
  const [cycle, setCycle] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [hidden, setHidden] = React.useState(document.hidden);
  const [ready, setReady] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);
  const [retry, setRetry] = React.useState(0);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const dialog = React.useRef<HTMLDialogElement>(null);
  const press = React.useRef<{ x: number; at: number } | null>(null);
  const finished = React.useRef(false);
  const slide = slides[index];

  const finish = React.useCallback((eventType: "mortgage_intro_complete" | "mortgage_intro_skip") => {
    if (finished.current) return;
    finished.current = true;
    try { localStorage.setItem(MORTGAGE_STORY_STORAGE, MORTGAGE_STORY_VERSION); } catch { /* Storage may be unavailable in private mode. */ }
    recordPulseEvent({ eventType, entityType: "onboarding", entityId: MORTGAGE_STORY_VERSION });
    onDone();
  }, [onDone]);

  const goTo = React.useCallback((position: number) => {
    const nextIndex = Math.max(0, Math.min(slides.length - 1, position));
    setCycle(value => value + 1);
    setPaused(false);
    setIndex(nextIndex);
    recordPulseEvent({ eventType: "mortgage_intro_slide", entityType: "onboarding", entityId: String(nextIndex + 1) });
  }, []);
  const next = () => index === slides.length - 1 ? finish("mortgage_intro_complete") : goTo(index + 1);

  React.useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    dialog.current?.showModal();
    dialog.current?.focus({ preventScroll: true });
    document.body.style.overflow = "hidden";
    window.dispatchEvent(new CustomEvent("pulse:story-overlay", { detail: { open: true } }));
    recordPulseEvent({ eventType: "mortgage_intro_open", entityType: "onboarding", entityId: MORTGAGE_STORY_VERSION });
    const onVisibility = () => { setHidden(document.hidden); setPaused(false); press.current = null; };
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => setReducedMotion(media.matches);
    onMotion();
    media.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.dispatchEvent(new CustomEvent("pulse:story-overlay", { detail: { open: false } }));
      document.removeEventListener("visibilitychange", onVisibility);
      media.removeEventListener("change", onMotion);
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  // Give the visible artwork priority, then warm the next slide.
  React.useEffect(() => {
    if (ready !== slide.image || !slides[index + 1]) return;
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = "low";
    image.src = slides[index + 1].image;
  }, [index, ready, slide.image]);

  const pointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    press.current = { x: event.clientX, at: performance.now() };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setPaused(true);
  };
  const pointerUp = (side: "left" | "right") => (event: React.PointerEvent<HTMLButtonElement>) => {
    const start = press.current;
    press.current = null;
    setPaused(false);
    if (!start) return;
    const distance = event.clientX - start.x;
    if (Math.abs(distance) > 42) { distance < 0 ? next() : goTo(index - 1); return; }
    if (performance.now() - start.at < 280) side === "right" ? next() : goTo(index - 1);
  };

  return createPortal(<dialog
    ref={dialog}
    tabIndex={-1}
    className={styles.overlay}
    aria-describedby="mortgage-story-description"
    aria-label="Знакомство с ипотекой"
    onCancel={event => { event.preventDefault(); finish("mortgage_intro_skip"); }}
    onKeyDown={event => {
      if (event.key === "ArrowRight") { event.preventDefault(); next(); }
      if (event.key === "ArrowLeft") { event.preventDefault(); goTo(index - 1); }
    }}
  >
    <div className={styles.stage}>
      <div className={styles.progress} aria-label={`Экран ${index + 1} из ${slides.length}`}>
        {slides.map((_, position) => <span key={position} className={position < index ? styles.done : ""}>
          {position === index && <i key={`${index}-${cycle}-${retry}`} style={{ animationPlayState: ready === slide.image && !paused && !hidden && !reducedMotion ? "running" : "paused" }} onAnimationEnd={next} />}
        </span>)}
      </div>
      <header className={styles.header}>
        <span className={styles.brand}>PULSE<span> · ИПОТЕКА</span></span>
        <button className={styles.close} type="button" aria-label="Закрыть знакомство с ипотекой" onClick={() => finish("mortgage_intro_skip")}><X size={20} strokeWidth={1.6} /></button>
      </header>
      <div className={styles.slide}>
        <div className={styles.art} aria-busy={ready !== slide.image && failed !== slide.image}>
          {failed === slide.image ? <div className={styles.error}>
            <p>Не удалось загрузить иллюстрацию</p>
            <button type="button" onClick={() => { setFailed(null); setRetry(value => value + 1); }}>Повторить</button>
          </div> : <img
            key={`${slide.image}-${retry}`}
            className={styles.artImage}
            src={slide.image}
            alt={slide.alt}
            width={900} height={900}
            draggable={false} decoding="async" loading="eager" fetchPriority={index === 0 ? "high" : "auto"}
            onLoad={async event => {
              const image = event.currentTarget;
              try { await image.decode(); } catch { /* onLoad already confirms a usable image. */ }
              if (image.isConnected) setReady(slide.image);
            }}
            onError={() => setFailed(slide.image)}
          />}
        </div>
        <div className={styles.copy} key={index} aria-live="polite">
          <p className={styles.eyebrow}>{slide.eyebrow}</p>
          <h2 id="mortgage-story-title">{slide.title}</h2>
          <p id="mortgage-story-description" className={styles.description}>{slide.body}</p>
        </div>
      </div>
      <footer className={styles.hint}>Коснитесь справа, чтобы {index === slides.length - 1 ? "перейти к расчёту" : "продолжить"}</footer>
      {(["left", "right"] as const).map(side => <button
        key={side} type="button"
        className={`${styles.tapZone} ${side === "left" ? styles.tapLeft : styles.tapRight}`}
        aria-label={side === "left" ? "Предыдущая история" : index === slides.length - 1 ? "Перейти к расчёту" : "Следующая история"}
        onPointerDown={pointerDown} onPointerUp={pointerUp(side)}
        onPointerCancel={() => { press.current = null; setPaused(false); }}
        onClick={event => { if (event.detail === 0) side === "right" ? next() : goTo(index - 1); }}
      />)}
    </div>
  </dialog>, document.body);
}
