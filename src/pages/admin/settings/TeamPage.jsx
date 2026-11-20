import { useRef, useState } from "react";
import { Lock, Pencil, ShieldCheck, Trash2, TriangleAlert, UserPlus, UserRound } from "lucide-react";
import Field from "../../../components/Field";
import { useI18n } from "../../../i18n/i18n-context";
import { formatRelativeDay } from "../../../lib/format";
import { useToast } from "../../../lib/toast-context";
import { useAdmin } from "../admin-context";
import AdminDialog from "../AdminDialog";
import ConfirmDialog from "../ConfirmDialog";
import { LoadError } from "../PanelStates";
import { useAdminData } from "../useAdminSession";
import { CardSkeleton, ChoiceGroup, PasswordInput, PasswordStrength, Switch } from "./settings-ui";
import { EMAIL_PATTERN, MIN_PASSWORD } from "./settings-utils";
import "./settings.css";

const ROLES = ["owner", "moderator"];

function initials(name) {
  return (name || "?")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function AccountDialog({ user, isSelf, onClose, onSaved }) {
  const { t } = useI18n();
  const { request } = useAdmin();
  const nameRef = useRef(null);
  const editing = Boolean(user);
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    role: user?.role || "moderator",
    active: user ? Boolean(user.active) : true,
    password: "",
  });
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState("");

  function validate(values) {
    const errors = {};

    if (!values.name.trim()) errors.name = t("adminSettings.errors.name");
    if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = t("adminSettings.errors.email");
    if ((!editing || values.password) && values.password.length < MIN_PASSWORD) {
      errors.password = t("adminSettings.errors.password", { count: MIN_PASSWORD });
    }

    return errors;
  }

  const errors = checked ? validate(form) : {};

  function update(patch) {
    setForm((current) => ({ ...current, ...patch }));
  }

  async function submit(event) {
    event.preventDefault();

    const found = validate(form);
    const first = Object.keys(found)[0];

    setChecked(true);

    if (first) {
      document.getElementById(`account-${first}`)?.focus();
      return;
    }

    setSaving(true);
    setFailure("");

    const body = { name: form.name.trim(), email: form.email.trim() };

    if (!isSelf) {
      body.role = form.role;
    }

    if (editing && !isSelf) {
      body.active = form.active;
    }

    if (form.password) {
      body.password = form.password;
    }

    try {
      const data = await request(editing ? `/api/admin/users/${user.id}` : "/api/admin/users", {
        method: editing ? "PUT" : "POST",
        body,
      });

      onSaved(data.user, editing);
    } catch (error) {
      if (error.name !== "AbortError") {
        setFailure(error.message);
        setSaving(false);
      }
    }
  }

  return (
    <AdminDialog
      title={editing ? t("adminSettings.team.dialog.editTitle", { name: user.name }) : t("adminSettings.team.dialog.addTitle")}
      description={editing ? undefined : t("adminSettings.team.dialog.addText")}
      onClose={onClose}
      initialFocusRef={nameRef}
      locked={saving}
      size="medium"
    >
      <form className="set-dialog-form" onSubmit={submit} noValidate>
        <Field id="account-name" label={t("adminSettings.team.fields.name")} error={errors.name}>
          {(props) => (
            <input {...props} ref={nameRef} className="input" autoComplete="off" maxLength={80} value={form.name} onChange={(event) => update({ name: event.target.value })} />
          )}
        </Field>
        <Field id="account-email" label={t("adminSettings.team.fields.email")} error={errors.email}>
          {(props) => (
            <input {...props} type="email" className="input ltr" dir="ltr" autoComplete="off" maxLength={120} value={form.email} onChange={(event) => update({ email: event.target.value })} />
          )}
        </Field>

        <ChoiceGroup
          name="account-role"
          legend={t("adminSettings.team.fields.role")}
          hint={isSelf ? t("adminSettings.team.dialog.selfRole") : undefined}
          value={form.role}
          disabled={isSelf}
          onChange={(role) => update({ role })}
          options={ROLES.map((role) => ({
            value: role,
            label: t(`adminShell.roles.${role}`),
            description: t(`adminSettings.team.roles.${role}`),
          }))}
        />

        {editing && !isSelf && (
          <Switch
            id="account-active"
            checked={form.active}
            onChange={(active) => update({ active })}
            label={t("adminSettings.team.fields.active")}
            description={t("adminSettings.team.fields.activeHint")}
          />
        )}

        <Field
          id="account-password"
          label={editing ? t("adminSettings.team.fields.newPassword") : t("adminSettings.team.fields.tempPassword")}
          optional={editing}
          hint={editing ? t("adminSettings.team.fields.newPasswordHint") : t("adminSettings.team.fields.tempPasswordHint")}
          error={errors.password}
        >
          {(props) => (
            <>
              <PasswordInput
                {...props}
                generate
                value={form.password}
                maxLength={128}
                onChange={(password) => update({ password })}
                aria-describedby={[props["aria-describedby"], "account-password-strength"].filter(Boolean).join(" ")}
              />
              {form.password && <PasswordStrength id="account-password-strength" value={form.password} />}
            </>
          )}
        </Field>

        {failure && (
          <p className="notice notice--stop" role="alert">
            <TriangleAlert size={18} aria-hidden="true" />
            {failure}
          </p>
        )}

        <div className="admin-dialog__actions">
          <button type="button" className="btn btn--outline" onClick={onClose} disabled={saving}>
            {t("common.actions.cancel")}
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving && <span className="spinner" aria-hidden="true" />}
            {editing ? t("adminSettings.common.save") : t("adminSettings.team.dialog.create")}
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}

