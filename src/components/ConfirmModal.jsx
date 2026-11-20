import { useEffect, useId, useRef } from "react";
import { useI18n } from "../i18n/i18n-context";
import { pauseScrolling, resumeScrolling } from "../lib/scroll";
import "./ConfirmModal.css";

export default function ConfirmModal({ title, children, confirmLabel, busy = false, error = "", onConfirm, onClose }) {
  const { t } = useI18n();
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;

    dialog.showModal();
    cancelRef.current?.focus();
    pauseScrolling();

    return () => {
      if (dialog.open) {
        dialog.close();
      }

      resumeScrolling();

      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-modal"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(event) => {
        event.preventDefault();

        if (!busy) {
          onClose();
        }
      }}
    >
      <h2 id={titleId} className="confirm-modal__title">
        {title}
      </h2>
      <div id={bodyId} className="confirm-modal__body">
        {children}
      </div>
      {error && (
        <p className="notice notice--stop confirm-modal__error" role="alert">
          {error}
        </p>
      )}
      <div className="confirm-modal__actions">
        <button ref={cancelRef} type="button" className="btn btn--outline" onClick={onClose} disabled={busy}>
          {t("common.actions.cancel")}
        </button>
        <button type="button" className="btn btn--danger" onClick={onConfirm} disabled={busy}>
          {busy && <span className="spinner" aria-hidden="true" />}
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
