import { useEffect, useId, useRef, useState } from "react";
import { ReceiptText, Send, X } from "lucide-react";
import { useI18n } from "../../i18n/i18n-context";
import { optionKey } from "./options";
import { money } from "./pricing";

const FLASH_TIME = 2400;
const COUNT_TIME = 500;

// The shown total runs from its last value to the new one (eased, whole dinars); at once when motion is reduced.
function useCountUp(value, instant) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);

  useEffect(() => {
    const begin = shownRef.current;
    const start = performance.now();
    let frame = 0;

    function tick(now) {
      const k = instant ? 1 : Math.min(1, (now - start) / COUNT_TIME);
      const next = Math.round(begin + (value - begin) * (1 - (1 - k) ** 3));

      shownRef.current = next;
      setShown(next);

      if (k < 1) {
        frame = requestAnimationFrame(tick);
      }
    }

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [value, instant]);

  return shown;
}

const linesOf = (quote) => new Map([...quote.paid, ...quote.included.map((line) => ({ ...line, price: 0 }))].map((line) => [line.group, line]));

// What changed between two quotes of the same car, for the short note under the price.
function changeBetween(before, after) {
  const was = linesOf(before);
  const now = linesOf(after);
  const groups = [...new Set([...was.keys(), ...now.keys()])].filter((group) => was.get(group)?.option !== now.get(group)?.option);

  if (!groups.length) {
    return null;
  }

  if (groups.length > 1) {
    return { count: groups.length, delta: after.total - before.total };
  }

  const group = groups[0];

  return now.has(group) ? { group, option: now.get(group).option, price: now.get(group).price } : { group, option: was.get(group).option, removed: was.get(group).price };
}

