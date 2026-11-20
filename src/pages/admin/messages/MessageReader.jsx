import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CarFront,
  CircleCheck,
  ExternalLink,
  Mail,
  MailOpen,
  MessageCircle,
  Pencil,
  Phone,
  Reply,
  Trash2,
} from "lucide-react";
import { loadLanguage, translate } from "../../../i18n/core";
import { useI18n } from "../../../i18n/i18n-context";
import { isCategoryKey, listingPath } from "../../../lib/categories";
import { formatDate } from "../../../lib/format";
import { useToast } from "../../../lib/toast-context";
import { isolate } from "../admin-config";
import { useAdmin } from "../admin-context";
import ConfirmDialog from "../ConfirmDialog";
import { LoadError } from "../PanelStates";
import { isQuietError } from "../listings/listing-helpers";
import { useAdminData } from "../useAdminSession";
import ZoneTag from "../ZoneTag";
import { languageName, STATUS_TONES, telHref, whatsappHref } from "./message-utils";

function useReplyLanguage(code) {
  const [ready, setReady] = useState("");

  useEffect(() => {
    let live = true;

    loadLanguage(code)
      .then(() => live && setReady(code))
      .catch(() => undefined);

    return () => {
      live = false;
    };
  }, [code]);

  return ready === code ? code : undefined;
}

