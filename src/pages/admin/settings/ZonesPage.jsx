import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Image as ImageIcon, ImageOff, LayoutGrid, Plus, RotateCcw, SlidersHorizontal, Tags, TriangleAlert, X, Zap } from "lucide-react";
import Field from "../../../components/Field";
import { useI18n } from "../../../i18n/i18n-context";
import { attributeLabel } from "../../../lib/attributes";
import { CATEGORIES, isCategoryKey } from "../../../lib/categories";
import { formatMillions, formatPrice } from "../../../lib/format";
import { useToast } from "../../../lib/toast-context";
import { useAdmin } from "../admin-context";
import ConfirmDialog from "../ConfirmDialog";
import { LoadError } from "../PanelStates";
import { useAdminData } from "../useAdminSession";
import QuickFilters from "./QuickFilters";
import { CardSkeleton, LanguageFields, SaveBar, Switch } from "./settings-ui";
import { isSiteLink, LANGUAGE_CODES, sameValue, textIn, useAllLanguages, useUnsavedWarning } from "./settings-utils";
import { MAX_BUDGETS, MIN_BUDGET, quickFilterErrors, SECTIONS, sectionAvailable } from "./zone-utils";
import "./settings.css";

function builtInTexts(category, part) {
  return Object.fromEntries(LANGUAGE_CODES.map((code) => [code, textIn(`zones.${category.key}.hero.${part}`, code)]));
}

function emptyTexts() {
  return { en: "", fr: "", ar: "" };
}

function ZoneCard({ id, icon: Icon, title, lead, children }) {
  return (
    <section className="console-card set-section" aria-labelledby={id}>
      <div className="console-card__head set-section__head">
        <span className="set-section__icon">
          <Icon size={20} aria-hidden="true" />
        </span>
        <div className="set-section__titles">
          <h2 id={id}>{title}</h2>
          {lead && <p>{lead}</p>}
        </div>
      </div>
      <div className="console-card__body set-section__body">{children}</div>
    </section>
  );
}

function HeroEditor({ id, category, hero, onChange, error }) {
  const { t, language } = useI18n();
  const [failed, setFailed] = useState("");
  const titles = builtInTexts(category, "title");
  const leads = builtInTexts(category, "lead");
  const image = hero.image.trim();
  const source = image && isSiteLink(image) ? image : category.hero.image;
  const broken = failed === source;
  const pick = (values, fallback) => values[language]?.trim() || values.en?.trim() || fallback[language];

  return (
    <div className="set-hero-editor">
      <div className="set-hero-editor__top">
        <Field
          id={`${id}-image`}
          label={t("adminSettings.zones.hero.image")}
          optional
          hint={t("adminSettings.zones.hero.imageHint")}
          error={error}
        >
          {(props) => (
            <div className="set-inline">
              <input
                {...props}
                type="url"
                className="input ltr"
                dir="ltr"
                placeholder="https://"
                maxLength={500}
                value={hero.image}
                onChange={(event) => onChange({ ...hero, image: event.target.value })}
              />
              {hero.image && (
                <button type="button" className="btn btn--ghost" onClick={() => onChange({ ...hero, image: "" })}>
                  <RotateCcw size={16} aria-hidden="true" />
                  {t("adminSettings.common.resetDefault")}
                </button>
              )}
            </div>
          )}
        </Field>

        <figure className="set-hero">
          <figcaption className="set-preview__label">
            {t("adminSettings.common.preview")}
            {!image && <span className="badge">{t("adminSettings.zones.hero.builtInPhoto")}</span>}
          </figcaption>
          <div className="set-hero__frame">
            {broken ? (
              <div className="set-hero__broken" role="status">
                <ImageOff size={24} aria-hidden="true" />
                <span>{t("adminSettings.zones.hero.broken")}</span>
              </div>
            ) : (
              <img src={source} alt="" onError={() => setFailed(source)} />
            )}
            <div className="set-hero__text">
              <strong>{pick(hero.title, titles)}</strong>
              <span>{pick(hero.lead, leads)}</span>
            </div>
          </div>
        </figure>
      </div>

      <LanguageFields
        id={`${id}-title`}
        legend={t("adminSettings.zones.hero.title")}
        hint={t("adminSettings.zones.hero.placeholderHint")}
        values={hero.title}
        placeholders={titles}
        maxLength={120}
        onChange={(title) => onChange({ ...hero, title })}
        onReset={() => onChange({ ...hero, title: emptyTexts() })}
      />
      <LanguageFields
        id={`${id}-lead`}
        legend={t("adminSettings.zones.hero.lead")}
        values={hero.lead}
        placeholders={leads}
        maxLength={300}
        multiline
        onChange={(lead) => onChange({ ...hero, lead })}
        onReset={() => onChange({ ...hero, lead: emptyTexts() })}
      />
    </div>
  );
}