// The price pill beside the car selector: the running total, a short note when an option changes it, and the
// breakdown of the car's options with a way to remove each paid one.
export default function PriceSummary({ quote, vehicle, onRemove, reduceMotion, comparing, onRequest }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(quote);
  const [flash, setFlash] = useState(null);
  const rootRef = useRef(null);
  const pillRef = useRef(null);
  const panelId = useId();
  const shown = useCountUp(quote.total, reduceMotion);
  const car = `${vehicle.make} ${vehicle.model}`;
  const hasBase = quote.base !== null;
  const name = (group, option) => t(optionKey(group, option, vehicle));

  // A new quote of the same car (an option chosen, removed, undone) shows what changed; a new car does not.
  if (seen !== quote) {
    setSeen(quote);

    const change = seen.vehicleId === quote.vehicleId && !comparing ? changeBetween(seen, quote) : null;

    if (change || seen.vehicleId !== quote.vehicleId) {
      setFlash(change && { ...change, key: (flash?.key || 0) + 1 });
    }
  }

  useEffect(() => {
    if (!flash) {
      return undefined;
    }

    const timer = setTimeout(() => setFlash(null), FLASH_TIME);

    return () => clearTimeout(timer);
  }, [flash]);

  // Open: Escape or a click outside closes it and gives focus back to the pill.
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function close(event) {
      if (event.type === "keydown" ? event.key === "Escape" : !rootRef.current?.contains(event.target)) {
        setOpen(false);

        if (event.type === "keydown") {
          event.stopPropagation();
          pillRef.current?.focus({ preventScroll: true });
        }
      }
    }

    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close, true);

    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close, true);
    };
  }, [open]);

  function closePanel() {
    setOpen(false);
    pillRef.current?.focus({ preventScroll: true });
  }

  const note = flash && !open && !comparing && (
    <div className="tz-quote__flash" key={flash.key} aria-hidden="true">
      {flash.count ? (
        <>
          <span className="tz-quote__flash-name">{t("tuning.pricing.updated", { count: flash.count })}</span>
          <span className={`tz-quote__flash-price numeric${flash.delta < 0 ? " is-less" : ""}`}>{flash.delta ? money(t, flash.delta, { sign: true }) : t("tuning.pricing.included")}</span>
        </>
      ) : (
        <>
          <span className="tz-quote__flash-group">{t(`tuning.groups.${flash.group}`)}</span>
          <span className="tz-quote__flash-name">{flash.removed !== undefined ? t("tuning.pricing.removed", { option: name(flash.group, flash.option) }) : name(flash.group, flash.option)}</span>
          <span className={`tz-quote__flash-price numeric${flash.removed ? " is-less" : ""}`}>
            {flash.removed ? money(t, -flash.removed, { sign: true }) : flash.price ? money(t, flash.price, { sign: true }) : t("tuning.pricing.included")}
          </span>
        </>
      )}
    </div>
  );

  return (
    <div className={`tz-quote${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        ref={pillRef}
        className="tz-quote__pill"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t("tuning.pricing.open", { car, total: money(t, quote.total) })}
        onClick={() => setOpen((value) => !value)}
      >
        <ReceiptText size={16} aria-hidden="true" className="tz-quote__icon" />
        <span className="tz-quote__text">
          <span className="tz-quote__label">{t(hasBase ? "tuning.pricing.total" : "tuning.pricing.options")}</span>
          <span className={`tz-quote__amount numeric${flash && !comparing ? " is-changing" : ""}`}>{money(t, shown)}</span>
        </span>
      </button>

      {note}

      <div className="tz-quote__panel" id={panelId} role="dialog" aria-label={t("tuning.pricing.title", { car })} hidden={!open}>
        <div className="tz-quote__head">
          <p className="tz-quote__title">{t("tuning.pricing.title", { car })}</p>
          <button type="button" className="tz-icon-btn" onClick={closePanel} aria-label={t("tuning.pricing.close")} title={t("tuning.pricing.close")}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {hasBase && (
          <p className="tz-quote__row">
            <span>{t("tuning.pricing.base")}</span>
            <span className="numeric">{money(t, quote.base)}</span>
          </p>
        )}

        <h3 className="tz-quote__heading">{t("tuning.pricing.paid")}</h3>
        {quote.paid.length ? (
          <ul className="tz-quote__lines">
            {quote.paid.map((line) => (
              <li key={line.group} className="tz-quote__line">
                <span className="tz-quote__item">
                  <span className="tz-quote__group">{t(`tuning.groups.${line.group}`)}</span>
                  <span className="tz-quote__option">{name(line.group, line.option)}</span>
                </span>
                <span className="tz-quote__price numeric">{money(t, line.price)}</span>
                <button
                  type="button"
                  className="tz-icon-btn tz-quote__remove"
                  onClick={() => onRemove(line.group, line.option)}
                  aria-label={t("tuning.pricing.remove", { option: `${t(`tuning.groups.${line.group}`)}: ${name(line.group, line.option)}` })}
                  title={t("tuning.pricing.remove", { option: name(line.group, line.option) })}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="tz-quote__empty">{t("tuning.pricing.none")}</p>
        )}

        {quote.included.length > 0 && (
          <>
            <h3 className="tz-quote__heading">{t("tuning.pricing.included")}</h3>
            <ul className="tz-quote__lines">
              {quote.included.map((line) => (
                <li key={line.group} className="tz-quote__line tz-quote__line--included">
                  <span className="tz-quote__item">
                    <span className="tz-quote__group">{t(`tuning.groups.${line.group}`)}</span>
                    <span className="tz-quote__option">{name(line.group, line.option)}</span>
                  </span>
                  <span className="tz-quote__price">{t("tuning.pricing.included")}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {hasBase && (
          <p className="tz-quote__row">
            <span>{t("tuning.pricing.optionsTotal")}</span>
            <span className="numeric">{money(t, quote.options)}</span>
          </p>
        )}

        <p className="tz-quote__total">
          <span>{t("tuning.pricing.totalLabel")}</span>
          <span className="numeric">{money(t, quote.total)}</span>
        </p>
        <p className="tz-quote__note">{t("tuning.pricing.note")}</p>
        {onRequest && (
          <button
            type="button"
            className="tz-btn tz-quote__request"
            onClick={() => {
              setOpen(false);
              onRequest();
            }}
          >
            <Send size={16} aria-hidden="true" className="flip-rtl" />
            {t("tuning.request.cta")}
          </button>
        )}
      </div>
    </div>
  );
}
