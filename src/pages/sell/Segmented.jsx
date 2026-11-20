import { useI18n } from "../../i18n/i18n-context";

export default function Segmented({ name, legend, options, labelFor = String, value, onChange, error, optional = false }) {
  const { t } = useI18n();
  const errorId = `sell-${name}-error`;

  return (
    <fieldset className="sell-segmented">
      <legend className="field__label">
        {legend}
        {optional && <span className="field__optional"> {t("sell.optional")}</span>}
      </legend>
      <div className="sell-segmented__options">
        {options.map((option) => (
          <label key={option} className="sell-segmented__option">
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(name, option)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
            <span>{labelFor(option)}</span>
          </label>
        ))}
      </div>
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
    </fieldset>
  );
}
