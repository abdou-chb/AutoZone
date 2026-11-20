import { useSyncExternalStore } from "react";
import { imageUrl } from "../lib/api";
import "./BrandMark.css";

let brandLogos = null;
let loading = null;
const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  loading ||= import("../lib/brand-logos").then(({ BRAND_LOGOS }) => {
    brandLogos = BRAND_LOGOS;
    listeners.forEach((notify) => notify());
  });

  return () => listeners.delete(listener);
}

function useBrandLogos() {
  return useSyncExternalStore(subscribe, () => brandLogos);
}

function initials(name) {
  const words = name.split(/[\s-]+/).filter(Boolean);

  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 1)).toUpperCase();
}

export default function BrandMark({ name, logo: uploaded = "", size = 44 }) {
  const logos = useBrandLogos();
  const logo = logos?.[name];
  const style = { "--brand-mark-size": `${size}px` };

  if (uploaded) {
    return (
      <span className="brand-mark brand-mark--image" style={style} aria-hidden="true">
        <img src={imageUrl(uploaded)} alt="" loading="lazy" decoding="async" />
      </span>
    );
  }

  if (!logos) {
    return <span className="brand-mark" style={style} aria-hidden="true" />;
  }

  return (
    <span className={`brand-mark${logo ? "" : " brand-mark--initials"}`} style={style} aria-hidden="true">
      {logo ? (
        <svg viewBox="0 0 24 24" focusable="false">
          <path d={logo.path} />
        </svg>
      ) : (
        <span className="brand-mark__initials">{initials(name)}</span>
      )}
    </span>
  );
}
