import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowLeftRight, Armchair, CarFront, Disc3, Gauge, Lightbulb, ListChecks, Palette, Redo2, Rotate3d, RotateCcw, ScanEye, Shapes, Undo2, Wrench, X } from "lucide-react";
import Logo from "../../components/Logo";
import { LanguageMenu, ThemeToggle } from "../../components/Preferences";
import ZoneSwitcher from "../../components/ZoneSwitcher";
import { useI18n } from "../../i18n/i18n-context";
import { useCategory } from "../../lib/category-context";
import { useTheme } from "../../lib/theme";
import useMediaQuery from "../../lib/useMediaQuery";
import { HOTSPOTS } from "./camera-stops";
import { factoryFor, GROUPS, changedGroups, componentOf, optionKey, sectionOf, sectionsFor, viewFor, viewOf } from "./options";
import { VehicleContext } from "./vehicle-context";
import VehicleSelector from "./VehicleSelector";
import { DEFAULT_VEHICLE, hasGroup, vehicleById } from "./vehicles";
import LightLooks from "./LightLooks";
import PerformancePanel from "./PerformancePanel";
import PriceSummary from "./PriceSummary";
import { money, priceOf, quoteFor } from "./pricing";
import SceneBoundary from "./SceneBoundary";
import SectionPanel from "./SectionPanel";
import SummaryPanel from "./SummaryPanel";
import useConfiguration from "./useConfiguration";
import "./tuning.css";

const TuningScene = lazy(() => import("./TuningScene"));
const RequestExperience = lazy(() => import("./request/RequestExperience"));
const RepairExperience = lazy(() => import("./repair/RepairExperience"));

// Camera views of each lamp: [lights off, lights on].
const LAMP_VIEWS = { frontLights: ["frontLit", "frontLitOn"], rearLights: ["rearLit", "rearLitOn"] };
const LAMP_ROWS = { frontLighting: "frontLights", rearLighting: "rearLights" };

const SECTION_ICONS = {
  exterior: CarFront,
  wheels: Disc3,
  lights: Lightbulb,
  details: Shapes,
  interior: Armchair,
  ambient: Palette,
  performance: Gauge,
  summary: ListChecks,
};

