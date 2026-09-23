/* Decorative motion only. Every Telegram CTA is a native external link.
 * Lottie icons play once per page visit, then remain on their final frame.
 */
(() => {
  'use strict';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const visual = document.querySelector('.hero-visual');
  const stage = document.querySelector('.visual-stage');
  const art = document.querySelector('.art-interaction');
  const players = [];
  let pointerFrame = 0;

  if ('IntersectionObserver' in window) {
    if (!reducedMotion.matches) document.documentElement.classList.add('js-reveal');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.target === visual) visual.classList.toggle('is-in-view', entry.isIntersecting);
        else if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    observer.observe(visual);
    document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
  } else visual.classList.add('is-in-view');

  // True Lottie SVG animations, with a static fallback and no replay handlers.
  if (!reducedMotion.matches && window.lottie && window.PULSE_ICON_ANIMATIONS) {
    document.querySelectorAll('[data-lottie]').forEach(element => {
      const data = window.PULSE_ICON_ANIMATIONS[element.dataset.lottie];
      if (!data) return;
      const host = document.createElement('span');
      host.className = 'lottie-host';
      host.setAttribute('aria-hidden', 'true');
      element.append(host);
      try {
        const animation = window.lottie.loadAnimation({
          container: host,
          renderer: 'svg',
          loop: false,
          autoplay: false,
          animationData: JSON.parse(JSON.stringify(data)),
          rendererSettings: { preserveAspectRatio: 'xMidYMid meet' }
        });
        const player = { animation, element, started: false, complete: false, timer: 0, observer: null };
        players.push(player);
        element.dataset.animationState = 'ready';
        const startOnce = () => {
          if (player.started || reducedMotion.matches) return;
          player.started = true;
          player.observer?.disconnect();
          const delay = parseFloat(getComputedStyle(element.closest('.benefit')).getPropertyValue('--delay')) || 0;
          player.timer = window.setTimeout(() => {
            if (reducedMotion.matches) return;
            element.classList.add('lottie-ready');
            element.dataset.animationState = 'playing';
            animation.goToAndPlay(0, true);
          }, delay + 160);
        };
        animation.addEventListener('complete', () => {
          player.complete = true;
          element.dataset.animationState = 'complete';
        });
        animation.addEventListener('data_failed', () => {
          element.classList.remove('lottie-ready');
          element.dataset.animationState = 'fallback';
        });
        const onReady = () => {
          if ('IntersectionObserver' in window) {
            player.observer = new IntersectionObserver(entries => {
              if (entries.some(entry => entry.isIntersecting)) startOnce();
            }, { threshold: 0.4 });
            player.observer.observe(element);
          } else startOnce();
        };
        if (animation.isLoaded) onReady();
        else animation.addEventListener('DOMLoaded', onReady);
      } catch {
        host.remove(); // The original SVG remains visible when the player fails.
      }
    });
  }

  stage.addEventListener('pointermove', event => {
    if (reducedMotion.matches || !finePointer.matches) return;
    cancelAnimationFrame(pointerFrame);
    pointerFrame = requestAnimationFrame(() => {
      const rect = stage.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
      const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
      art.style.setProperty('--art-x', `${x * 5}px`);
      art.style.setProperty('--art-y', `${y * 3}px`);
      art.style.setProperty('--art-rotate', `${x * .25}deg`);
    });
  }, { passive: true });
  function resetArt() {
    cancelAnimationFrame(pointerFrame);
    art.style.removeProperty('--art-x');
    art.style.removeProperty('--art-y');
    art.style.removeProperty('--art-rotate');
  }
  stage.addEventListener('pointerleave', resetArt);
  reducedMotion.addEventListener('change', () => {
    resetArt();
    if (reducedMotion.matches) {
      document.documentElement.classList.remove('js-reveal');
      players.forEach(player => {
        clearTimeout(player.timer);
        player.observer?.disconnect();
        player.animation.goToAndStop(player.animation.totalFrames - 1, true);
        player.complete = true;
        player.element.dataset.animationState = 'complete';
      });
    }
  });
  document.addEventListener('visibilitychange', () => {
    document.documentElement.classList.toggle('is-paused', document.hidden);
    if (document.hidden) resetArt();
    players.forEach(player => {
      if (!player.started || player.complete || reducedMotion.matches) return;
      if (document.hidden) player.animation.pause();
      else if (player.element.dataset.animationState === 'playing') player.animation.play();
    });
  });
})();