function TeamList({ users, me, onEdit, onDelete }) {
  const { t } = useI18n();

  return (
    <ul className="set-team" aria-label={t("adminSettings.team.listLabel")}>
      {users.map((user) => {
        const isSelf = user.id === me?.id;

        return (
          <li key={user.id} className={`set-member${user.active ? "" : " is-off"}`}>
            <span className="set-member__avatar" aria-hidden="true">
              {initials(user.name)}
            </span>
            <div className="set-member__who">
              <p className="set-member__name">
                {user.name}
                {isSelf && <span className="badge badge--info">{t("adminSettings.team.you")}</span>}
              </p>
              <p className="set-member__email ltr">{user.email}</p>
            </div>
            <div className="set-member__meta">
              <span className={`badge${user.role === "owner" ? " badge--signal" : ""}`}>
                {user.role === "owner" && <ShieldCheck size={13} aria-hidden="true" />}
                {t(`adminShell.roles.${user.role}`)}
              </span>
              <span className={`badge ${user.active ? "badge--go" : "badge--stop"}`}>
                {user.active ? t("adminSettings.team.active") : t("adminSettings.team.inactive")}
              </span>
            </div>
            <p className="set-member__login">
              {user.last_login_at
                ? t("adminSettings.team.lastLogin", { when: formatRelativeDay(user.last_login_at) })
                : t("adminSettings.team.neverLoggedIn")}
            </p>
            <div className="set-member__actions">
              <button
                type="button"
                className="admin-icon-btn"
                onClick={() => onEdit(user)}
                aria-label={t("adminSettings.team.edit", { name: user.name })}
                title={t("adminSettings.team.editShort")}
              >
                <Pencil size={18} aria-hidden="true" />
              </button>
              {!isSelf && (
                <button
                  type="button"
                  className="admin-icon-btn set-danger-icon"
                  onClick={() => onDelete(user)}
                  aria-label={t("adminSettings.team.delete", { name: user.name })}
                  title={t("adminSettings.team.deleteShort")}
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function OwnerTeam() {
  const { t } = useI18n();
  const { request, me, setMe } = useAdmin();
  const showToast = useToast();
  const team = useAdminData(request, "/api/admin/users");
  const [dialog, setDialog] = useState(null);
  const [removing, setRemoving] = useState(null);
  const users = team.data?.users;

  function saved(user, editing) {
    setDialog(null);
    team.reload();

    if (user.id === me?.id) {
      setMe({ ...me, name: user.name, email: user.email });
    }

    showToast(
      editing ? t("adminSettings.team.toasts.updated", { name: user.name }) : t("adminSettings.team.toasts.created", { name: user.name })
    );
  }

  async function remove() {
    const user = removing;

    setRemoving(null);

    try {
      await request(`/api/admin/users/${user.id}`, { method: "DELETE" });
      team.reload();
      showToast(t("adminSettings.team.toasts.deleted", { name: user.name }));
    } catch (error) {
      if (error.name !== "AbortError") {
        showToast(error.message, { tone: "error", duration: 6000 });
      }
    }
  }

  return (
    <>
      <div className="set-team-layout">
        <section className="console-card" aria-labelledby="team-members">
          <div className="console-card__head">
            <h2 id="team-members">
              {t("adminSettings.team.members")}
              {users && <span className="set-count numeric">{users.length}</span>}
            </h2>
            <button type="button" className="btn btn--primary btn--small" onClick={() => setDialog({ user: null })} data-focus-return>
              <UserPlus size={16} aria-hidden="true" />
              {t("adminSettings.team.add")}
            </button>
          </div>
          <div className="console-card__body set-team-body">
            {team.error && <LoadError message={team.error} onRetry={team.reload} retrying={team.refreshing} />}
            {!users && !team.error && <CardSkeleton count={1} />}
            {users && <TeamList users={users} me={me} onEdit={(user) => setDialog({ user })} onDelete={setRemoving} />}
          </div>
        </section>

        <aside className="console-card set-roles" aria-labelledby="team-roles">
          <div className="console-card__head">
            <h2 id="team-roles">{t("adminSettings.team.rolesTitle")}</h2>
          </div>
          <dl className="console-card__body set-roles__list">
            {ROLES.map((role) => (
              <div key={role} className="set-roles__item">
                <dt>
                  {role === "owner" ? <ShieldCheck size={18} aria-hidden="true" /> : <UserRound size={18} aria-hidden="true" />}
                  {t(`adminShell.roles.${role}`)}
                </dt>
                <dd>{t(`adminSettings.team.roles.${role}`)}</dd>
              </div>
            ))}
            <p className="field__hint">{t("adminSettings.team.rolesNote")}</p>
          </dl>
        </aside>
      </div>

      {dialog && (
        <AccountDialog user={dialog.user} isSelf={dialog.user?.id === me?.id} onClose={() => setDialog(null)} onSaved={saved} />
      )}

      {removing && (
        <ConfirmDialog
          title={t("adminSettings.team.confirmDelete.title", { name: removing.name })}
          description={t("adminSettings.team.confirmDelete.text")}
          confirmLabel={t("adminSettings.team.confirmDelete.action")}
          cancelLabel={t("common.actions.cancel")}
          onConfirm={remove}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}

export default function TeamPage() {
  const { t } = useI18n();
  const { me, isOwner } = useAdmin();

  return (
    <div className="set-page">
      <div className="console-head">
        <div>
          <h1>{t("adminShell.nav.team")}</h1>
          <p>{t("adminSettings.team.lead")}</p>
        </div>
      </div>

      {!me && <CardSkeleton count={1} />}

      {me && !isOwner && (
        <div className="notice set-readonly" role="status">
          <Lock size={18} aria-hidden="true" />
          <div>
            <p className="set-readonly__title">{t("adminSettings.common.ownerOnly.title")}</p>
            <p>{t("adminSettings.team.ownerOnly")}</p>
          </div>
        </div>
      )}

      {isOwner && <OwnerTeam />}
    </div>
  );
}