function mailtoHref(message, language) {
  const subject = translate(
    "adminMessages.reply.subject",
    { subject: translate(`adminMessages.subjects.${message.subject}`, {}, language) },
    language
  );
  const body = `${translate("adminMessages.reply.greeting", { name: message.name }, language)}\n\n`;

  return `mailto:${message.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function MessageReader({ id, listItem, backHref, focusOnLoad, onChanged }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const showToast = useToast();
  const { request, refreshSummary } = useAdmin();
  const detail = useAdminData(request, `/api/admin/messages/${id}`);
  const [override, setOverride] = useState(null);
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState("");
  const [noteState, setNoteState] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const headingRef = useRef(null);
  const unreadAtOpen = useRef(!listItem || listItem.status === "new");
  const noteId = useId();
  const message = override || detail.data?.message;
  const replyLanguage = useReplyLanguage(message?.language || "en");
  const needsListing = Boolean(message?.listing_id) && !listItem?.listing_name;
  const listingData = useAdminData(request, needsListing ? `/api/admin/cars/${message.listing_id}` : null);
  const listing = listItem?.listing_name
    ? { id: message?.listing_id, name: listItem.listing_name, year: listItem.listing_year, category: listItem.listing_category }
    : listingData.data?.car;

  useEffect(() => {
    if (!detail.data?.message) {
      return;
    }

    if (unreadAtOpen.current) {
      refreshSummary();
      onChanged();
    }

    if (focusOnLoad) {
      headingRef.current?.focus();
    }
  }, [detail.data, refreshSummary, onChanged, focusOnLoad]);

  async function update(body, toastKey, after) {
    setBusy(toastKey);

    try {
      const data = await request(`/api/admin/messages/${id}`, { method: "PATCH", body });

      setOverride(data.message);
      showToast(t(`adminMessages.toasts.${toastKey}`), { tone: "success" });
      refreshSummary();
      onChanged();
      after?.();
    } catch (error) {
      if (!isQuietError(error)) {
        showToast(error.message, { tone: "error" });
      }
    } finally {
      setBusy("");
    }
  }

  async function saveNote(event) {
    event.preventDefault();
    setNoteState("saving");

    try {
      const data = await request(`/api/admin/messages/${id}`, { method: "PATCH", body: { note: note ?? message.note } });

      setOverride(data.message);
      setNote(null);
      setNoteState("saved");
    } catch (error) {
      if (!isQuietError(error)) {
        setNoteState("");
        showToast(error.message, { tone: "error" });
      }
    }
  }

  async function remove() {
    setConfirmDelete(false);
    setBusy("deleted");

    try {
      await request(`/api/admin/messages/${id}`, { method: "DELETE" });
      showToast(t("adminMessages.toasts.deleted"), { tone: "success" });
      refreshSummary();
      onChanged();
      navigate(backHref, { replace: true });
    } catch (error) {
      if (!isQuietError(error)) {
        showToast(error.message, { tone: "error" });
      }

      setBusy("");
    }
  }

  const back = (
    <Link className="btn btn--ghost btn--small inbox-reader__back" to={backHref}>
      <ArrowLeft size={18} aria-hidden="true" className="flip-rtl" />
      {t("adminMessages.back")}
    </Link>
  );

  if (detail.error) {
    return (
      <div className="inbox-reader__state">
        {back}
        <LoadError message={detail.error} onRetry={detail.reload} retrying={detail.refreshing} />
      </div>
    );
  }

  if (!message) {
    return (
      <div className="inbox-reader__state" aria-busy="true">
        {back}
        <p className="visually-hidden" role="status">
          {t("adminMessages.loadingMessage")}
        </p>
        <div className="skeleton admin-skeleton-line admin-skeleton-line--title" />
        <div className="skeleton admin-skeleton-line" />
        <div className="skeleton admin-skeleton-line admin-skeleton-line--short" />
      </div>
    );
  }

  const whatsapp = message.phone ? whatsappHref(message.phone) : "";
  const noteValue = note ?? message.note ?? "";
  const archived = message.status === "archived";
  const disabled = Boolean(busy);

  return (
    <article className="inbox-reader__message" aria-labelledby={`${noteId}-title`} aria-busy={disabled || undefined}>
      {back}

      <header className="inbox-reader__head">
        <div className="inbox-reader__tags">
          <span className={`badge ${STATUS_TONES[message.status] ? `badge--${STATUS_TONES[message.status]}` : ""}`}>
            {t(`adminMessages.status.${message.status}`)}
          </span>
          {isCategoryKey(message.category) && <ZoneTag category={message.category} />}
          <span className="badge inbox-lang" title={t("adminMessages.writtenIn", { language: languageName(message.language) })}>
            <span aria-hidden="true">{message.language.toUpperCase()}</span>
            <span className="visually-hidden">{t("adminMessages.writtenIn", { language: languageName(message.language) })}</span>
          </span>
        </div>
        <h2 id={`${noteId}-title`} ref={headingRef} tabIndex={-1} className="inbox-reader__subject">
          {t(`adminMessages.subjects.${message.subject}`)}
        </h2>
        <p className="inbox-reader__date">
          {t("adminMessages.received", {
            date: formatDate(message.created_at, {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
          })}
        </p>
      </header>

      <section className="inbox-sender" aria-label={t("adminMessages.sender")}>
        <span className="inbox-sender__avatar" aria-hidden="true">
          {message.name.trim().charAt(0).toUpperCase()}
        </span>
        <div className="inbox-sender__main">
          <p className="inbox-sender__name">
            <bdi>{message.name}</bdi>
          </p>
          <ul className="inbox-sender__links">
            {message.email && (
              <li>
                <a className="admin-contact__link" href={`mailto:${message.email}`}>
                  <Mail size={16} aria-hidden="true" />
                  <span className="ltr">{message.email}</span>
                </a>
              </li>
            )}
            {message.phone && (
              <li>
                <a className="admin-contact__link numeric" href={telHref(message.phone)}>
                  <Phone size={16} aria-hidden="true" />
                  <span className="ltr">{message.phone}</span>
                </a>
              </li>
            )}
            {whatsapp && (
              <li>
                <a className="admin-contact__link" href={whatsapp} target="_blank" rel="noreferrer">
                  <MessageCircle size={16} aria-hidden="true" />
                  {t("adminMessages.whatsapp")}
                  <span className="visually-hidden"> {t("admin.newTab")}</span>
                </a>
              </li>
            )}
          </ul>
        </div>
      </section>

      {message.listing_id && (
        <section className="inbox-listing" aria-label={t("adminMessages.listing")}>
          <CarFront size={18} aria-hidden="true" />
          <span className="inbox-listing__name">
            {listing ? `${listing.name} ${listing.year}` : t("adminMessages.listingNumber", { id: message.listing_id })}
          </span>
          <span className="inbox-listing__links">
            <Link className="admin-contact__link" to={`/admin/listings/${message.listing_id}`}>
              <Pencil size={16} aria-hidden="true" />
              {t("adminMessages.editListing")}
            </Link>
            {listing && (
              <a
                className="admin-contact__link"
                href={listingPath({ category: listing.category, id: message.listing_id })}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={16} aria-hidden="true" className="flip-rtl" />
                {t("adminMessages.viewListing")}
                <span className="visually-hidden"> {t("admin.newTab")}</span>
              </a>
            )}
          </span>
        </section>
      )}

      <div className="inbox-body" dir="auto" lang={message.language}>
        {message.body}
      </div>

      <div className="inbox-actions">
        {message.email && (
          <a className="btn btn--primary" href={mailtoHref(message, replyLanguage)}>
            <Reply size={18} aria-hidden="true" className="flip-rtl" />
            {t("adminMessages.actions.reply")}
          </a>
        )}
        {message.phone && (
          <a className="btn btn--outline" href={telHref(message.phone)}>
            <Phone size={18} aria-hidden="true" />
            {t("adminMessages.actions.call")}
          </a>
        )}
        {message.status !== "replied" && !archived && (
          <button type="button" className="btn btn--success" disabled={disabled} onClick={() => update({ status: "replied" }, "replied")}>
            {busy === "replied" ? <span className="spinner" aria-hidden="true" /> : <CircleCheck size={18} aria-hidden="true" />}
            {t("adminMessages.actions.replied")}
          </button>
        )}
        {!archived && (
          <button
            type="button"
            className="btn btn--outline"
            disabled={disabled}
            onClick={() => update({ status: "new" }, "unread", () => navigate(backHref))}
          >
            <MailOpen size={18} aria-hidden="true" />
            {t("adminMessages.actions.unread")}
          </button>
        )}
        <button
          type="button"
          className="btn btn--outline"
          disabled={disabled}
          onClick={() => update({ status: archived ? "read" : "archived" }, archived ? "unarchived" : "archived")}
        >
          {archived ? <ArchiveRestore size={18} aria-hidden="true" /> : <Archive size={18} aria-hidden="true" />}
          {t(archived ? "adminMessages.actions.unarchive" : "adminMessages.actions.archive")}
        </button>
        <button type="button" className="btn btn--danger" disabled={disabled} onClick={() => setConfirmDelete(true)}>
          <Trash2 size={18} aria-hidden="true" />
          {t("adminMessages.actions.delete")}
        </button>
      </div>

      <form className="inbox-note" onSubmit={saveNote}>
        <label className="field__label" htmlFor={`${noteId}-note`}>
          {t("adminMessages.note.label")}
        </label>
        <p id={`${noteId}-hint`} className="field__hint">
          {t("adminMessages.note.hint")}
        </p>
        <textarea
          id={`${noteId}-note`}
          className="textarea"
          maxLength={2000}
          aria-describedby={`${noteId}-hint`}
          value={noteValue}
          onChange={(event) => {
            setNote(event.target.value);
            setNoteState("");
          }}
        />
        <div className="inbox-note__actions">
          <span className="inbox-note__state" role="status">
            {noteState === "saved" && t("adminMessages.note.saved")}
          </span>
          <button type="submit" className="btn btn--outline btn--small" disabled={note === null || noteState === "saving"}>
            {noteState === "saving" && <span className="spinner" aria-hidden="true" />}
            {t("adminMessages.note.save")}
          </button>
        </div>
      </form>

      {confirmDelete && (
        <ConfirmDialog
          title={t("adminMessages.deleteDialog.title")}
          description={t("adminMessages.deleteDialog.description", { name: isolate(message.name) })}
          confirmLabel={t("adminMessages.deleteDialog.confirm")}
          cancelLabel={t("adminMessages.deleteDialog.keep")}
          onConfirm={remove}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </article>
  );
}
