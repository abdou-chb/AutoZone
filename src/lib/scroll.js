let smoothScroll = null;

export function setSmoothScroll(instance) {
  smoothScroll = instance;
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function scrollToSection(id) {
  const target = document.getElementById(id);

  if (!target) {
    return false;
  }

  if (smoothScroll) {
    smoothScroll.resize();
    smoothScroll.scrollTo(target, { duration: 1.1, immediate: reducedMotion() });
  } else {
    target.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  }

  return true;
}

export function scrollToTop() {
  if (smoothScroll) {
    smoothScroll.scrollTo(0, { duration: 0.9, immediate: reducedMotion() });
  } else {
    window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  }
}

export function jumpTo(top) {
  if (smoothScroll) {
    smoothScroll.resize();
    smoothScroll.scrollTo(top, { immediate: true, force: true });
  } else {
    window.scrollTo({ top, behavior: "instant" });
  }
}

export function pauseScrolling() {
  smoothScroll?.stop();
}

export function resumeScrolling() {
  smoothScroll?.start();
}

let pendingGlide = false;
let releaseTimer = 0;

function releaseHeight() {
  window.clearTimeout(releaseTimer);

  const main = document.getElementById("main");

  if (main) {
    main.style.minHeight = "";
  }
}

export function prepareZoneSwitch() {
  const main = document.getElementById("main");

  if (!main || window.scrollY < 8) {
    pendingGlide = false;
    return;
  }

  main.style.minHeight = `${main.offsetHeight}px`;
  pendingGlide = true;
  window.clearTimeout(releaseTimer);
  releaseTimer = window.setTimeout(releaseHeight, 2500);
}

export function takeZoneSwitch() {
  const pending = pendingGlide;

  pendingGlide = false;

  return pending;
}

export function glideToTop() {
  if (reducedMotion() || window.scrollY < 8) {
    jumpTo(0);
    releaseHeight();
    return;
  }

  window.requestAnimationFrame(() =>
    window.requestAnimationFrame(() => {
      if (smoothScroll) {
        smoothScroll.scrollTo(0, {
          duration: Math.min(1, Math.max(0.55, 0.45 + window.scrollY / 9000)),
          easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
          force: true,
          onComplete: releaseHeight,
        });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
        releaseTimer = window.setTimeout(releaseHeight, 900);
      }
    })
  );
}
