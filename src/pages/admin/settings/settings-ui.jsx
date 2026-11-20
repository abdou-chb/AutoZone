import { useId, useState } from "react";
import { Copy, Eye, EyeOff, RotateCcw, WandSparkles } from "lucide-react";
import { useI18n } from "../../../i18n/i18n-context";
import { LANGUAGES } from "../../../i18n/config";
import { useToast } from "../../../lib/toast-context";
import { generatePassword, hasText, MIN_PASSWORD } from "./settings-utils";

export function Switch({ id, checked, onChange, label, description, disabled = false, tone }) {
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <div className={`set-switch${tone ? ` set-switch--${tone}` : ""}`}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="set-switch__input"
        checked={checked}
        disabled={disabled}
        aria-describedby={descriptionId}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={id} className="set-switch__label">
        <span className="set-switch__track" aria-hidden="true">
          <span className="set-switch__thumb" />
        </span>
        <span className="set-switch__text">
          <span className="set-switch__title">{label}</span>
          {description && (
            <span id={descriptionId} className="set-switch__description">
              {description}
            </span>
          )}
        </span>
      </label>
    </div>
  );
}

export function LanguageFields({
  id,
  legend,
  hint,
  values,
  placeholders,
  onChange,
  multiline = false,
  maxLength,
  onReset,
  errors = {},
}) {
  const { t } = useI18n();
  const hintId = hint ? `${id}-hint` : undefined;
  const Control = multiline ? "textarea" : "input";

  return (
    <fieldset className="set-langs" aria-describedby={hintId}>
      <div className="set-langs__head">
        <legend className="set-langs__legend">{legend}</legend>
        {onReset && hasText(values) && (
          <button type="button" className="admin-link-btn set-reset" onClick={onReset}>
            <RotateCcw size={14} aria-hidden="true" />
            {t("adminSettings.common.resetDefault")}
          </button>
        )}
      </div>
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      <div className={`set-langs__grid${multiline ? " set-langs__grid--wide" : ""}`}>
        {LANGUAGES.map((language) => {
          const fieldId = `${id}-${language.code}`;
          const error = errors[language.code];
          const errorId = error ? `${fieldId}-error` : undefined;

          return (
            <div key={language.code} className="field">
              <label className="field__label" htmlFor={fieldId}>
                <span lang={language.code}>{language.label}</span>
              </label>
              <Control
                id={fieldId}
                className={multiline ? "textarea set-langs__textarea" : "input"}
                lang={language.code}
                dir={language.dir}
                value={values?.[language.code] || ""}
                placeholder={placeholders?.[language.code] || ""}
                maxLength={maxLength}
                aria-invalid={error ? true : undefined}
                aria-describedby={errorId}
                onChange={(event) => onChange({ ...values, [language.code]: event.target.value })}
              />
              {error && (
                <p id={errorId} className="field__error">
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

export function SaveBar({ dirty, saving, onDiscard, label, sticky = false }) {
  const { t } = useI18n();

  return (
    <div className={`set-savebar${sticky ? " set-savebar--sticky" : ""}${dirty ? " is-dirty" : ""}`}>
      <p className="set-savebar__status" aria-live="polite">
        {dirty ? t("adminSettings.common.unsaved") : t("adminSettings.common.upToDate")}
      </p>
      <div className="set-savebar__actions">
        <button type="button" className="btn btn--ghost" onClick={onDiscard} disabled={!dirty || saving}>
          {t("adminSettings.common.discard")}
        </button>
        <button type="submit" className="btn btn--primary" disabled={!dirty || saving} data-focus-return>
          {saving && <span className="spinner" aria-hidden="true" />}
          {saving ? t("adminSettings.common.saving") : label || t("adminSettings.common.save")}
        </button>
      </div>
    </div>
  );
}

export function PasswordInput({ id, value, onChange, generate = false, autoComplete = "new-password", inputRef, ...rest }) {
  const { t } = useI18n();
  const showToast = useToast();
  const [visible, setVisible] = useState(false);

  function fill() {
    onChange(generatePassword());
    setVisible(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      showToast(t("adminSettings.common.password.copied"));
    } catch {
      showToast(t("adminSettings.common.password.copyFailed"), { tone: "error" });
    }
  }

  return (
    <div className="set-password">
      <div className="set-password__row">
        <input
          {...rest}
          ref={inputRef}
          id={id}
          type={visible ? "text" : "password"}
          className="input ltr set-password__input"
          dir="ltr"
          autoComplete={autoComplete}
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="icon-btn"
          aria-pressed={visible}
          aria-controls={id}
          aria-label={t("adminSettings.common.password.show")}
          title={t("adminSettings.common.password.show")}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
        {generate && value && (
          <button
            type="button"
            className="icon-btn"
            aria-label={t("adminSettings.common.password.copy")}
            title={t("adminSettings.common.password.copy")}
            onClick={copy}
          >
            <Copy size={18} aria-hidden="true" />
          </button>
        )}
      </div>
      {generate && (
        <button type="button" className="btn btn--outline btn--small set-password__generate" onClick={fill}>
          <WandSparkles size={16} aria-hidden="true" />
          {t("adminSettings.common.password.generate")}
        </button>
      )}
    </div>
  );
}

export function PasswordStrength({ id, value }) {
  const { t } = useI18n();
  const missing = Math.max(0, MIN_PASSWORD - value.length);
  const level = !value ? "empty" : missing > 0 ? "short" : value.length >= 16 ? "strong" : "good";

  return (
    <div id={id} className={`set-strength set-strength--${level}`}>
      <span className="set-strength__bar" aria-hidden="true">
        <span />
      </span>
      <span className="set-strength__text" aria-live="polite">
        {level === "empty" && t("adminSettings.common.password.rule")}
        {level === "short" && t("adminSettings.common.password.missing", { count: missing })}
        {level === "good" && t("adminSettings.common.password.good")}
        {level === "strong" && t("adminSettings.common.password.strong")}
      </span>
    </div>
  );
}

export function ChoiceGroup({ name, legend, hint, value, options, onChange, disabled = false }) {
  const hintId = useId();

  return (
    <fieldset className="set-choices" aria-describedby={hint ? hintId : undefined} disabled={disabled}>
      <legend className="field__label">{legend}</legend>
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      <div className="set-choices__list">
        {options.map((option) => (
          <label key={option.value} className={`set-choice${value === option.value ? " is-selected" : ""}`}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="set-choice__text">
              <span className="set-choice__label" lang={option.lang}>
                {option.label}
              </span>
              {option.description && <span className="set-choice__description">{option.description}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CardSkeleton({ count = 2 }) {
  return (
    <div className="set-stack" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="console-card set-skeleton">
          <div className="skeleton set-skeleton__title" />
          <div className="skeleton set-skeleton__line" />
          <div className="skeleton set-skeleton__line set-skeleton__line--short" />
        </div>
      ))}
    </div>
  );
}
