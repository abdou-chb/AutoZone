import { Check } from "lucide-react";
import { useI18n } from "../../i18n/i18n-context";
import { factoryFor, GROUPS, optionKey, visibleOptions } from "./options";
import { money, priceOf } from "./pricing";
import { useVehicle } from "./vehicle-context";
import { previewClass, previewStyle } from "./previews";

// Segments with more choices than this have no room for a price line; theirs is in the legend and the name.
const SEGMENT_PRICES = 3;

export default function OptionGroup({ group, value, setup, onChange, highlighted }) {
  const { t } = useI18n();
  const vehicle = useVehicle();
  const { type } = GROUPS[group];
  const options = visibleOptions(group, vehicle);
  const changed = value !== factoryFor(vehicle)[group];
  const legendId = `tz-group-${group}`;
  const price = (id) => priceOf(vehicle, group, id);
  const priceText = (id) => (price(id) ? money(t, price(id), { sign: true }) : t("tuning.pricing.included"));
  const selected = price(value);
  const showSegmentPrices = options.length <= SEGMENT_PRICES;

  return (
    <fieldset className={`tz-group${highlighted ? " is-highlighted" : ""}`} id={legendId}>
      <legend className="tz-group__legend">
        <span className="tz-group__name">{t(`tuning.groups.${group}`)}</span>
        <span className="tz-group__value">
          {changed && <span className="tz-group__dot" aria-label={t("tuning.changed")} role="img" />}
          {t(optionKey(group, value, vehicle))}
          {selected !== null && <span className={`tz-group__price numeric${selected ? " is-paid" : ""}`}>{priceText(value)}</span>}
        </span>
      </legend>

      {type === "segment" ? (
        <div className="tz-segment">
          {options.map((option) => {
            const cost = price(option.id);

            return (
              <label key={option.id} className="tz-segment__item" title={cost ? `${t(optionKey(group, option.id, vehicle))}, ${priceText(option.id)}` : undefined}>
                <input type="radio" name={group} value={option.id} checked={value === option.id} onChange={() => onChange(group, option.id)} />
                <span>
                  {t(optionKey(group, option.id, vehicle))}
                  {cost > 0 &&
                    (showSegmentPrices ? (
                      <small className="tz-segment__price numeric">{priceText(option.id)}</small>
                    ) : (
                      <span className="visually-hidden">, {priceText(option.id)}</span>
                    ))}
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <div className={`tz-chips tz-chips--${type}`}>
          {options.map((option) => {
            const cost = price(option.id);

            return (
              <label key={option.id} className="tz-chip" title={cost ? `${t(optionKey(group, option.id, vehicle))}, ${priceText(option.id)}` : t(optionKey(group, option.id, vehicle))}>
                <input type="radio" name={group} value={option.id} checked={value === option.id} onChange={() => onChange(group, option.id)} />
                <span className={previewClass(group, option, vehicle)} style={previewStyle(group, option, setup, vehicle)}>
                  <Check size={14} strokeWidth={3} aria-hidden="true" />
                </span>
                <span className="tz-chip__name">{t(optionKey(group, option.id, vehicle))}</span>
                {cost > 0 && <span className="tz-chip__price numeric">{priceText(option.id)}</span>}
              </label>
            );
          })}
        </div>
      )}

      {["tint", "stance", "ledColor"].includes(group) && <p className="tz-group__hint">{t(`tuning.hints.${group}`)}</p>}
    </fieldset>
  );
}
