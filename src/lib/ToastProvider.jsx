import { useCallback, useRef, useState } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useI18n } from "../i18n/i18n-context";
import { ToastContext } from "./toast-context";
import "./toast.css";

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);
  const { t } = useI18n();

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message, { tone = "success", duration = tone === "error" ? 8000 : 4000 } = {}) => {
      const id = nextId.current++;

      setToasts((current) => [...current.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            {toast.tone === "error" ? <CircleAlert size={18} /> : <CircleCheck size={18} />}
            <span>{toast.message}</span>
            <button type="button" className="toast__close" onClick={() => dismiss(toast.id)} aria-label={t("common.actions.close")}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
