import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CalendarDays, CircleCheck, Images, Info, Lock, Mail, Megaphone, Palette, Phone, TriangleAlert, Wrench } from "lucide-react";
import Field from "../../../components/Field";
import { useI18n } from "../../../i18n/i18n-context";
import { LANGUAGES } from "../../../i18n/config";
import { useToast } from "../../../lib/toast-context";
import { useAdmin } from "../admin-context";
import ConfirmDialog from "../ConfirmDialog";
import { LoadError } from "../PanelStates";
import { useAdminData } from "../useAdminSession";
import { CardSkeleton, ChoiceGroup, LanguageFields, SaveBar, Switch } from "./settings-ui";
import { EMAIL_PATTERN, hasText, isPhone, isSiteLink, isWebUrl, sameValue, useUnsavedWarning } from "./settings-utils";
import "./settings.css";

const SOCIAL = ["facebook", "instagram", "tiktok", "youtube"];
const TONES = { info: Info, success: CircleCheck, warning: TriangleAlert };
const SLOTS = [30, 45, 60, 90, 120];

function SettingsSection({ settingKey, icon: Icon, initial, validate, confirmWhen, onDirty, children }) {
  const { t } = useI18n();
  const { request } = useAdmin();
  const showToast = useToast();
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState("");
  const [confirming, setConfirming] = useState(false);
  const dirty = !sameValue(draft, saved);
  const errors = checked && validate ? validate(draft, t) : {};
  const titleId = `settings-${settingKey}-title`;

  useEffect(() => {
    onDirty(settingKey, dirty);
  }, [onDirty, settingKey, dirty]);

  function update(patch) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function save() {
    setConfirming(false);
    setSaving(true);
    setFailure("");

    try {
      const data = await request(`/api/admin/settings/${settingKey}`, { method: "PUT", body: draft });

      setSaved(data.value);
      setDraft(data.value);
      setChecked(false);
      showToast(t("adminSettings.site.saved", { section: t(`adminSettings.site.${settingKey}.title`) }));
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

    const found = validate ? validate(draft, t) : {};
    const first = Object.keys(found)[0];

    setChecked(true);

    if (first) {
      document.getElementById(`${settingKey}-${first}`)?.focus();
      return;
    }

    if (confirmWhen?.(draft, saved)) {
      setConfirming(true);
      return;
    }

    save();
  }

  return (
    <form className="console-card set-section" aria-labelledby={titleId} onSubmit={submit} noValidate>
      <div className="console-card__head set-section__head">
        <span className="set-section__icon">
          <Icon size={20} aria-hidden="true" />
        </span>
        <div className="set-section__titles">
          <h2 id={titleId}>{t(`adminSettings.site.${settingKey}.title`)}</h2>
          <p>{t(`adminSettings.site.${settingKey}.lead`)}</p>
        </div>
      </div>
      <div className="console-card__body set-section__body">
        {children({ draft, update, errors, field: (name) => `${settingKey}-${name}` })}
        {failure && (
          <p className="notice notice--stop" role="alert">
            <TriangleAlert size={18} aria-hidden="true" />
            {failure}
          </p>
        )}
      </div>
      <SaveBar
        dirty={dirty}
        saving={saving}
        onDiscard={() => {
          setDraft(saved);
          setChecked(false);
          setFailure("");
        }}
      />
      {confirming && (
        <ConfirmDialog
          title={t(`adminSettings.site.${settingKey}.confirm.title`)}
          description={t(`adminSettings.site.${settingKey}.confirm.text`)}
          confirmLabel={t(`adminSettings.site.${settingKey}.confirm.action`)}
          cancelLabel={t("common.actions.cancel")}
          onConfirm={save}
          onClose={() => setConfirming(false)}
        />
      )}
    </form>
  );
}

function validateSite(draft, t) {
  const errors = {};

  if (draft.phone.trim() && !isPhone(draft.phone.trim())) errors.phone = t("adminSettings.errors.phone");
  if (draft.whatsapp.trim() && !isPhone(draft.whatsapp.trim()) && !isWebUrl(draft.whatsapp.trim())) {
    errors.whatsapp = t("adminSettings.errors.whatsapp");
  }
  if (draft.email.trim() && !EMAIL_PATTERN.test(draft.email.trim())) errors.email = t("adminSettings.errors.email");

  SOCIAL.forEach((network) => {
    const value = draft.social[network].trim();

    if (value && !isWebUrl(value)) errors[`social-${network}`] = t("adminSettings.errors.url");
  });

  return errors;
}

function validateAnnouncement(draft, t) {
  const errors = {};

  if (draft.enabled && !draft.text.en.trim()) {
    errors["text-en"] = hasText(draft.text) ? t("adminSettings.errors.englishNeeded") : t("adminSettings.errors.textNeeded");
  }
  if (draft.link.trim() && !isSiteLink(draft.link.trim())) errors.link = t("adminSettings.errors.link");

  return errors;
}

function validateListings(draft, t) {
  const photos = Number(draft.maxPhotos);

  return Number.isInteger(photos) && photos >= 1 && photos <= 9 ? {} : { maxPhotos: t("adminSettings.errors.photos") };
}

function ContactFields({ draft, update, errors, field }) {
  const { t } = useI18n();

  return (
    <>
      <div className="set-grid">
        <Field id={field("phone")} label={t("adminSettings.site.site.phone")} error={errors.phone}>
          {(props) => (
            <input {...props} type="tel" className="input ltr" dir="ltr" autoComplete="off" maxLength={40} value={draft.phone} onChange={(event) => update({ phone: event.target.value })} />
          )}
        </Field>
        <Field
          id={field("whatsapp")}
          label={t("adminSettings.site.site.whatsapp")}
          optional
          hint={t("adminSettings.site.site.whatsappHint")}
          error={errors.whatsapp}
        >
          {(props) => (
            <input {...props} type="tel" className="input ltr" dir="ltr" autoComplete="off" maxLength={40} value={draft.whatsapp} onChange={(event) => update({ whatsapp: event.target.value })} />
          )}
        </Field>
        <Field id={field("email")} label={t("adminSettings.site.site.email")} error={errors.email}>
          {(props) => (
            <input {...props} type="email" className="input ltr" dir="ltr" autoComplete="off" maxLength={120} value={draft.email} onChange={(event) => update({ email: event.target.value })} />
          )}
        </Field>
      </div>

      <LanguageFields
        id={field("address")}
        legend={t("adminSettings.site.site.address")}
        hint={t("adminSettings.site.site.addressHint")}
        values={draft.address}
        maxLength={200}
        onChange={(address) => update({ address })}
      />
      <LanguageFields
        id={field("hours")}
        legend={t("adminSettings.site.site.hours")}
        values={draft.hours}
        maxLength={120}
        onChange={(hours) => update({ hours })}
      />

      <fieldset className="set-fieldset">
        <legend className="set-langs__legend">{t("adminSettings.site.site.social")}</legend>
        <p className="field__hint">{t("adminSettings.site.site.socialHint")}</p>
        <div className="set-grid">
          {SOCIAL.map((network) => (
            <Field key={network} id={field(`social-${network}`)} label={t(`adminSettings.site.site.networks.${network}`)} optional error={errors[`social-${network}`]}>
              {(props) => (
                <input
                  {...props}
                  type="url"
                  className="input ltr"
                  dir="ltr"
                  placeholder="https://"
                  maxLength={500}
                  value={draft.social[network]}
                  onChange={(event) => update({ social: { ...draft.social, [network]: event.target.value } })}
                />
              )}
            </Field>
          ))}
        </div>
      </fieldset>
    </>
  );
}

function AnnouncementFields({ draft, update, errors, field }) {
  const { t, language } = useI18n();
  const Icon = TONES[draft.tone] || Info;
  const text = draft.text[language]?.trim() || draft.text.en.trim();

  return (
    <>
      <Switch
        id={field("enabled")}
        checked={draft.enabled}
        onChange={(enabled) => update({ enabled })}
        label={t("adminSettings.site.announcement.enabled")}
        description={t("adminSettings.site.announcement.enabledHint")}
      />
      <ChoiceGroup
        name={field("tone")}
        legend={t("adminSettings.site.announcement.tone")}
        value={draft.tone}
        onChange={(tone) => update({ tone })}
        options={Object.keys(TONES).map((tone) => ({ value: tone, label: t(`adminSettings.site.announcement.tones.${tone}`) }))}
      />
      <LanguageFields
        id={field("text")}
        legend={t("adminSettings.site.announcement.text")}
        hint={t("adminSettings.site.announcement.textHint")}
        values={draft.text}
        maxLength={240}
        onChange={(value) => update({ text: value })}
        errors={{ en: errors["text-en"] }}
      />
      <Field id={field("link")} label={t("adminSettings.site.announcement.link")} optional hint={t("adminSettings.site.announcement.linkHint")} error={errors.link}>
        {(props) => (
          <input {...props} type="url" className="input ltr" dir="ltr" placeholder="/contact" maxLength={500} value={draft.link} onChange={(event) => update({ link: event.target.value })} />
        )}
      </Field>

      <div className="set-preview">
        <p className="set-preview__label">{t("adminSettings.common.preview")}</p>
        <div className={`set-announce set-announce--${draft.tone}`}>
          <Icon size={18} className="set-announce__icon" aria-hidden="true" />
          <p className="set-announce__text">
            {text || <span className="set-announce__empty">{t("adminSettings.site.announcement.empty")}</span>}
            {text && draft.link.trim() && (
              <span className="set-announce__link">
                {t("adminSettings.site.announcement.more")}
                <ArrowRight size={15} className="flip-rtl" aria-hidden="true" />
              </span>
            )}
          </p>
        </div>
        {!draft.enabled && <p className="field__hint">{t("adminSettings.site.announcement.offHint")}</p>}
      </div>
    </>
  );
}

function MaintenanceFields({ draft, update, field }) {
  const { t } = useI18n();

  return (
    <>
      <div className="notice notice--wait">
        <TriangleAlert size={18} aria-hidden="true" />
        <p>{t("adminSettings.site.maintenance.warning")}</p>
      </div>
      <Switch
        id={field("enabled")}
        tone="danger"
        checked={draft.enabled}
        onChange={(enabled) => update({ enabled })}
        label={t("adminSettings.site.maintenance.enabled")}
        description={t("adminSettings.site.maintenance.enabledHint")}
      />
      <LanguageFields
        id={field("message")}
        legend={t("adminSettings.site.maintenance.message")}
        hint={t("adminSettings.site.maintenance.messageHint")}
        values={draft.message}
        maxLength={400}
        multiline
        onChange={(message) => update({ message })}
      />
    </>
  );
}

function DefaultsFields({ draft, update, field }) {
  const { t } = useI18n();

  return (
    <div className="set-grid set-grid--two">
      <ChoiceGroup
        name={field("language")}
        legend={t("adminSettings.site.defaults.language")}
        value={draft.language}
        onChange={(language) => update({ language })}
        options={LANGUAGES.map((item) => ({ value: item.code, label: item.label, lang: item.code }))}
      />
      <ChoiceGroup
        name={field("theme")}
        legend={t("adminSettings.site.defaults.theme")}
        value={draft.theme}
        onChange={(theme) => update({ theme })}
        options={["light", "dark"].map((theme) => ({ value: theme, label: t(`adminSettings.site.defaults.themes.${theme}`) }))}
      />
    </div>
  );
}

function ListingsFields({ draft, update, errors, field }) {
  const { t } = useI18n();

  return (
    <>
      <Switch
        id={field("requireApproval")}
        checked={draft.requireApproval}
        onChange={(requireApproval) => update({ requireApproval })}
        label={t("adminSettings.site.listings.requireApproval")}
        description={t("adminSettings.site.listings.requireApprovalHint")}
      />
      {!draft.requireApproval && (
        <div className="notice notice--wait">
          <TriangleAlert size={18} aria-hidden="true" />
          <p>{t("adminSettings.site.listings.directWarning")}</p>
        </div>
      )}
      <Field id={field("maxPhotos")} label={t("adminSettings.site.listings.maxPhotos")} hint={t("adminSettings.site.listings.maxPhotosHint")} error={errors.maxPhotos} className="set-narrow">
        {(props) => (
          <input
            {...props}
            type="number"
            inputMode="numeric"
            className="input numeric"
            min={1}
            max={9}
            step={1}
            value={draft.maxPhotos}
            onChange={(event) => update({ maxPhotos: event.target.value === "" ? "" : Number(event.target.value) })}
          />
        )}
      </Field>
    </>
  );
}

function InspectionsFields({ draft, update, field }) {
  const { t } = useI18n();

  return (
    <>
      <Switch
        id={field("enabled")}
        checked={draft.enabled}
        onChange={(enabled) => update({ enabled })}
        label={t("adminSettings.site.inspections.enabled")}
        description={t("adminSettings.site.inspections.enabledHint")}
      />
      <Field id={field("slotMinutes")} label={t("adminSettings.site.inspections.slot")} hint={t("adminSettings.site.inspections.slotHint")} className="set-narrow">
        {(props) => (
          <select {...props} className="select" value={draft.slotMinutes} onChange={(event) => update({ slotMinutes: Number(event.target.value) })}>
            {SLOTS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {t("adminSettings.site.inspections.minutes", { count: minutes })}
              </option>
            ))}
          </select>
        )}
      </Field>
    </>
  );
}

