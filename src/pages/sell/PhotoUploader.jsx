import { useRef, useState } from "react";
import { CircleAlert, ImagePlus, Trash2 } from "lucide-react";
import { useI18n } from "../../i18n/i18n-context";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function PhotoUploader({ id, photos, onChange, error, max = 9 }) {
  const { t, locale } = useI18n();
  const [rejected, setRejected] = useState([]);
  const [dragging, setDragging] = useState(false);
  const nextId = useRef(1);
  const inputRef = useRef(null);
  const full = photos.length >= max;
  const errorId = `${id}-error`;
  const [dropBefore, dropAfter = ""] = t("sell.photos.drop").split("{choose}");

  const formatSize = (bytes) =>
    t("sell.photos.size", {
      value: new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
        bytes / (1024 * 1024)
      ),
    });
  const hintId = `${id}-hint`;

  const addFiles = (fileList) => {
    const added = [];
    const refused = [];
    const room = max - photos.length;

    Array.from(fileList).forEach((file) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        refused.push({ name: file.name, reason: t("sell.photos.reasons.type") });
      } else if (file.size > MAX_BYTES) {
        refused.push({ name: file.name, reason: t("sell.photos.reasons.size", { size: formatSize(file.size) }) });
      } else if (added.length >= room) {
        refused.push({ name: file.name, reason: t("sell.photos.reasons.full", { max }) });
      } else {
        added.push({ id: nextId.current++, file, url: URL.createObjectURL(file) });
      }
    });

    setRejected(refused);

    if (added.length) {
      onChange([...photos, ...added]);
    }
  };

  const handleInput = (event) => {
    addFiles(event.target.files);
    event.target.value = "";
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setDragging(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const removePhoto = (photo) => {
    URL.revokeObjectURL(photo.url);
    setRejected([]);
    onChange(photos.filter((item) => item.id !== photo.id));
    inputRef.current?.focus();
  };

  const makeCover = (photo) => {
    onChange([photo, ...photos.filter((item) => item.id !== photo.id)]);
  };

  return (
    <div className="sell-photos">
      <div
        className={`sell-drop${dragging ? " is-dragging" : ""}${error ? " is-invalid" : ""}`}
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          id={id}
          name="photos"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="sell-drop__input"
          onChange={handleInput}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${errorId} ${hintId}` : hintId}
        />
        <label htmlFor={id} className="sell-drop__label">
          <span className="sell-drop__icon">
            <ImagePlus size={24} aria-hidden="true" />
          </span>
          <span className="sell-drop__title">
            {dropBefore}
            <span className="sell-drop__choose">{t("sell.photos.choose")}</span>
            {dropAfter}
          </span>
        </label>
        <p id={hintId} className="field__hint sell-drop__hint">
          {full ? t("sell.photos.full", { max }) : t("sell.photos.hint")}
        </p>
      </div>

      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}

      {rejected.length > 0 && (
        <div className="notice notice--stop" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <div>
            <p>{t("sell.photos.rejected", { count: rejected.length })}</p>
            <ul className="sell-photos__rejected">
              {rejected.map((item, index) => (
                <li key={`${item.name}-${index}`}>
                  <strong dir="auto">{item.name}</strong>: {item.reason}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <p className="sell-photos__count" aria-live="polite">
        {t("sell.photos.count", { count: photos.length, max: max })}
      </p>

      {photos.length > 0 && (
        <ul className="sell-photos__grid">
          {photos.map((photo, index) => (
            <li key={photo.id} className="sell-photo">
              <div className="sell-photo__media">
                <img src={photo.url} alt={t("sell.photos.alt", { number: index + 1 })} />
                {index === 0 && <span className="badge sell-photo__cover">{t("sell.photos.cover")}</span>}
              </div>
              <div className="sell-photo__actions">
                {index > 0 ? (
                  <button
                    type="button"
                    className="btn btn--ghost sell-photo__make-cover"
                    onClick={() => makeCover(photo)}
                    aria-label={t("sell.photos.makeCoverLabel", { number: index + 1 })}
                  >
                    {t("sell.photos.makeCover")}
                  </button>
                ) : (
                  <span className="sell-photo__note">{t("sell.photos.shownFirst")}</span>
                )}
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => removePhoto(photo)}
                  aria-label={t("sell.photos.remove", { number: index + 1 })}
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
