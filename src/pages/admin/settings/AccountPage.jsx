import { useState } from "react";
import { KeyRound, LogOut, ShieldAlert, ShieldCheck, TriangleAlert, UserRound } from "lucide-react";
import Field from "../../../components/Field";
import { useI18n } from "../../../i18n/i18n-context";
import { useToast } from "../../../lib/toast-context";
import { useAdmin } from "../admin-context";
import ConfirmDialog from "../ConfirmDialog";
import { storeToken } from "../useAdminSession";
import { CardSkeleton, PasswordInput, PasswordStrength, SaveBar } from "./settings-ui";
import { EMAIL_PATTERN, MIN_PASSWORD, useUnsavedWarning } from "./settings-utils";
import "./settings.css";

function ProfileForm({ me }) {
  const { t } = useI18n();
  const { request, setMe } = useAdmin();
  const showToast = useToast();
  const [saved, setSaved] = useState({ name: me.name, email: me.email });
  const [form, setForm] = useState(saved);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState("");
  const dirty = form.name !== saved.name || form.email !== saved.email;

  useUnsavedWarning(dirty);

  function validate(values) {
    const errors = {};

    if (!values.name.trim()) errors.name = t("adminSettings.errors.name");
    if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = t("adminSettings.errors.email");

    return errors;
  }

  const errors = checked ? validate(form) : {};

  async function submit(event) {
    event.preventDefault();

    const found = validate(form);
    const first = Object.keys(found)[0];

    setChecked(true);

    if (first) {
      document.getElementById(`me-${first}`)?.focus();
      return;
    }

    setSaving(true);
    setFailure("");

    try {
      const data = await request("/api/admin/me", {
        method: "PUT",
        body: { name: form.name.trim(), email: form.email.trim() },
      });
      const next = { name: data.admin.name, email: data.admin.email };

      setMe(data.admin);
      setSaved(next);
      setForm(next);
      setChecked(false);
      showToast(t("adminSettings.account.profileSaved"));
    } catch (error) {
      if (error.name !== "AbortError") {
        setFailure(error.message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="console-card set-section" aria-labelledby="me-profile" onSubmit={submit} noValidate>
      <div className="console-card__head set-section__head">
        <span className="set-section__icon">
          <UserRound size={20} aria-hidden="true" />
        </span>
        <div className="set-section__titles">
          <h2 id="me-profile">{t("adminSettings.account.profile")}</h2>
          <p>{t("adminSettings.account.profileLead")}</p>
        </div>
      </div>
      <div className="console-card__body set-section__body">
        <div className="set-grid set-grid--two">
          <Field id="me-name" label={t("adminSettings.team.fields.name")} error={errors.name}>
            {(props) => (
              <input {...props} className="input" autoComplete="name" maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            )}
          </Field>
          <Field id="me-email" label={t("adminSettings.team.fields.email")} hint={t("adminSettings.account.emailHint")} error={errors.email}>
            {(props) => (
              <input {...props} type="email" className="input ltr" dir="ltr" autoComplete="email" maxLength={120} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            )}
          </Field>
        </div>
        <div className="set-role-line">
          <span className="field__label">{t("adminSettings.team.fields.role")}</span>
          <span className={`badge${me.role === "owner" ? " badge--signal" : ""}`}>
            {me.role === "owner" && <ShieldCheck size={13} aria-hidden="true" />}
            {t(`adminShell.roles.${me.role}`)}
          </span>
          <p className="field__hint">{t(`adminSettings.team.roles.${me.role}`)}</p>
        </div>
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
          setForm(saved);
          setChecked(false);
          setFailure("");
        }}
      />
    </form>
  );
}

function PasswordForm({ email }) {
  const { t } = useI18n();
  const { request, setMe } = useAdmin();
  const showToast = useToast();
  const empty = { current: "", next: "", confirm: "" };
  const [form, setForm] = useState(empty);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [wrongCurrent, setWrongCurrent] = useState("");
  const [wrongNext, setWrongNext] = useState("");
  const [failure, setFailure] = useState("");

  function validate(values) {
    const errors = {};

    if (!values.current) errors.current = t("adminSettings.errors.currentPassword");
    if (values.next.length < MIN_PASSWORD) errors.next = t("adminSettings.errors.password", { count: MIN_PASSWORD });
    else if (values.next === values.current) errors.next = t("adminSettings.errors.samePassword");
    if (values.confirm !== values.next) errors.confirm = t("adminSettings.errors.confirm");

    return errors;
  }

  const errors = checked ? validate(form) : {};
  const currentError = errors.current || wrongCurrent;
  const nextError = errors.next || wrongNext;

  function update(patch) {
    setForm((current) => ({ ...current, ...patch }));

    if ("current" in patch) {
      setWrongCurrent("");
    }

    if ("next" in patch) {
      setWrongNext("");
    }
  }

  async function submit(event) {
    event.preventDefault();

    const found = validate(form);
    const first = Object.keys(found)[0];

    setChecked(true);

    if (first) {
      document.getElementById(`password-${first}`)?.focus();
      return;
    }

    setSaving(true);
    setFailure("");

    try {
      const data = await request("/api/admin/me", {
        method: "PUT",
        body: { currentPassword: form.current, newPassword: form.next },
      });

      if (data.token) {
        storeToken(data.token);
      }

      setMe(data.admin);
      setForm(empty);
      setChecked(false);
      showToast(t("adminSettings.account.passwordSaved"));
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }

      if (error.status === 400 && error.data?.field === "newPassword") {
        setWrongNext(error.message);
        document.getElementById("password-next")?.focus();
      } else if (error.status === 400) {
        setWrongCurrent(error.message);
        document.getElementById("password-current")?.focus();
      } else {
        setFailure(error.message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="console-card set-section" aria-labelledby="me-password" onSubmit={submit} noValidate>
      <div className="console-card__head set-section__head">
        <span className="set-section__icon">
          <KeyRound size={20} aria-hidden="true" />
        </span>
        <div className="set-section__titles">
          <h2 id="me-password">{t("adminSettings.account.password")}</h2>
          <p>{t("adminSettings.account.passwordLead")}</p>
        </div>
      </div>
      <div className="console-card__body set-section__body">
        <input type="text" className="visually-hidden" autoComplete="username" value={email} readOnly tabIndex={-1} aria-hidden="true" />
        <Field id="password-current" label={t("adminSettings.account.current")} error={currentError}>
          {(props) => (
            <PasswordInput {...props} autoComplete="current-password" value={form.current} maxLength={128} onChange={(current) => update({ current })} />
          )}
        </Field>
        <div className="set-grid set-grid--two">
          <Field id="password-next" label={t("adminSettings.account.next")} error={nextError}>
            {(props) => (
              <>
                <PasswordInput
                  {...props}
                  value={form.next}
                  maxLength={128}
                  onChange={(next) => update({ next })}
                  aria-describedby={[props["aria-describedby"], "password-strength"].filter(Boolean).join(" ")}
                />
                <PasswordStrength id="password-strength" value={form.next} />
              </>
            )}
          </Field>
          <Field id="password-confirm" label={t("adminSettings.account.confirm")} error={errors.confirm}>
            {(props) => <PasswordInput {...props} value={form.confirm} maxLength={128} onChange={(confirm) => update({ confirm })} />}
          </Field>
        </div>
        {failure && (
          <p className="notice notice--stop" role="alert">
            <TriangleAlert size={18} aria-hidden="true" />
            {failure}
          </p>
        )}
      </div>
      <div className="set-savebar">
        <p className="set-savebar__status">{t("adminSettings.account.passwordNote")}</p>
        <div className="set-savebar__actions">
          <button type="submit" className="btn btn--primary" disabled={saving || !form.current || !form.next}>
            {saving && <span className="spinner" aria-hidden="true" />}
            {saving ? t("adminSettings.common.saving") : t("adminSettings.account.change")}
          </button>
        </div>
      </div>
    </form>
  );
}

function SessionsCard() {
  const { t } = useI18n();
  const { request, logout } = useAdmin();
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState("");

  async function signOutEverywhere() {
    setConfirming(false);

    try {
      await request("/api/admin/me/sign-out-everywhere", { method: "POST" });
      logout();
    } catch (error) {
      setFailure(error.message);
    }
  }

  return (
    <section className="console-card set-section" aria-labelledby="me-sessions">
      <div className="console-card__head set-section__head">
        <span className="set-section__icon">
          <LogOut size={20} aria-hidden="true" className="flip-rtl" />
        </span>
        <div className="set-section__titles">
          <h2 id="me-sessions">{t("adminSettings.account.sessions")}</h2>
          <p>{t("adminSettings.account.sessionsLead")}</p>
        </div>
      </div>
      <div className="console-card__body set-section__body">
        {failure && (
          <p className="notice notice--stop" role="alert">
            <TriangleAlert size={18} aria-hidden="true" />
            {failure}
          </p>
        )}
        <div>
          <button type="button" className="btn btn--outline" onClick={() => setConfirming(true)}>
            {t("adminSettings.account.signOutEverywhere")}
          </button>
        </div>
      </div>
      {confirming && (
        <ConfirmDialog
          title={t("adminSettings.account.signOutConfirmTitle")}
          description={t("adminSettings.account.signOutConfirmText")}
          confirmLabel={t("adminSettings.account.signOutEverywhere")}
          cancelLabel={t("common.actions.cancel")}
          tone="dark"
          onConfirm={signOutEverywhere}
          onClose={() => setConfirming(false)}
        />
      )}
    </section>
  );
}

export default function AccountPage() {
  const { t } = useI18n();
  const { me } = useAdmin();

  return (
    <div className="set-page">
      <div className="console-head">
        <div>
          <h1>{t("adminShell.nav.account")}</h1>
          <p>{t("adminSettings.account.lead")}</p>
        </div>
      </div>

      {me ? (
        <div className="set-stack set-narrow-page">
          {me.mustChangePassword && (
            <div className="notice notice--wait" role="status">
              <ShieldAlert size={20} aria-hidden="true" />
              <p>
                <strong>{t("adminSettings.account.mustChangeTitle")}</strong> {t("adminSettings.account.mustChangeText")}
              </p>
            </div>
          )}
          <ProfileForm key={me.id} me={me} />
          <PasswordForm email={me.email} />
          <SessionsCard />
        </div>
      ) : (
        <CardSkeleton count={2} />
      )}
    </div>
  );
}