function ContactFormFields({ draft, update, field }) {
  const { t } = useI18n();

  return (
    <Switch
      id={field("enabled")}
      checked={draft.enabled}
      onChange={(enabled) => update({ enabled })}
      label={t("adminSettings.site.contact.enabled")}
      description={t("adminSettings.site.contact.enabledHint")}
    />
  );
}

const SECTIONS = [
  { key: "site", icon: Phone, fields: ContactFields, validate: validateSite },
  { key: "announcement", icon: Megaphone, fields: AnnouncementFields, validate: validateAnnouncement },
  {
    key: "maintenance",
    icon: Wrench,
    fields: MaintenanceFields,
    confirmWhen: (draft, saved) => draft.enabled && !saved.enabled,
  },
  { key: "defaults", icon: Palette, fields: DefaultsFields },
  { key: "listings", icon: Images, fields: ListingsFields, validate: validateListings },
  { key: "inspections", icon: CalendarDays, fields: InspectionsFields },
  { key: "contact", icon: Mail, fields: ContactFormFields },
];

export default function SettingsPage() {
  const { t } = useI18n();
  const { request, me, isOwner } = useAdmin();
  const settings = useAdminData(request, isOwner ? "/api/admin/settings" : null);
  const [dirtyKeys, setDirtyKeys] = useState([]);
  const data = settings.data?.settings;

  useUnsavedWarning(dirtyKeys.length > 0);

  const markDirty = useCallback((key, dirty) => {
    setDirtyKeys((current) => {
      if (dirty === current.includes(key)) {
        return current;
      }

      return dirty ? [...current, key] : current.filter((item) => item !== key);
    });
  }, []);

  return (
    <div className="set-page">
      <div className="console-head">
        <div>
          <h1>{t("adminShell.nav.settings")}</h1>
          <p>{t("adminSettings.site.lead")}</p>
        </div>
      </div>

      {me && !isOwner && (
        <div className="notice set-readonly" role="status">
          <Lock size={18} aria-hidden="true" />
          <div>
            <p className="set-readonly__title">{t("adminSettings.common.ownerOnly.title")}</p>
            <p>{t("adminSettings.site.ownerOnly")}</p>
          </div>
        </div>
      )}

      {isOwner && settings.error && <LoadError message={settings.error} onRetry={settings.reload} retrying={settings.refreshing} />}

      {(!me || (isOwner && !data && !settings.error)) && <CardSkeleton count={3} />}

      {isOwner && data && (
        <>
          <nav className="set-jump" aria-label={t("adminSettings.site.jump")}>
            <ul>
              {SECTIONS.map((section) => (
                <li key={section.key}>
                  <a href={`#settings-${section.key}-title`} className="set-jump__link">
                    {t(`adminSettings.site.${section.key}.title`)}
                    {dirtyKeys.includes(section.key) && (
                      <span className="set-dot" title={t("adminSettings.common.unsaved")}>
                        <span className="visually-hidden">{t("adminSettings.common.unsaved")}</span>
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="set-stack">
            {SECTIONS.map((section) => {
              const Fields = section.fields;

              return (
                <SettingsSection
                  key={section.key}
                  settingKey={section.key}
                  icon={section.icon}
                  initial={data[section.key]}
                  validate={section.validate}
                  confirmWhen={section.confirmWhen}
                  onDirty={markDirty}
                >
                  {(props) => <Fields {...props} />}
                </SettingsSection>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
