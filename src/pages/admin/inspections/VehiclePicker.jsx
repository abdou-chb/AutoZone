import { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useI18n } from "../../../i18n/i18n-context";
import { getCategory } from "../../../lib/categories";
import { wilayaName } from "../../../lib/format";
import { fold } from "./calendar-utils";

export default function VehiclePicker({ vehicles, onSelect }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const id = useId();
  const words = fold(query).split(/\s+/).filter(Boolean);
  const matches = vehicles
    .filter((vehicle) => {
      const text = fold(`${vehicle.name} ${vehicle.year} ${vehicle.location} ${wilayaName(vehicle.location)} #${vehicle.id}`);

      return words.every((word) => text.includes(word));
    })
    .slice(0, 30);
  const current = Math.min(active, Math.max(matches.length - 1, 0));

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function close(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", close);

    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function choose(vehicle) {
    setOpen(false);
    setQuery("");
    onSelect(vehicle);
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActive((value) => {
        const next = Math.min(value, matches.length - 1) + (event.key === "ArrowDown" ? 1 : -1);

        return (next + matches.length) % Math.max(matches.length, 1);
      });
    } else if (event.key === "Enter" && open && matches[current]) {
      event.preventDefault();
      choose(matches[current]);
    } else if (event.key === "Escape" && open) {
      event.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div className="cal-picker" ref={rootRef}>
      <label className="visually-hidden" htmlFor={`${id}-input`}>
        {t("adminInspections.vehicle.label")}
      </label>
      <Search size={18} aria-hidden="true" className="cal-picker__icon" />
      <input
        id={`${id}-input`}
        className="input cal-picker__input"
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open && matches[current] ? `${id}-option-${matches[current].id}` : undefined}
        placeholder={t("adminInspections.vehicle.placeholder")}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {open && (
        <ul id={`${id}-list`} role="listbox" className="cal-picker__list admin-popover" aria-label={t("adminInspections.vehicle.label")}>
          {matches.length === 0 && (
            <li className="cal-picker__empty" role="presentation">
              {t("adminInspections.vehicle.none")}
            </li>
          )}
          {matches.map((vehicle, index) => {
            const { icon: Icon, theme } = getCategory(vehicle.category);

            return (
              <li
                key={vehicle.id}
                id={`${id}-option-${vehicle.id}`}
                role="option"
                aria-selected={index === current}
                className={`cal-picker__option${index === current ? " is-active" : ""}`}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(vehicle)}
                onPointerMove={() => setActive(index)}
              >
                <Icon size={18} color={theme.accent} aria-hidden="true" />
                <span className="cal-picker__text">
                  <span className="cal-picker__name">
                    {vehicle.name} {vehicle.year}
                  </span>
                  <span className="cal-picker__meta">
                    {[wilayaName(vehicle.location), t("adminInspections.vehicle.requests", { count: vehicle.count })]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
