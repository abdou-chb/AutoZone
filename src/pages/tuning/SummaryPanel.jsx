import { ArrowLeftRight, Pencil, RotateCcw, Send, Undo2 } from "lucide-react";
import { useI18n } from "../../i18n/i18n-context";
import { changedGroups, factoryFor, optionKey, sectionsFor } from "./options";
import { money, priceOf } from "./pricing";
import { useVehicle } from "./vehicle-context";

export default function SummaryPanel({ setup, quote, onRevert, onReset, comparing, onCompare, onEdit, onRequest }) {
  const { t } = useI18n();
  const vehicle = useVehicle();
  const factory = factoryFor(vehicle);
  const changed = changedGroups(setup, vehicle);
  const sections = sectionsFor(vehicle).filter((section) => section.groups.some((group) => changed.includes(group)));

  return (
    <div className="tz-summary">
      <p className="tz-summary__count">{changed.length === 0 ? t("tuning.summary.none", { car: `${vehicle.make} ${vehicle.model}` }) : t("tuning.summary.count", { count: changed.length })}</p>

      {sections.map((section) => (
        <section key={section.id} className="tz-summary__section" aria-labelledby={`tz-summary-${section.id}`}>
          <h3 id={`tz-summary-${section.id}`} className="tz-summary__head">
            {t(`tuning.sections.${section.id}.nav`)}
          </h3>
          <ul className="tz-summary__list">
            {section.groups
              .filter((group) => changed.includes(group))
              .map((group) => {
                const name = t(`tuning.groups.${group}`);
                const price = priceOf(vehicle, group, setup[group]);

                return (
                  <li key={group} className="tz-summary__item">
                    <span className="tz-summary__group">{name}</span>
                    <span className="tz-summary__value">{t(optionKey(group, setup[group], vehicle))}</span>
                    <span className="tz-summary__was">{t("tuning.summary.was", { value: t(optionKey(group, factory[group], vehicle)) })}</span>
                    <span className={`tz-summary__price numeric${price ? " is-paid" : ""}`}>
                      {price ? money(t, price) : t(price === 0 ? "tuning.pricing.included" : "tuning.pricing.notPriced")}
                    </span>
                    <span className="tz-summary__actions-row">
                      <button type="button" className="tz-icon-btn" onClick={() => onEdit(group)} aria-label={t("tuning.summary.edit", { group: name })} title={t("tuning.summary.edit", { group: name })}>
                        <Pencil size={15} aria-hidden="true" />
                      </button>
                      <button type="button" className="tz-icon-btn" onClick={() => onRevert(group)} aria-label={t("tuning.summary.undo", { group: name })} title={t("tuning.summary.undo", { group: name })}>
                        <Undo2 size={15} aria-hidden="true" />
                      </button>
                    </span>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}

      {(changed.length > 0 || quote.base !== null) && (
        <div className="tz-summary__total">
        <dl>
          {quote.base !== null && (
            <div>
              <dt>{t("tuning.pricing.base")}</dt>
              <dd className="numeric">{money(t, quote.base)}</dd>
            </div>
          )}
          {quote.base !== null && (
            <div>
              <dt>{t("tuning.pricing.optionsTotal")}</dt>
              <dd className="numeric">{money(t, quote.options)}</dd>
            </div>
          )}
          <div className="tz-summary__grand">
            <dt>{t("tuning.pricing.totalLabel")}</dt>
            <dd className="numeric">{money(t, quote.total)}</dd>
          </div>
        </dl>
          <p className="tz-summary__note">{t("tuning.pricing.note")}</p>
        </div>
      )}

      <div className="tz-summary__request">
        <p>{t("tuning.request.ctaHint")}</p>
        <button type="button" className="tz-btn tz-summary__request-btn" onClick={onRequest}>
          <Send size={16} aria-hidden="true" className="flip-rtl" />
          {t("tuning.request.cta")}
        </button>
      </div>

      {changed.length > 0 && (
        <div className="tz-summary__actions">
          <button type="button" className="tz-btn" aria-pressed={comparing} onClick={onCompare}>
            <ArrowLeftRight size={16} aria-hidden="true" />
            {t("tuning.stage.compare")}
          </button>
          <button type="button" className="tz-btn tz-btn--quiet" onClick={onReset}>
            <RotateCcw size={16} aria-hidden="true" />
            {t("tuning.summary.resetAll")}
          </button>
        </div>
      )}
    </div>
  );
}
