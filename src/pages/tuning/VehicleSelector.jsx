import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "../../i18n/i18n-context";
import { VEHICLES } from "./vehicles";

// Above the car: previous and next arrows around the car's name; the name opens all six cars at once.
// `chosen` is the car asked for; `swapping` is true while the cars change places or the next one loads.
export default function VehicleSelector({ chosen, swapping, onSelect }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const toggleRef = useRef(null);
  const cardRefs = useRef({});
  const panelId = useId();
  const index = VEHICLES.findIndex((vehicle) => vehicle.id === chosen);
  const vehicle = VEHICLES[index];
  const step = (by) => onSelect(VEHICLES[(index + by + VEHICLES.length) % VEHICLES.length].id);

  // Open: focus the chosen car; Escape or a click outside closes and gives focus back to the name.
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    cardRefs.current[chosen]?.focus({ preventScroll: true });

    function close(event) {
      if (event.type === "keydown" ? event.key === "Escape" : !rootRef.current?.contains(event.target)) {
        setOpen(false);

        if (event.type === "keydown") {
          toggleRef.current?.focus({ preventScroll: true });
        }
      }
    }

    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);

    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
    // Focus moves only when the panel opens, not on every choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function choose(id) {
    setOpen(false);
    toggleRef.current?.focus({ preventScroll: true });
    onSelect(id);
  }

  // Arrow keys move between the cards (mirrored right to left).
  function onCardKeys(event) {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

    if (!(event.key in keys)) {
      return;
    }

    event.preventDefault();

    const mirrored = document.documentElement.dir === "rtl" && (event.key === "ArrowLeft" || event.key === "ArrowRight");
    const by = mirrored ? -keys[event.key] : keys[event.key];
    const current = VEHICLES.findIndex((item) => cardRefs.current[item.id] === document.activeElement);
    const next = VEHICLES[(current + by + VEHICLES.length) % VEHICLES.length];

    cardRefs.current[next.id]?.focus();
  }

  return (
    <div className={`tz-garage${open ? " is-open" : ""}${swapping ? " is-swapping" : ""}`} ref={rootRef}>
      <div className="tz-garage__bar">
        <button type="button" className="tz-garage__step" onClick={() => step(-1)} aria-label={t("tuning.showroom.previous")} title={t("tuning.showroom.previous")}>
          <ChevronLeft size={18} aria-hidden="true" className="flip-rtl" />
        </button>
        <button
          type="button"
          ref={toggleRef}
          className="tz-garage__current"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={t("tuning.showroom.choose", { car: `${vehicle.make} ${vehicle.model}` })}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="tz-garage__make">{vehicle.make}</span>
          <span className="tz-garage__model">{vehicle.model}</span>
          <ChevronDown size={16} aria-hidden="true" className="tz-garage__chevron" />
        </button>
        <button type="button" className="tz-garage__step" onClick={() => step(1)} aria-label={t("tuning.showroom.next")} title={t("tuning.showroom.next")}>
          <ChevronRight size={18} aria-hidden="true" className="flip-rtl" />
        </button>
      </div>

      {swapping && (
        <p className="tz-garage__status" aria-hidden="true">
          {t("tuning.showroom.arriving")}
        </p>
      )}

      <div className="tz-garage__panel" id={panelId} role="dialog" aria-label={t("tuning.showroom.title")} hidden={!open}>
        <p className="tz-garage__title">{t("tuning.showroom.title")}</p>
        <ul className="tz-garage__cards">
          {VEHICLES.map((item) => {
            const current = item.id === chosen;

            return (
              <li key={item.id}>
                <button
                  type="button"
                  ref={(node) => {
                    cardRefs.current[item.id] = node;
                  }}
                  className="tz-car"
                  aria-pressed={current}
                  onClick={() => choose(item.id)}
                  onKeyDown={onCardKeys}
                >
                  <span className="tz-car__picture">
                    <img src={`/showroom/${item.id}.webp`} alt="" width="320" height="180" loading="lazy" decoding="async" />
                    {current && (
                      <span className="tz-car__check" aria-hidden="true">
                        <Check size={14} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className="tz-car__make">{item.make}</span>
                  <span className="tz-car__model">{item.model}</span>
                  <span className="tz-car__body">{t(`tuning.showroom.body.${item.body}`)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