function BudgetsEditor({ id, category, budgets, onChange }) {
  const { t } = useI18n();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const custom = budgets.length > 0;
  const shown = custom ? budgets : category.budgets;
  const preview = Number(amount) >= MIN_BUDGET ? formatMillions(Number(amount)) : "";
  const errorId = error ? `${id}-amount-error` : undefined;

  function add() {
    const value = Number(amount);

    if (!Number.isInteger(value) || value < MIN_BUDGET) {
      setError(t("adminSettings.zones.budgets.errors.min", { amount: formatPrice(MIN_BUDGET) }));
      return;
    }

    if (budgets.includes(value)) {
      setError(t("adminSettings.zones.budgets.errors.duplicate"));
      return;
    }

    onChange([...budgets, value].sort((first, second) => first - second));
    setAmount("");
    setError("");
  }

  return (
    <div className="set-budgets">
      {!custom && <p className="set-preview__label">{t("adminSettings.zones.budgets.builtIn")}</p>}
      <ul className="set-chips" aria-label={t("adminSettings.zones.budgets.listLabel")}>
        {shown.map((value) => {
          const label = formatMillions(value);

          return (
            <li key={value} className={`set-chip${custom ? "" : " set-chip--muted"}`}>
              <span className="set-chip__main">{label}</span>
              <span className="set-chip__sub numeric">{formatPrice(value)}</span>
              {custom && (
                <button
                  type="button"
                  className="set-chip__remove"
                  onClick={() => onChange(budgets.filter((item) => item !== value))}
                  aria-label={t("adminSettings.zones.budgets.remove", { amount: label })}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {custom ? (
        <>
          <div className="set-budgets__add">
            <div className="field">
              <label className="field__label" htmlFor={`${id}-amount`}>
                {t("adminSettings.zones.budgets.amount")}
              </label>
              <div className="set-inline">
                <input
                  id={`${id}-amount`}
                  type="number"
                  inputMode="numeric"
                  className="input numeric"
                  min={MIN_BUDGET}
                  step={10000}
                  value={amount}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={[errorId, `${id}-amount-hint`].filter(Boolean).join(" ")}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      add();
                    }
                  }}
                />
                <button type="button" className="btn btn--outline" onClick={add} disabled={budgets.length >= MAX_BUDGETS}>
                  <Plus size={16} aria-hidden="true" />
                  {t("adminSettings.zones.budgets.add")}
                </button>
              </div>
              <p id={`${id}-amount-hint`} className="field__hint" aria-live="polite">
                {preview
                  ? t("adminSettings.zones.budgets.preview", { amount: preview })
                  : t("adminSettings.zones.budgets.hint", { count: MAX_BUDGETS })}
              </p>
              {error && (
                <p id={errorId} className="field__error">
                  {error}
                </p>
              )}
            </div>
          </div>
          <button type="button" className="btn btn--ghost set-self-start" onClick={() => onChange([])}>
            {t("adminSettings.zones.budgets.useBuiltIn")}
          </button>
        </>
      ) : (
        <button type="button" className="btn btn--outline set-self-start" onClick={() => onChange([...category.budgets])}>
          {t("adminSettings.zones.budgets.customize")}
        </button>
      )}
    </div>
  );
}

function FiltersChecklist({ id, category, filters, onChange }) {
  const { t } = useI18n();
  const attributes = category.attributes.filter((attribute) => attribute.filter);
  const keys = attributes.map((attribute) => attribute.key);
  const current = filters.length ? keys.filter((key) => filters.includes(key)) : keys;

  function toggle(key, on) {
    const next = keys.filter((item) => (item === key ? on : current.includes(item)));

    onChange(next.length === keys.length ? [] : next);
  }

  return (
    <fieldset className="set-fieldset" aria-describedby={`${id}-hint`}>
      <legend className="visually-hidden">{t("adminSettings.zones.filters.title")}</legend>
      <p id={`${id}-hint`} className="field__hint">
        {filters.length ? t("adminSettings.zones.filters.someHint") : t("adminSettings.zones.filters.allHint")}
      </p>
      <ul className="set-checks">
        {attributes.map((attribute) => {
          const checked = current.includes(attribute.key);

          return (
            <li key={attribute.key}>
              <label className="set-check">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={checked && current.length === 1}
                  onChange={(event) => toggle(attribute.key, event.target.checked)}
                />
                <span>{attributeLabel(attribute, category.key)}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

function ZoneForm({ category, draft, saved, onChange, onSaved, readOnly }) {
  const { t } = useI18n();
  const { request } = useAdmin();
  const showToast = useToast();
  const brandsData = useAdminData(request, `/api/admin/brands?category=${category.key}`);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState("");
  const [confirming, setConfirming] = useState(false);
  const id = `zone-${category.key}`;
  const dirty = !sameValue(draft, saved);
  const brands = (brandsData.data?.brands || []).map((brand) => brand.name);
  const zoneName = category.brand;

  function validate(zone) {
    const image = zone.hero.image.trim();

    return {
      image: image && !isSiteLink(image) ? t("adminSettings.errors.imageUrl") : "",
      quick: quickFilterErrors(zone.quickFilters, t),
    };
  }

  const errors = checked ? validate(draft) : { image: "", quick: [] };

  function update(patch) {
    onChange((zone) => ({ ...zone, ...patch }));
  }

  async function save() {
    setConfirming(false);
    setSaving(true);
    setFailure("");

    try {
      const data = await request("/api/admin/settings/zones", { method: "PUT", body: { [category.key]: draft } });

      onSaved(data.value);
      setChecked(false);
      showToast(t("adminSettings.zones.saved", { zone: zoneName }));
    } catch (error) {
      if (error.name !== "AbortError") {
        setFailure(error.message);
      }
    } finally {
      setSaving(false);
    }
  }

  function submit(event) {
    event.preventDefault();

    const found = validate(draft);
    const quickIndex = found.quick.findIndex((item) => item.label || item.params);

    setChecked(true);

    if (found.image) {
      document.getElementById(`${id}-hero-image`)?.focus();
      return;
    }

    if (quickIndex >= 0) {
      const filter = draft.quickFilters[quickIndex];
      const target = found.quick[quickIndex].label ? `${id}-quick-${filter.id}-label-en` : `${id}-quick-${filter.id}-builder-field`;

      document.getElementById(target)?.focus();
      return;
    }

    if (!draft.visible && saved.visible) {
      setConfirming(true);
      return;
    }

    save();
  }

  return (
    <form className="set-zone" onSubmit={submit} noValidate>
      <fieldset className="set-plain" disabled={readOnly}>
        <legend className="visually-hidden">{t("adminSettings.zones.formLabel", { zone: zoneName })}</legend>
        <div className="set-stack">
          <ZoneCard id={`${id}-visibility`} icon={draft.visible ? Eye : EyeOff} title={t("adminSettings.zones.visibility.title")}>
            <Switch
              id={`${id}-visible`}
              checked={draft.visible}
              onChange={(visible) => update({ visible })}
              label={t("adminSettings.zones.visibility.label", { zone: zoneName })}
              description={t("adminSettings.zones.visibility.hint")}
            />
            {!draft.visible && (
              <div className="notice notice--stop" role="status">
                <TriangleAlert size={18} aria-hidden="true" />
                <p>{t("adminSettings.zones.visibility.warning", { zone: zoneName })}</p>
              </div>
            )}
          </ZoneCard>

          <ZoneCard id={`${id}-hero-card`} icon={ImageIcon} title={t("adminSettings.zones.hero.cardTitle")} lead={t("adminSettings.zones.hero.cardLead")}>
            <HeroEditor id={`${id}-hero`} category={category} hero={draft.hero} error={errors.image} onChange={(hero) => update({ hero })} />
          </ZoneCard>

          <ZoneCard id={`${id}-budgets`} icon={Tags} title={t("adminSettings.zones.budgets.title")} lead={t("adminSettings.zones.budgets.lead")}>
            <BudgetsEditor id={`${id}-budget`} category={category} budgets={draft.budgets} onChange={(budgets) => update({ budgets })} />
          </ZoneCard>

          <ZoneCard id={`${id}-quick-card`} icon={Zap} title={t("adminSettings.zones.quick.title")} lead={t("adminSettings.zones.quick.lead")}>
            <QuickFilters
              id={`${id}-quick`}
              category={category}
              filters={draft.quickFilters}
              brands={brands}
              errors={errors.quick}
              readOnly={readOnly}
              onChange={(quickFilters) => update({ quickFilters })}
            />
          </ZoneCard>

          <ZoneCard id={`${id}-filters`} icon={SlidersHorizontal} title={t("adminSettings.zones.filters.title")} lead={t("adminSettings.zones.filters.lead")}>
            <FiltersChecklist id={`${id}-filters-list`} category={category} filters={draft.filters} onChange={(filters) => update({ filters })} />
          </ZoneCard>

          <ZoneCard id={`${id}-sections`} icon={LayoutGrid} title={t("adminSettings.zones.sections.title")} lead={t("adminSettings.zones.sections.lead")}>
            <div className="set-switches">
              {SECTIONS.map((section) => {
                const available = sectionAvailable(category, section);

                return (
                  <Switch
                    key={section}
                    id={`${id}-section-${section}`}
                    checked={available && draft.sections[section] !== false}
                    disabled={!available}
                    onChange={(on) => onChange((zone) => ({ ...zone, sections: { ...zone.sections, [section]: on } }))}
                    label={t(`adminSettings.zones.sections.items.${section}.label`)}
                    description={
                      available
                        ? t(`adminSettings.zones.sections.items.${section}.text`)
                        : t("adminSettings.zones.sections.notUsed", { zone: zoneName })
                    }
                  />
                );
              })}
            </div>
          </ZoneCard>
        </div>
      </fieldset>

      {failure && (
        <p className="notice notice--stop set-failure" role="alert">
          <TriangleAlert size={18} aria-hidden="true" />
          {failure}
        </p>
      )}

      {!readOnly && (
        <SaveBar
          sticky
          dirty={dirty}
          saving={saving}
          label={t("adminSettings.zones.save", { zone: zoneName })}
          onDiscard={() => {
            onChange(saved);
            setChecked(false);
            setFailure("");
          }}
        />
      )}

      {confirming && (
        <ConfirmDialog
          title={t("adminSettings.zones.visibility.confirmTitle", { zone: zoneName })}
          description={t("adminSettings.zones.visibility.warning", { zone: zoneName })}
          confirmLabel={t("adminSettings.zones.visibility.confirmAction")}
          cancelLabel={t("common.actions.cancel")}
          onConfirm={save}
          onClose={() => setConfirming(false)}
        />
      )}
    </form>
  );
}

function ZonesEditor({ initial, readOnly }) {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [saved, setSaved] = useState(initial);
  const [drafts, setDrafts] = useState(initial);
  const tabRefs = useRef({});
  const requested = searchParams.get("zone");
  const activeKey = isCategoryKey(requested) ? requested : CATEGORIES[0].key;
  const active = CATEGORIES.find((category) => category.key === activeKey);
  const dirtyKeys = CATEGORIES.filter((category) => !sameValue(drafts[category.key], saved[category.key])).map(
    (category) => category.key
  );

  useUnsavedWarning(dirtyKeys.length > 0);

  function select(key, focus = false) {
    setSearchParams(key === CATEGORIES[0].key ? {} : { zone: key }, { replace: true, preventScrollReset: true });

    if (focus) {
      tabRefs.current[key]?.focus();
    }
  }

  function onTabKey(event, index) {
    const moves = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: CATEGORIES.length - 1 - index };
    let step = moves[event.key];

    if (step === undefined) {
      return;
    }

    if (document.documentElement.dir === "rtl" && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
      step = -step;
    }

    event.preventDefault();
    select(CATEGORIES[(index + step + CATEGORIES.length) % CATEGORIES.length].key, true);
  }

  return (
    <>
      <div className="set-tabs" role="tablist" aria-label={t("adminSettings.zones.tabs")}>
        {CATEGORIES.map((category, index) => {
          const Icon = category.icon;
          const selected = category.key === activeKey;
          const zone = drafts[category.key];

          return (
            <button
              key={category.key}
              ref={(node) => {
                tabRefs.current[category.key] = node;
              }}
              type="button"
              role="tab"
              id={`zone-tab-${category.key}`}
              aria-selected={selected}
              aria-controls={`zone-panel-${category.key}`}
              tabIndex={selected ? 0 : -1}
              className={`set-tab${selected ? " is-active" : ""}`}
              onClick={() => select(category.key)}
              onKeyDown={(event) => onTabKey(event, index)}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{category.brand}</span>
              {!zone.visible && (
                <span className="set-tab__hidden" title={t("adminSettings.zones.hiddenBadge")}>
                  <EyeOff size={14} aria-hidden="true" />
                  <span className="visually-hidden">{t("adminSettings.zones.hiddenBadge")}</span>
                </span>
              )}
              {dirtyKeys.includes(category.key) && (
                <span className="set-dot" title={t("adminSettings.common.unsaved")}>
                  <span className="visually-hidden">{t("adminSettings.common.unsaved")}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`zone-panel-${activeKey}`} aria-labelledby={`zone-tab-${activeKey}`} className="set-panel">
        <ZoneForm
          key={activeKey}
          category={active}
          draft={drafts[activeKey]}
          saved={saved[activeKey]}
          readOnly={readOnly}
          onChange={(next) =>
            setDrafts((current) => ({
              ...current,
              [activeKey]: typeof next === "function" ? next(current[activeKey]) : next,
            }))
          }
          onSaved={(zones) => {
            setSaved(zones);
            setDrafts((current) => ({ ...current, [activeKey]: zones[activeKey] }));
          }}
        />
      </div>
    </>
  );
}

export default function ZonesPage() {
  const { t } = useI18n();
  const { request, me } = useAdmin();
  const settings = useAdminData(request, "/api/admin/settings");
  const ready = useAllLanguages();
  const zones = settings.data?.settings?.zones;

  return (
    <div className="set-page">
      <div className="console-head">
        <div>
          <h1>{t("adminShell.nav.zones")}</h1>
          <p>{t("adminSettings.zones.lead")}</p>
        </div>
      </div>

      {settings.error && <LoadError message={settings.error} onRetry={settings.reload} retrying={settings.refreshing} />}

      {zones && ready && me ? (
        <ZonesEditor initial={zones} readOnly={false} />
      ) : (
        !settings.error && <CardSkeleton count={3} />
      )}
    </div>
  );
}
