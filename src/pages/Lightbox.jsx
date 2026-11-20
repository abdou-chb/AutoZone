import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useI18n } from "../i18n/i18n-context";
import { pauseScrolling, resumeScrolling } from "../lib/scroll";

export default function Lightbox({ images, index, label, onStep, onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const touchRef = useRef(null);
  const [returnFocus] = useState(() => document.activeElement);
  const { t, dir } = useI18n();
  const count = images.length;
  const forward = dir === "rtl" ? -1 : 1;

  useEffect(() => {
    const { overflow } = document.body.style;

    document.body.style.overflow = "hidden";
    pauseScrolling();
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = overflow;
      resumeScrolling();
      returnFocus?.focus?.();
    };
  }, [returnFocus]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowLeft" && count > 1) {
        onStep(-forward);
      } else if (event.key === "ArrowRight" && count > 1) {
        onStep(forward);
      } else if (event.key === "Tab") {
        const focusable = dialogRef.current.querySelectorAll("button");
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [count, forward, onStep, onClose]);

  return createPortal(
    <div
      ref={dialogRef}
      className="details-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={t("details.lightbox.label", { label })}
      onClick={(event) => event.target === event.currentTarget && onClose()}
      onTouchStart={(event) => {
        touchRef.current = event.touches.length === 1 ? event.touches[0] : null;
      }}
      onTouchEnd={(event) => {
        const start = touchRef.current;
        const end = event.changedTouches[0];

        touchRef.current = null;

        if (!start || count < 2) return;

        const dx = end.clientX - start.clientX;

        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(end.clientY - start.clientY)) {
          onStep(dx < 0 ? forward : -forward);
        }
      }}
    >
      <div className="details-lightbox__bar">
        <span className="details-lightbox__count numeric" aria-live="polite">
          {t("details.lightbox.counter", { index: index + 1, count })}
        </span>
        <button ref={closeRef} type="button" className="details-lightbox__btn" onClick={onClose}>
          <X size={22} aria-hidden="true" />
          <span className="visually-hidden">{t("details.lightbox.close")}</span>
        </button>
      </div>

      <img
        className="details-lightbox__image"
        src={images[index]}
        alt={t("details.gallery.photo", { label, index: index + 1, count })}
      />

      {count > 1 && (
        <>
          <button
            type="button"
            className="details-lightbox__btn details-lightbox__nav details-lightbox__nav--prev"
            onClick={() => onStep(-1)}
          >
            <ChevronLeft size={26} className="flip-rtl" aria-hidden="true" />
            <span className="visually-hidden">{t("details.gallery.previous")}</span>
          </button>
          <button
            type="button"
            className="details-lightbox__btn details-lightbox__nav details-lightbox__nav--next"
            onClick={() => onStep(1)}
          >
            <ChevronRight size={26} className="flip-rtl" aria-hidden="true" />
            <span className="visually-hidden">{t("details.gallery.next")}</span>
          </button>
        </>
      )}
    </div>,
    document.body
  );
}
