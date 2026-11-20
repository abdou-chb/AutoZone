import { useRef } from "react";
import AdminDialog from "./AdminDialog";

export default function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  onConfirm,
  onClose,
}) {
  const safeRef = useRef(null);

  return (
    <AdminDialog title={title} description={description} onClose={onClose} initialFocusRef={safeRef}>
      <div className="admin-dialog__actions">
        <button ref={safeRef} type="button" className="btn btn--outline" onClick={onClose}>
          {cancelLabel}
        </button>
        <button type="button" className={`btn btn--${tone}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </AdminDialog>
  );
}
