import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { useI18n } from "../../../i18n/i18n-context";
import { optionLabel } from "../../../lib/attributes";
import { formatMillions } from "../../../lib/format";
import { LanguageFields } from "./settings-ui";
import { builtInQuickFilters, conditionText, fieldLabel, filterFields, MAX_QUICK_FILTERS, newFilterId } from "./zone-utils";

function defaultValue(field) {
  if (field.type === "select") return field.attribute.options[0];
  if (field.type === "boolean") return "true";
  if (field.type === "condition") return "New";

  return "";
}

function ValueControl({ id, field, value, onChange, brands, describedBy, invalid }) {
  const { t } = useI18n();
  const common = { id, "aria-describedby": describedBy, "aria-invalid": invalid || undefined };

  if (field.type === "select") {
    return (
      <select {...common} className="select" value={value} onChange={(event) => onChange(event.target.value)}>
        {field.attribute.options.map((option) => (
          <option key={option} value={option}>
            {optionLabel(field.attribute, option)}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "boolean") {
    return (
      <select {...common} className="select" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="true">{t("attributes.yes")}</option>
        <option value="false">{t("attributes.no")}</option>
      </select>
    );
  }

  if (field.type === "condition") {
    return (
      <select {...common} className="select" value={value} onChange={(event) => onChange(event.target.value)}>
        {["New", "Used"].map((condition) => (
          <option key={condition} value={condition}>
            {t(`common.condition.${condition}`)}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "brand") {
    return (
      <select {...common} className="select" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{t("adminSettings.zones.quick.chooseBrand")}</option>
        {brands.map((brand) => (
          <option key={brand} value={brand}>
            {brand}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "price" || field.type === "number") {
    return (
      <input
        {...common}
        type="number"
        inputMode="numeric"
        className="input numeric"
        min={field.attribute?.min ?? 0}
        max={field.attribute?.max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <input {...common} type="text" className="input" maxLength={field.key === "q" ? 60 : 40} value={value} onChange={(event) => onChange(event.target.value)} />
  );
}

function ConditionBuilder({ id, category, brands, params, onAdd, disabled }) {
  const { t } = useI18n();
  const fields = filterFields(category);
  const [fieldKey, setFieldKey] = useState(fields.find((field) => field.type === "select")?.key || fields[0].key);
  const field = fields.find((item) => item.key === fieldKey);
  const [value, setValue] = useState(() => defaultValue(field));
  const [error, setError] = useState("");
  const hint = field.type === "price" && Number(value) > 0 ? formatMillions(Number(value)) : "";

  function chooseField(key) {
    const next = fields.find((item) => item.key === key);

    setFieldKey(key);
    setValue(defaultValue(next));
    setError("");
  }

  function add() {
    const text = String(value).trim();
    const number = Number(text);

    if (!text) {
      setError(t("adminSettings.zones.quick.errors.value"));
      return;
    }

    if ((field.type === "price" || field.type === "number") && (!Number.isInteger(number) || number < 0)) {
      setError(t("adminSettings.zones.quick.errors.number"));
      return;
    }

    const current = params[field.key];
    const next =
      field.type === "select" && current && !current.split(",").includes(text) ? `${current},${text}` : text;

    onAdd({ ...params, [field.key]: next });
    setError("");

    if (field.type !== "select" && field.type !== "boolean" && field.type !== "condition") {
      setValue("");
    }
  }

  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <fieldset className="set-builder" disabled={disabled}>
      <legend className="field__label">{t("adminSettings.zones.quick.addCondition")}</legend>
      <div className="set-builder__row">
        <div className="field">
          <label className="field__label set-builder__sub" htmlFor={`${id}-field`}>
            {t("adminSettings.zones.quick.field")}
          </label>
          <select id={`${id}-field`} className="select" value={fieldKey} onChange={(event) => chooseField(event.target.value)}>
            {fields.map((item) => (
              <option key={item.key} value={item.key}>
                {fieldLabel(item, category)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label set-builder__sub" htmlFor={`${id}-value`}>
            {field.type === "price" ? t("adminSettings.zones.quick.amount") : t("adminSettings.zones.quick.value")}
          </label>
          <ValueControl
            id={`${id}-value`}
            field={field}
            value={value}
            brands={brands}
            onChange={(next) => {
              setValue(next);
              setError("");
            }}
            describedBy={[errorId, hintId].filter(Boolean).join(" ") || undefined}
            invalid={Boolean(error)}
          />
        </div>
        <button type="button" className="btn btn--outline set-builder__add" onClick={add}>
          <Plus size={16} aria-hidden="true" />
          {t("adminSettings.zones.quick.addConditionButton")}
        </button>
      </div>
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function QuickFilterItem({ id, filter, index, total, category, brands, errors, onChange, onMove, onRemove, readOnly }) {
  const { t, language } = useI18n();
  const fields = filterFields(category);
  const label = filter.label[language]?.trim() || filter.label.en.trim() || t("adminSettings.zones.quick.untitled");
  const paramsErrorId = errors.params ? `${id}-params-error` : undefined;

  function removeParam(key) {
    const rest = { ...filter.params };

    delete rest[key];
    onChange({ ...filter, params: rest });
  }

  return (
    <li className="set-qf">
      <div className="set-qf__head">
        <span className="set-qf__number numeric" aria-hidden="true">
          {index + 1}
        </span>
        <h3 className="set-qf__title" id={`${id}-title`}>
          {label}
        </h3>
        <div className="set-qf__tools">
          <button
            type="button"
            className="admin-icon-btn"
            onClick={() => onMove(-1)}
            disabled={readOnly || index === 0}
            aria-label={t("adminSettings.zones.quick.moveUp", { name: label })}
            title={t("adminSettings.zones.quick.moveUpShort")}
          >
            <ArrowUp size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="admin-icon-btn"
            onClick={() => onMove(1)}
            disabled={readOnly || index === total - 1}
            aria-label={t("adminSettings.zones.quick.moveDown", { name: label })}
            title={t("adminSettings.zones.quick.moveDownShort")}
          >
            <ArrowDown size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="admin-icon-btn set-danger-icon"
            onClick={onRemove}
            disabled={readOnly}
            aria-label={t("adminSettings.zones.quick.remove", { name: label })}
            title={t("adminSettings.zones.quick.removeShort")}
          >
            <Trash2 size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <LanguageFields
        id={`${id}-label`}
        legend={t("adminSettings.zones.quick.label")}
        values={filter.label}
        maxLength={40}
        onChange={(next) => onChange({ ...filter, label: next })}
        errors={{ en: errors.label }}
      />

      <div className="set-qf__conditions">
        <p className="field__label" id={`${id}-conditions`}>
          {t("adminSettings.zones.quick.conditions")}
        </p>
        {Object.keys(filter.params).length ? (
          <ul className="set-tags" aria-labelledby={`${id}-conditions`} aria-describedby={paramsErrorId}>
            {Object.entries(filter.params).map(([key, value]) => {
              const field = fields.find((item) => item.key === key);
              const text = field ? conditionText(field, value, category) : `${key}: ${value}`;

              return (
                <li key={key} className="set-tag">
                  <span>{text}</span>
                  <button
                    type="button"
                    className="set-tag__remove"
                    onClick={() => removeParam(key)}
                    disabled={readOnly}
                    aria-label={t("adminSettings.zones.quick.removeCondition", { name: text })}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="field__hint">{t("adminSettings.zones.quick.noConditions")}</p>
        )}
        {errors.params && (
          <p id={paramsErrorId} className="field__error">
            {errors.params}
          </p>
        )}
      </div>

      <ConditionBuilder
        id={`${id}-builder`}
        category={category}
        brands={brands}
        params={filter.params}
        disabled={readOnly}
        onAdd={(params) => onChange({ ...filter, params })}
      />
    </li>
  );
}

export default function QuickFilters({ id, category, filters, onChange, brands, errors, readOnly }) {
  const { t, language } = useI18n();
  const builtIn = builtInQuickFilters(category);
  const custom = filters.length > 0;
  const shown = custom ? filters : builtIn;

  function move(index, step) {
    const next = [...filters];
    const [item] = next.splice(index, 1);

    next.splice(index + step, 0, item);
    onChange(next);
  }

  return (
    <div className="set-quick">
      <div className="set-preview">
        <p className="set-preview__label">
          {custom ? t("adminSettings.common.preview") : t("adminSettings.zones.quick.builtInPreview")}
        </p>
        <ul className="set-chips set-chips--preview">
          {shown.map((filter) => (
            <li key={filter.id} className="set-chip set-chip--pill">
              {filter.label[language]?.trim() || filter.label.en.trim() || t("adminSettings.zones.quick.untitled")}
            </li>
          ))}
        </ul>
      </div>

      {!custom && (
        <div className="set-builtin">
          <p className="field__hint">{t("adminSettings.zones.quick.builtInHint")}</p>
          <div className="set-row">
            <button type="button" className="btn btn--outline" onClick={() => onChange(builtIn)} disabled={readOnly}>
              {t("adminSettings.zones.quick.customize")}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={readOnly}
              onClick={() => onChange([{ id: newFilterId(), label: { en: "", fr: "", ar: "" }, params: {} }])}
            >
              <Plus size={16} aria-hidden="true" />
              {t("adminSettings.zones.quick.startEmpty")}
            </button>
          </div>
        </div>
      )}

      {custom && (
        <>
          <ol className="set-qf-list">
            {filters.map((filter, index) => (
              <QuickFilterItem
                key={filter.id}
                id={`${id}-${filter.id}`}
                filter={filter}
                index={index}
                total={filters.length}
                category={category}
                brands={brands}
                errors={errors[index] || {}}
                readOnly={readOnly}
                onChange={(next) => onChange(filters.map((item, position) => (position === index ? next : item)))}
                onMove={(step) => move(index, step)}
                onRemove={() => onChange(filters.filter((_, position) => position !== index))}
              />
            ))}
          </ol>
          <div className="set-row">
            <button
              type="button"
              className="btn btn--outline"
              disabled={readOnly || filters.length >= MAX_QUICK_FILTERS}
              onClick={() => onChange([...filters, { id: newFilterId(), label: { en: "", fr: "", ar: "" }, params: {} }])}
            >
              <Plus size={16} aria-hidden="true" />
              {t("adminSettings.zones.quick.add")}
            </button>
            <button type="button" className="btn btn--ghost" disabled={readOnly} onClick={() => onChange([])}>
              {t("adminSettings.zones.quick.useBuiltIn")}
            </button>
          </div>
          <p className="field__hint">{t("adminSettings.zones.quick.limit", { count: MAX_QUICK_FILTERS, used: filters.length })}</p>
        </>
      )}
    </div>
  );
}
