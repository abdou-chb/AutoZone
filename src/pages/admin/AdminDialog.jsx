import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { useI18n } from "../../i18n/i18n-context";

export default function AdminDialog({
  title,
  description,
  onClose,
  initialFocusRef,
  locked = false,
  size = "small",
  children,
}) {
  const { t } = useI18n();
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;

    if (!dialog.open) {
      dialog.showModal();
    }

    initialFocusRef?.current?.focus();

    return () => {
      if (dialog.open) {
        dialog.close();
      }

      if (!(opener instanceof HTMLElement) || !opener.isConnected) {
        return;
      }

      const target = opener.disabled ? opener.closest("[data-focus-return]") : opener;
      target?.focus();
    };
  }, [initialFocusRef]);

  function handleCancel(event) {
    event.preventDefault();

    if (!locked) {
      onClose();
    }
  }

  function handleClick(event) {
    if (event.target === dialogRef.current && !locked) {
      onClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={`admin-dialog admin-dialog--${size}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={handleCancel}
      onClick={handleClick}
    >
      <div className="admin-dialog__body">
        <div className="admin-dialog__head">
          <h2 id={titleId} className="admin-dialog__title">
            {title}
          </h2>
          <button
            type="button"
            className="admin-dialog__close"
            onClick={onClose}
            disabled={locked}
            aria-label={t("common.actions.close")}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {description && (
          <p id={descriptionId} className="admin-dialog__text">
            {description}
          </p>
        )}
        {children}
      </div>
    </dialog>
  );
}