function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");

    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function TuningZone() {
  const { t, dir } = useI18n();
  const mode = useTheme();
  const category = useCategory();
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [supported] = useState(webglAvailable);
  // chosen: the car asked for in the selector. presented: the car on the floor, which the panels describe (they differ
  // while the two swap places).
  const [chosen, setChosen] = useState(DEFAULT_VEHICLE.id);
  const [presented, setPresented] = useState(DEFAULT_VEHICLE.id);
  const [carsMoving, setCarsMoving] = useState(false);
  // The request scene, over the page; the configurator's 3D view is put away meanwhile (one WebGL context at a time).
  const [requesting, setRequesting] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const swapping = chosen !== presented || carsMoving;
  const vehicle = vehicleById(presented);
  const sections = useMemo(() => sectionsFor(vehicle), [vehicle]);
  const { setup, setups, change, reset, undo, redo, canUndo, canRedo } = useConfiguration(vehicle);
  // The presented car's price, derived from its setup (pricing.js): the pill, the breakdown and the summary share it.
  const quote = useMemo(() => quoteFor(setup, vehicle), [setup, vehicle]);
  const [comparing, setComparing] = useState(false);
  const [free, setFree] = useState(null);
  // focus: a camera view other than the section's own. detail: the component whose options are open.
  const [focus, setFocus] = useState(null);
  const [detail, setDetail] = useState(null);
  const [pulse, setPulse] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(sections[0].id);
  const progressRef = useRef(0);
  const invalidateRef = useRef(null);
  const framingRef = useRef(null);
  const sectionRefs = useRef({});
  const focusRef = useRef(null);
  const sectionsRef = useRef(sections);
  const vehicleRef = useRef(vehicle);
  const setupRef = useRef(setup);
  const detailRef = useRef(null);
  const exploreRef = useRef(null);
  const pendingSpot = useRef(null);
  const updateRef = useRef(null);

  useEffect(() => {
    document.title = t("tuning.documentTitle", { car: `${vehicle.make} ${vehicle.model}` });
  }, [t, vehicle]);

  useEffect(() => {
    focusRef.current = focus;
    detailRef.current = detail;
  }, [focus, detail]);

  useEffect(() => {
    setupRef.current = setup;
  }, [setup]);

  // A new car brings its own sections: the scroll stops are measured again.
  useEffect(() => {
    sectionsRef.current = sections;
    vehicleRef.current = vehicle;
    updateRef.current?.();
  }, [sections, vehicle]);

  useEffect(() => {
    function update() {
      const ids = sectionsRef.current.map((section) => section.id);
      const nodes = ids.map((id) => sectionRefs.current[id]);

      if (nodes.some((node) => !node)) {
        return;
      }

      // A camera stop is reached when its section's top meets the line the browser scrolls sections to
      // (the top of the window minus the site's scroll padding), so a section opened from the steps is fully reached.
      const y = window.scrollY + (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0);
      const tops = nodes.map((node) => node.getBoundingClientRect().top + window.scrollY);
      let progress = 0;

      for (let index = 0; index < tops.length - 1; index += 1) {
        if (y >= tops[index + 1]) {
          progress = index + 1;
        } else {
          progress = index + Math.max(0, (y - tops[index]) / (tops[index + 1] - tops[index]));
          break;
        }
      }

      const current = ids[Math.min(Math.round(progress), ids.length - 1)];

      progressRef.current = progress;
      setActive(current);

      // Leaving a section closes its component and gives the camera back to the scroll.
      if (focusRef.current && focusRef.current.section !== current) {
        focusRef.current = null;
        setFocus(null);
      }

      if (detailRef.current && detailRef.current.section !== current) {
        detailRef.current = null;
        setDetail(null);
      }

      invalidateRef.current?.();
    }

    updateRef.current = update;
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // The 360° view owns wheel and touch gestures, so the page must not scroll under it.
  useEffect(() => {
    if (!free) {
      return undefined;
    }

    const root = document.documentElement;
    const previous = root.style.overflow;
    const explore = exploreRef.current;

    root.style.overflow = "hidden";

    return () => {
      root.style.overflow = previous;
      explore?.focus({ preventScroll: true });
    };
  }, [free]);

  useEffect(() => {
    invalidateRef.current?.();
  }, [focus, free, comparing, setup]);

  useEffect(() => {
    if (!highlight) {
      return undefined;
    }

    const timer = setTimeout(() => setHighlight(null), 1600);

    return () => clearTimeout(timer);
  }, [highlight]);

  // On phones the steps scroll sideways: keep the current one in sight.
  useEffect(() => {
    const step = document.querySelector(".tz-step.is-active");
    const list = step?.closest("ol");

    if (list && list.scrollWidth > list.clientWidth) {
      const box = list.getBoundingClientRect();
      const item = step.getBoundingClientRect();

      list.scrollBy({ left: item.left + item.width / 2 - (box.left + box.width / 2), behavior: reduceMotion ? "auto" : "smooth" });
    }
  }, [active, reduceMotion]);

  const describe = useCallback((group, id) => `${t(`tuning.groups.${group}`)}: ${t(optionKey(group, id, vehicleRef.current))}`, [t]);

  // What a choice costs and the new total, for screen readers.
  const priced = useCallback(
    (text, changes) => {
      const car = vehicleRef.current;
      const prices = Object.entries(changes).map(([group, id]) => priceOf(car, group, id));

      if (prices.every((price) => price === null)) {
        return text;
      }

      const total = money(t, quoteFor({ ...setupRef.current, ...changes }, car).total);
      const price = prices.length === 1 ? (prices[0] ? money(t, prices[0], { sign: true }) : t("tuning.pricing.included")) : null;

      return t("tuning.pricing.announce", { change: price ? `${text}, ${price}` : text, total });
    },
    [t],
  );

  const choose = useCallback(
    (group, id) => {
      setComparing(false);
      change({ [group]: id });
      setAnnouncement(priced(describe(group, id), { [group]: id }));

      // Switching a lamp on moves the camera in on it as it lights; switching it off steps back.
      if (LAMP_VIEWS[group]) {
        const next = { view: LAMP_VIEWS[group][id === "off" ? 0 : 1], section: sectionOf(group).id };

        focusRef.current = next;
        setFocus(next);
        return;
      }

      if (GROUPS[group].view && !detailRef.current) {
        const next = { view: viewFor(GROUPS[group].view, vehicleRef.current), section: sectionOf(group).id };

        focusRef.current = next;
        setFocus(next);
      }
    },
    [change, describe, priced],
  );

  // `group`: a row of the component list, or a group shown under one (a hotspot, the summary).
  const openComponent = useCallback((group) => {
    const row = componentOf(group);
    const section = sectionOf(row).id;
    const lamp = LAMP_ROWS[row];
    const view = lamp ? LAMP_VIEWS[lamp][setupRef.current[lamp] === "off" ? 0 : 1] : viewFor(viewOf(row), vehicleRef.current);
    const next = { view, section };

    focusRef.current = next;
    detailRef.current = { section, group: row };
    setFocus(next);
    setDetail({ section, group: row });
    setPulse({ group: row, key: Date.now() });
  }, []);

  const applyLook = useCallback(
    (look) => {
      setComparing(false);
      change(look.setup);
      setAnnouncement(priced(t(`tuning.lighting.looks.${look.id}`), look.setup));

      const next = { view: LAMP_VIEWS.frontLights[1], section: "lights" };

      focusRef.current = next;
      setFocus(next);
    },
    [change, t, priced],
  );

  const closeComponent = useCallback(() => {
    focusRef.current = null;
    detailRef.current = null;
    setFocus(null);
    setDetail(null);
  }, []);

  const showView = useCallback((view, sectionId) => {
    const section = sectionsRef.current.find((item) => item.id === sectionId);
    const next = view === section.view ? null : { view, section: sectionId };

    focusRef.current = next;
    setFocus(next);
  }, []);

  function showOverview() {
    const next = { view: "hero", section: active };

    focusRef.current = next;
    detailRef.current = null;
    setDetail(null);
    setFocus(next);
  }

  const revert = useCallback((group) => change({ [group]: factoryFor(vehicleRef.current)[group] }), [change]);

  // Remove from the price breakdown: the option goes back to the car's factory one (one undo step).
  const removeOption = useCallback(
    (group, option) => {
      const car = vehicleRef.current;
      const changes = { [group]: factoryFor(car)[group] };

      setComparing(false);
      change(changes);
      setAnnouncement(t("tuning.pricing.announceRemoved", { option: describe(group, option), total: money(t, quoteFor({ ...setupRef.current, ...changes }, car).total) }));
    },
    [change, describe, t],
  );

  const resetAll = useCallback(() => {
    setComparing(false);
    reset();
    setAnnouncement(t("tuning.stage.resetDone"));
  }, [reset, t]);

  function step(direction) {
    setComparing(false);
    (direction === "undo" ? undo : redo)();
    setAnnouncement(t(direction === "undo" ? "tuning.stage.undone" : "tuning.stage.redone"));
  }

  // Keyboard: Escape leaves 360° or the open component; Ctrl/⌘+Z and Ctrl/⌘+Shift+Z (or Ctrl+Y) undo and redo.
  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") {
        if (free) {
          setFree(null);
        } else if (detailRef.current) {
          closeComponent();
        }

        return;
      }

      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (!mod || event.target.closest?.("input[type=text], textarea, [contenteditable]")) {
        return;
      }

      if (key === "z" && !event.shiftKey && canUndo) {
        event.preventDefault();
        step("undo");
      } else if (((key === "z" && event.shiftKey) || key === "y") && canRedo) {
        event.preventDefault();
        step("redo");
      }
    }

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  });

  const goTo = useCallback((id, instant = false) => {
    const behavior = reduceMotion || instant ? "auto" : "smooth";

    focusRef.current = null;
    detailRef.current = null;
    setFocus(null);
    setDetail(null);

    if (id === sectionsRef.current[0].id) {
      window.scrollTo({ top: 0, behavior });
    } else {
      sectionRefs.current[id]?.scrollIntoView({ behavior, block: "start" });
    }

    // An instant jump does not always fire a scroll event right away.
    if (behavior === "auto") {
      updateRef.current?.();
    }
  }, [reduceMotion]);

  const openHotspot = useCallback((spot) => {
    pendingSpot.current = spot;
    setFree(null);
  }, []);

  // Free space for the car, in canvas pixels: between the option panel and the section rail on wide screens; between
  // the console and the option sheet (where it rests once its section is reached) on phones.
  // Layout sizes, not transformed boxes, so the panels' slide-in does not skew it.
  const measureFraming = useCallback(() => {
    const canvas = document.querySelector(".tz-canvas");
    const section = document.querySelector(".tz-section.is-active") || document.querySelector(".tz-section");
    const panel = section?.querySelector(".tz-panel");
    const rail = document.querySelector(".tz-steps");

    if (canvas && panel && window.innerWidth <= 860) {
      const stage = canvas.getBoundingClientRect();
      const bar = document.querySelector(".tz-console");
      const first = section === document.querySelector(".tz-section");
      const box = section.getBoundingClientRect();
      const rest = first ? box.top + window.scrollY : parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      const sheet = rest + section.offsetHeight - parseFloat(getComputedStyle(section).paddingBottom) - panel.offsetHeight;
      const top = bar ? bar.getBoundingClientRect().bottom + 6 : stage.top + 0.2 * stage.height;

      framingRef.current = { phone: true, top: top - stage.top, bottom: sheet - 6 - stage.top };
      invalidateRef.current?.();
      return;
    }

    if (!canvas || !panel || !rail || window.innerWidth <= 860) {
      framingRef.current = null;
      return;
    }

    const rtl = document.documentElement.dir === "rtl";
    const stage = canvas.getBoundingClientRect();
    const box = section.getBoundingClientRect();
    const style = getComputedStyle(section);
    const panelStart = rtl ? box.right - parseFloat(style.paddingRight) : box.left + parseFloat(style.paddingLeft);
    const panelEnd = rtl ? panelStart - panel.offsetWidth : panelStart + panel.offsetWidth;
    const railBox = rail.getBoundingClientRect();

    framingRef.current = {
      left: (rtl ? railBox.right : panelEnd) - stage.left,
      right: (rtl ? panelEnd : railBox.left) - stage.left,
    };
    invalidateRef.current?.();
  }, []);

  // The sheet's height changes with the section and the open component on phones.
  useLayoutEffect(() => {
    measureFraming();
  }, [dir, ready, active, detail, presented, measureFraming]);

  useEffect(() => {
    window.addEventListener("resize", measureFraming);
    document.fonts?.ready.then(measureFraming);

    return () => window.removeEventListener("resize", measureFraming);
  }, [measureFraming]);

  // A change of reading direction moves the panel to the other side while the car drives across: the panel
  // waits until the car has left its new place, then slides in. The attribute alternates so the animation restarts.
  const [swap, setSwap] = useState({ dir, count: 0 });

  if (swap.dir !== dir) {
    setSwap({ dir, count: swap.count + 1 });
  }

  // Runs once the 360° view has closed and the page can scroll again.
  useEffect(() => {
    const spot = pendingSpot.current;

    if (free || !spot) {
      return;
    }

    pendingSpot.current = null;
    sectionRefs.current[spot.section]?.scrollIntoView({ block: "start" });
    // A jump right after the scroll lock is released does not always fire a scroll event.
    updateRef.current?.();
    openComponent(spot.group);
  }, [free, openComponent]);

  const onReady = useCallback(() => setReady(true), []);
  // Compare shows the car on the floor as it left the factory; the other cars keep their own setups.
  const sceneSetups = useMemo(() => (comparing ? { ...setups, [presented]: { present: factoryFor(vehicleById(presented)) } } : setups), [comparing, setups, presented]);
  const changes = changedGroups(setup, vehicle).length;
  // Section contents are built once per change, so the memoised panels skip re-rendering while the page scrolls.
  const toggleCompare = useCallback(() => setComparing((value) => !value), []);
  const editGroup = useCallback(
    (group) => {
      goTo(sectionOf(group).id, true);
      openComponent(group);
      setHighlight(group);
    },
    [goTo, openComponent],
  );
  const openRequest = useCallback(() => {
    setFree(null);
    setComparing(false);
    setRequesting(true);
  }, []);
  const closeRequest = useCallback(() => setRequesting(false), []);
  const openRepair = useCallback(() => {
    setFree(null);
    setRepairing(true);
  }, []);
  const closeRepair = useCallback(() => setRepairing(false), []);
  const extras = useMemo(
    () => ({
      performance: <PerformancePanel powertrain={setup.powertrain} stage={setup.stage} />,
      lights: <LightLooks setup={setup} onApply={applyLook} />,
      summary: <SummaryPanel setup={setup} quote={quote} onRevert={revert} onReset={resetAll} comparing={comparing} onCompare={toggleCompare} onEdit={editGroup} onRequest={openRequest} />,
    }),
    [setup, quote, revert, resetAll, comparing, toggleCompare, editGroup, applyLook, openRequest],
  );
  // Hotspots only for parts this car has.
  const spots = useMemo(() => HOTSPOTS.filter((spot) => hasGroup(vehicle, spot.group) && sections.some((section) => section.id === spot.section)), [vehicle, sections]);
  // A new car: the page goes back to the top, components close, 360° ends; the cars swap once the next one has loaded.
  const selectVehicle = useCallback(
    (id) => {
      if (id === chosen) {
        return;
      }

      setFree(null);
      setComparing(false);
      goTo(sectionsRef.current[0].id);
      setChosen(id);
      const next = vehicleById(id);

      setAnnouncement(t("tuning.showroom.coming", { car: `${next.make} ${next.model}` }));
    },
    [chosen, goTo, t],
  );
  const presentedChanged = useCallback(
    (id) => {
      if (id === vehicleRef.current.id) {
        return;
      }

      const next = vehicleById(id);

      setPresented(id);
      setAnnouncement(t("tuning.showroom.arrived", { car: `${next.make} ${next.model}` }));
    },
    [t],
  );

  const hotspotLabels = useMemo(() => Object.fromEntries(HOTSPOTS.map((spot) => [spot.id, t(`tuning.hotspots.${spot.id}`)])), [t]);

  return (
    <VehicleContext.Provider value={vehicle}>
    <div className={`tz${free ? " is-free" : ""}${swapping ? " is-swapping" : ""}`} data-mode={mode} data-swap={swap.count ? (swap.count % 2 ? "a" : "b") : undefined} inert={requesting || repairing || undefined}>
      <ZoneSwitcher />
      <header className="tz-bar">
        <Logo to="/tuning" brand="TuningZone" label={t("nav.home", { brand: "TuningZone" })} />
        <div className="tz-bar__tools">
          {supported && ready && (
            <button type="button" className="tz-bar__repair" onClick={openRepair} title={t("tuning.repair.ctaHint")}>
              <Wrench size={16} aria-hidden="true" />
              <span>{t("tuning.repair.cta")}</span>
            </button>
          )}
          <Link to={category.home} className="tz-bar__back">
            <ArrowLeft size={18} aria-hidden="true" className="flip-rtl" />
            <span>{t("tuning.back", { brand: category.brand })}</span>
          </Link>
          <LanguageMenu />
          <ThemeToggle />
        </div>
      </header>

      <div className="tz-stage">
        {supported && (requesting || repairing) ? null : supported ? (
          <SceneBoundary
            onError={() => setFailed(true)}
            fallback={
              <div className="tz-unsupported" role="alert">
                <p>{t("tuning.modelError")}</p>
              </div>
            }
          >
            <Suspense fallback={null}>
              <TuningScene
                vehicleId={chosen}
                setups={sceneSetups}
                onPresented={presentedChanged}
                onSwapping={setCarsMoving}
                sections={sections}
                spots={spots}
                progressRef={progressRef}
                invalidateRef={invalidateRef}
                framingRef={framingRef}
                focusView={focus?.view || null}
                free={free}
                mode={mode}
                reduceMotion={reduceMotion}
                onReady={onReady}
                hotspotLabels={hotspotLabels}
                onHotspot={openHotspot}
                pulse={pulse}
                dir={dir}
                inspecting={active === "lights" && !free}
              />
            </Suspense>
          </SceneBoundary>
        ) : (
          <div className="tz-unsupported" role="alert">
            <p>{t("tuning.noWebgl")}</p>
          </div>
        )}
        {supported && !ready && !failed && (
          <div className="tz-loader" role="status">
            <span className="tz-loader__bar" />
            <span>{t("tuning.loading")}</span>
          </div>
        )}
      </div>

      {supported && ready && !free && (
        <div className="tz-console">
          <VehicleSelector chosen={chosen} swapping={swapping} onSelect={selectVehicle} />
          <PriceSummary quote={quote} vehicle={vehicle} onRemove={removeOption} reduceMotion={reduceMotion} comparing={comparing} onRequest={swapping ? null : openRequest} />
        </div>
      )}

      {supported && ready && (
        <div className="tz-toolbar" role="toolbar" aria-label={t("tuning.stage.toolbar")}>
          {free ? (
            <>
              <div className="tz-segment tz-segment--compact" role="radiogroup" aria-label={t("tuning.stage.viewLabel")}>
                {["outside", "inside"].map((id) => (
                  <label key={id} className="tz-segment__item">
                    <input type="radio" name="tz-view" value={id} checked={free === id} onChange={() => setFree(id)} />
                    <span>{t(`tuning.stage.${id}`)}</span>
                  </label>
                ))}
              </div>
              <p className="tz-toolbar__hint">{t(free === "inside" ? "tuning.stage.insideHint" : "tuning.stage.exploreHint")}</p>
              <button type="button" className="tz-btn" onClick={() => setFree(null)}>
                <X size={16} aria-hidden="true" />
                {t("tuning.stage.done")}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="tz-btn tz-btn--quiet" onClick={showOverview} title={t("tuning.stage.overview")}>
                <ScanEye size={16} aria-hidden="true" />
                <span className="tz-btn__label">{t("tuning.stage.overview")}</span>
              </button>
              <button type="button" ref={exploreRef} className="tz-btn" onClick={() => setFree("outside")} title={t("tuning.stage.explore")}>
                <Rotate3d size={16} aria-hidden="true" />
                <span className="tz-btn__label">{t("tuning.stage.explore")}</span>
              </button>
              <span className="tz-toolbar__divider" aria-hidden="true" />
              <button type="button" className="tz-icon-btn" disabled={!canUndo} onClick={() => step("undo")} aria-label={t("tuning.stage.undo")} title={t("tuning.stage.undoKeys")}>
                <Undo2 size={16} aria-hidden="true" />
              </button>
              <button type="button" className="tz-icon-btn" disabled={!canRedo} onClick={() => step("redo")} aria-label={t("tuning.stage.redo")} title={t("tuning.stage.redoKeys")}>
                <Redo2 size={16} aria-hidden="true" />
              </button>
              <span className="tz-toolbar__divider" aria-hidden="true" />
              <button
                type="button"
                className="tz-btn"
                aria-pressed={comparing}
                disabled={!changes}
                onClick={() => setComparing((value) => !value)}
                title={t("tuning.stage.compare")}
              >
                <ArrowLeftRight size={16} aria-hidden="true" />
                <span className="tz-btn__label">{t("tuning.stage.compare")}</span>
              </button>
              <button type="button" className="tz-btn tz-btn--quiet" disabled={!changes} onClick={resetAll} title={t("tuning.stage.reset")}>
                <RotateCcw size={16} aria-hidden="true" />
                <span className="tz-btn__label">{t("tuning.stage.reset")}</span>
              </button>
            </>
          )}
        </div>
      )}

      <p className="visually-hidden" aria-live="polite">
        {comparing ? t("tuning.stage.comparing") : announcement}
      </p>
      {comparing && (
        <p className="tz-compare-badge" aria-hidden="true">
          {t("tuning.stage.comparing")}
        </p>
      )}

      <nav className="tz-steps" aria-label={t("tuning.sectionsLabel")}>
        <ol>
          {sections.map(({ id }, index) => {
            const Icon = SECTION_ICONS[id];

            return (
              <li key={id}>
                <button
                  type="button"
                  className={`tz-step${active === id ? " is-active" : ""}`}
                  aria-current={active === id ? "step" : undefined}
                  onClick={() => goTo(id)}
                >
                  <span className="tz-step__index numeric">{String(index + 1).padStart(2, "0")}</span>
                  <Icon size={16} aria-hidden="true" />
                  <span className="tz-step__label">{t(`tuning.sections.${id}.nav`)}</span>
                  {id === "summary" && changes > 0 && <span className="tz-step__count numeric">{changes}</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <main className="tz-content" id="main" tabIndex={-1}>
        {sections.map((section, index) => (
          <section
            key={section.id}
            id={`tuning-${section.id}`}
            ref={(node) => {
              sectionRefs.current[section.id] = node;
            }}
            className={`tz-section${active === section.id ? " is-active" : ""}`}
            aria-labelledby={`tuning-${section.id}-title`}
          >
            <SectionPanel
              section={section}
              index={index}
              setup={setup}
              detail={detail?.section === section.id ? detail.group : null}
              onOpen={openComponent}
              onBack={closeComponent}
              onChoose={choose}
              focusView={focus?.section === section.id ? focus.view : null}
              onView={showView}
              highlight={highlight}
            >
              {extras[section.id] || null}
            </SectionPanel>
          </section>
        ))}
        {vehicle.id === "golf" ? (
          <p className="tz-credit">
            {t("tuning.credit")}{" "}
            {t("tuning.creditBay.before")}{" "}
            <a href="https://sketchfab.com/3d-models/audi-tfsi-engine2-18f29cb6155e423c904bba7a98ad7f8c" target="_blank" rel="noreferrer">
              Audi TFSI engine2
            </a>{" "}
            {t("tuning.creditBay.by")}{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
              CC BY 4.0
            </a>
            .
          </p>
        ) : (
          <p className="tz-credit">
            {t("tuning.showroom.credit.model")}{" "}
            <a href={vehicle.credit.url} target="_blank" rel="noreferrer">
              {vehicle.credit.title}
            </a>{" "}
            {t("tuning.showroom.credit.by", { author: vehicle.credit.author })}{" "}
            {vehicle.credit.licence === "cc-by" ? (
              <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
                CC BY 4.0
              </a>
            ) : (
              t("tuning.showroom.credit.standard")
            )}
            {". "}
            {t("tuning.showroom.credit.marks", { make: vehicle.make })}
          </p>
        )}
      </main>
    </div>
    {requesting && (
      <Suspense fallback={null}>
        <RequestExperience vehicle={vehicle} setup={setup} quote={quote} reduceMotion={reduceMotion} onClose={closeRequest} />
      </Suspense>
    )}
    {repairing && (
      <Suspense fallback={null}>
        <RepairExperience vehicleId={vehicle.id} reduceMotion={reduceMotion} onClose={closeRepair} />
      </Suspense>
    )}
    </VehicleContext.Provider>
  );
}
