import { useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Check, GripVertical, ImageMinus, ImageUp, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import BrandMark from "../../../components/BrandMark";
import EmptyState from "../../../components/EmptyState";
import { useI18n } from "../../../i18n/i18n-context";
import { imageUrl } from "../../../lib/api";
import { CATEGORIES, getCategory, isCategoryKey } from "../../../lib/categories";
import { formatNumber } from "../../../lib/format";
import { useToast } from "../../../lib/toast-context";
import { isolate } from "../admin-config";
import { useAdmin } from "../admin-context";
import ConfirmDialog from "../ConfirmDialog";
import { LoadError } from "../PanelStates";
import { useAdminData } from "../useAdminSession";
import { isQuietError } from "../listings/listing-helpers";
import "./brands.css";

const LOGO_TYPES = "image/jpeg,image/png,image/webp,image/svg+xml";

function normalise(brand, previous = {}) {
  return { ...previous, ...brand, visible: Boolean(brand.visible), listings: brand.listings ?? previous.listings ?? 0 };
}

function BrandLogo({ brand }) {
  if (brand.logo) {
    return (
      <span className="brd-logo">
        <img src={imageUrl(brand.logo)} alt="" />
      </span>
    );
  }

  return <BrandMark name={brand.name} size={44} />;
}

function BrandRow({
  brand,
  index,
  count,
  busy,
  dragging,
  dropTarget,
  onMove,
  onToggle,
  onRename,
  onLogo,
  onRemoveLogo,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(brand.name);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const renameRef = useRef(null);
  const nameId = useId();
  const errorId = useId();
  const name = isolate(brand.name);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function startEdit() {
    setDraft(brand.name);
    setError("");
    setEditing(true);
  }

  function stopEdit() {
    setEditing(false);
    setError("");
    window.requestAnimationFrame(() => renameRef.current?.focus());
  }

  async function submit(event) {
    event.preventDefault();

    const clean = draft.trim();

    if (!clean) {
      setError(t("adminListings.brands.errors.name"));
      inputRef.current?.focus();
      return;
    }

    if (clean === brand.name) {
      stopEdit();
      return;
    }

    const message = await onRename(brand, clean);

    if (message) {
      setError(message);
      inputRef.current?.focus();
    } else {
      stopEdit();
    }
  }

  return (
    <li
      id={`brd-row-${brand.id}`}
      className={`brd-row${brand.visible ? "" : " is-hidden"}${dragging ? " is-dragging" : ""}${dropTarget ? " is-drop-target" : ""}`}
      draggable={!editing && !busy}
      onDragStart={(event) => onDragStart(event, brand.id)}
      onDragOver={(event) => onDragOver(event, brand.id)}
      onDrop={(event) => onDrop(event, brand.id)}
      onDragEnd={onDragEnd}
      aria-busy={busy || undefined}
    >
      <span className="brd-grip" aria-hidden="true" title={t("adminListings.brands.drag")}>
        <GripVertical size={18} />
      </span>
      <span className="brd-position numeric" aria-hidden="true">
        {index + 1}
      </span>
      <BrandLogo brand={brand} />

      <div className="brd-main">
        {editing ? (
          <form className="brd-rename" onSubmit={submit}>
            <label className="visually-hidden" htmlFor={nameId}>
              {t("adminListings.brands.renameLabel", { name })}
            </label>
            <input
              ref={inputRef}
              id={nameId}
              className="input brd-rename__input"
              value={draft}
              maxLength={40}
              dir="auto"
              autoComplete="off"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  stopEdit();
                }
              }}
            />
            <button type="submit" className="admin-icon-btn brd-btn" aria-label={t("adminListings.brands.saveName")} title={t("adminListings.brands.saveName")} disabled={busy}>
              {busy ? <span className="spinner" aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}
            </button>
            <button type="button" className="admin-icon-btn brd-btn" aria-label={t("adminListings.brands.cancelRename")} title={t("adminListings.brands.cancelRename")} onClick={stopEdit}>
              <X size={18} aria-hidden="true" />
            </button>
            {error && (
              <p id={errorId} className="field__error brd-rename__error">
                {error}
              </p>
            )}
          </form>
        ) : (
          <>
            <span className="brd-name">
              <bdi>{brand.name}</bdi>
              {!brand.visible && <span className="badge">{t("adminListings.brands.hidden")}</span>}
            </span>
            <span className="brd-count">{t("adminListings.brands.listings", { count: brand.listings, number: formatNumber(brand.listings) })}</span>
          </>
        )}
      </div>

      <label className="brd-switch">
        <input
          id={`brd-${brand.id}-visible`}
          type="checkbox"
          role="switch"
          checked={brand.visible}
          disabled={busy}
          onChange={(event) => onToggle(brand, event.target.checked)}
          aria-label={t("adminListings.brands.visibleLabel", { name })}
        />
        <span aria-hidden="true">{t("adminListings.brands.visible")}</span>
      </label>

      <div className="brd-tools">
        <button
          id={`brd-${brand.id}-up`}
          type="button"
          className="admin-icon-btn brd-btn"
          onClick={() => onMove(index, -1)}
          disabled={index === 0 || busy}
          aria-label={t("adminListings.brands.moveUp", { name })}
          title={t("adminListings.brands.moveUpShort")}
        >
          <ArrowUp size={18} aria-hidden="true" />
        </button>
        <button
          id={`brd-${brand.id}-down`}
          type="button"
          className="admin-icon-btn brd-btn"
          onClick={() => onMove(index, 1)}
          disabled={index === count - 1 || busy}
          aria-label={t("adminListings.brands.moveDown", { name })}
          title={t("adminListings.brands.moveDownShort")}
        >
          <ArrowDown size={18} aria-hidden="true" />
        </button>
        <span className="brd-tools__gap" aria-hidden="true" />
        {!editing && (
          <button
            ref={renameRef}
            type="button"
            className="admin-icon-btn brd-btn"
            onClick={startEdit}
            disabled={busy}
            aria-label={t("adminListings.brands.rename", { name })}
            title={t("adminListings.brands.renameShort")}
          >
            <Pencil size={18} aria-hidden="true" />
          </button>
        )}
        <button
          id={`brd-${brand.id}-logo`}
          type="button"
          className="admin-icon-btn brd-btn"
          onClick={() => onLogo(brand)}
          disabled={busy}
          aria-label={t(brand.logo ? "adminListings.brands.replaceLogo" : "adminListings.brands.uploadLogo", { name })}
          title={t(brand.logo ? "adminListings.brands.replaceLogoShort" : "adminListings.brands.uploadLogoShort")}
        >
          <ImageUp size={18} aria-hidden="true" />
        </button>
        {brand.logo && (
          <button
            type="button"
            className="admin-icon-btn brd-btn"
            onClick={() => onRemoveLogo(brand)}
            disabled={busy}
            aria-label={t("adminListings.brands.removeLogo", { name })}
            title={t("adminListings.brands.removeLogoShort")}
          >
            <ImageMinus size={18} aria-hidden="true" />
          </button>
        )}
        <button
          id={`brd-${brand.id}-delete`}
          type="button"
          className="admin-icon-btn brd-btn brd-btn--stop"
          onClick={() => onDelete(brand)}
          disabled={busy}
          aria-label={t("adminListings.brands.delete", { name })}
          title={t("adminListings.brands.deleteShort")}
        >
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

function BrandList({ zone, initial }) {
  const { t } = useI18n();
  const { request } = useAdmin();
  const showToast = useToast();
  const [items, setItems] = useState(() => initial.map((brand) => normalise(brand)));
  const [busy, setBusy] = useState({});
  const [message, setMessage] = useState("");
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [confirmLogo, setConfirmLogo] = useState(null);
  const [drag, setDrag] = useState({ id: null, over: null });
  const fileRef = useRef(null);
  const logoTargetRef = useRef(null);
  const addRef = useRef(null);
  const focusRef = useRef(null);
  const addId = useId();
  const addErrorId = useId();
  const zoneBrand = getCategory(zone).brand;

  useEffect(() => {
    const target = focusRef.current;

    if (!target) {
      return;
    }

    focusRef.current = null;

    if (target === "add") {
      addRef.current?.focus();
      return;
    }

    const element = document.getElementById(target.id);
    const fallback = target.fallback ? document.getElementById(target.fallback) : null;

    (element && !element.disabled ? element : fallback || addRef.current)?.focus();
  }, [items]);

  function announce(text, tone = "success") {
    setMessage(text);
    showToast(text, { tone });
  }

  function fail(error) {
    if (!isQuietError(error)) {
      showToast(error.message, { tone: "error" });
    }
  }

  function setBusyFor(id, value) {
    setBusy((current) => {
      const next = { ...current };

      if (value) next[id] = true;
      else delete next[id];

      return next;
    });
  }

  function replace(brand) {
    setItems((current) => current.map((item) => (item.id === brand.id ? normalise(brand, item) : item)));
  }

  async function save(brand, body) {
    setBusyFor(brand.id, true);

    try {
      const data = await request(`/api/admin/brands/${brand.id}`, { method: "PUT", body });

      replace(data.brand);

      return { ok: true };
    } catch (error) {
      return { error };
    } finally {
      setBusyFor(brand.id, false);
    }
  }

  async function persistOrder(next, previous, text) {
    setItems(next);

    try {
      await request("/api/admin/brands/order", { method: "PUT", body: { category: zone, ids: next.map((item) => item.id) } });
      setMessage(text);
    } catch (error) {
      setItems(previous);
      fail(error);
    }
  }

  function move(index, delta) {
    const target = index + delta;

    if (target < 0 || target >= items.length) {
      return;
    }

    const next = [...items];
    const [brand] = next.splice(index, 1);

    next.splice(target, 0, brand);
    focusRef.current = {
      id: `brd-${brand.id}-${delta < 0 ? "up" : "down"}`,
      fallback: `brd-${brand.id}-${delta < 0 ? "down" : "up"}`,
    };
    persistOrder(next, items, t("adminListings.brands.moved", { name: isolate(brand.name), position: target + 1, count: items.length }));
  }

  async function toggle(brand, visible) {
    replace({ ...brand, visible });

    const result = await save(brand, { visible });

    focusRef.current = { id: `brd-${brand.id}-visible` };

    if (result.error) {
      replace(brand);
      fail(result.error);
    } else {
      announce(t(visible ? "adminListings.brands.shown" : "adminListings.brands.hiddenDone", { name: isolate(brand.name) }));
    }
  }

  async function rename(brand, name) {
    const result = await save(brand, { name });

    if (result.error) {
      return isQuietError(result.error) ? "" : result.error.message;
    }

    announce(t("adminListings.brands.renamed", { name: isolate(name) }));

    return "";
  }

  function chooseLogo(brand) {
    logoTargetRef.current = brand;
    fileRef.current?.click();
  }

  async function uploadLogo(file) {
    const brand = logoTargetRef.current;

    if (!brand || !file) {
      return;
    }

    const body = new FormData();
    body.append("logo", file);
    setBusyFor(brand.id, true);

    try {
      const data = await request(`/api/admin/brands/${brand.id}/logo`, { method: "POST", body });

      replace(data.brand);
      focusRef.current = { id: `brd-${brand.id}-logo` };
      announce(t("adminListings.brands.logoUploaded", { name: isolate(brand.name) }));
    } catch (error) {
      fail(error);
    } finally {
      setBusyFor(brand.id, false);
    }
  }

  async function removeLogo(brand) {
    setConfirmLogo(null);

    const result = await save(brand, { logo: "" });

    if (result.error) {
      fail(result.error);
    } else {
      focusRef.current = { id: `brd-${brand.id}-logo` };
      announce(t("adminListings.brands.logoRemoved", { name: isolate(brand.name) }));
    }
  }

  async function remove(brand) {
    setConfirm(null);
    setBusyFor(brand.id, true);

    const index = items.findIndex((item) => item.id === brand.id);
    const neighbour = items[index + 1] || items[index - 1];

    try {
      await request(`/api/admin/brands/${brand.id}`, { method: "DELETE" });
      focusRef.current = neighbour ? { id: `brd-${neighbour.id}-delete` } : "add";
      setItems((current) => current.filter((item) => item.id !== brand.id));
      announce(t("adminListings.brands.deleted", { name: isolate(brand.name) }));
    } catch (error) {
      fail(error);
      setBusyFor(brand.id, false);
    }
  }

  async function add(event) {
    event.preventDefault();

    const name = newName.trim();

    if (!name) {
      setAddError(t("adminListings.brands.errors.name"));
      addRef.current?.focus();
      return;
    }

    setAdding(true);
    setAddError("");

    try {
      const data = await request("/api/admin/brands", { method: "POST", body: { category: zone, name } });

      setItems((current) => [...current, normalise(data.brand)]);
      setNewName("");
      focusRef.current = "add";
      announce(t("adminListings.brands.added", { name: isolate(data.brand.name), zone: zoneBrand }));
    } catch (error) {
      if (!isQuietError(error)) {
        setAddError(error.message);
        addRef.current?.focus();
      }
    } finally {
      setAdding(false);
    }
  }

  function handleDragStart(event, id) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(id));
    setDrag({ id, over: null });
  }

  function handleDragOver(event, id) {
    if (drag.id === null) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    if (drag.over !== id) {
      setDrag((current) => ({ ...current, over: id }));
    }
  }

  function handleDrop(event, id) {
    event.preventDefault();

    const from = items.findIndex((item) => item.id === drag.id);
    const to = items.findIndex((item) => item.id === id);

    setDrag({ id: null, over: null });

    if (from < 0 || to < 0 || from === to) {
      return;
    }

    const next = [...items];
    const [brand] = next.splice(from, 1);

    next.splice(to, 0, brand);
    persistOrder(next, items, t("adminListings.brands.moved", { name: isolate(brand.name), position: to + 1, count: items.length }));
  }

  const visibleCount = items.filter((item) => item.visible).length;

  return (
    <>
      <p className="visually-hidden" role="status">
        {message}
      </p>

      <form className="brd-add" onSubmit={add} noValidate>
        <div className="brd-add__field">
          <label className="field__label" htmlFor={addId}>
            {t("adminListings.brands.addLabel", { zone: zoneBrand })}
          </label>
          <input
            ref={addRef}
            id={addId}
            className="input"
            value={newName}
            maxLength={40}
            dir="auto"
            autoComplete="off"
            placeholder={t("adminListings.brands.addPlaceholder")}
            aria-invalid={addError ? true : undefined}
            aria-describedby={addError ? addErrorId : undefined}
            onChange={(event) => {
              setNewName(event.target.value);
              setAddError("");
            }}
          />
          {addError && (
            <p id={addErrorId} className="field__error">
              {addError}
            </p>
          )}
        </div>
        <button type="submit" className="btn btn--primary" disabled={adding}>
          {adding ? <span className="spinner" aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
          {t("adminListings.brands.add")}
        </button>
      </form>

      <p className="brd-summary">
        {t("adminListings.brands.summary", { count: items.length, visible: visibleCount, total: formatNumber(items.length), shown: formatNumber(visibleCount) })}
      </p>

      {items.length ? (
        <ol className="brd-list" aria-label={t("adminListings.brands.listLabel", { zone: zoneBrand })}>
          {items.map((brand, index) => (
            <BrandRow
              key={brand.id}
              brand={brand}
              index={index}
              count={items.length}
              busy={Boolean(busy[brand.id])}
              dragging={drag.id === brand.id}
              dropTarget={drag.over === brand.id && drag.id !== brand.id}
              onMove={move}
              onToggle={toggle}
              onRename={rename}
              onLogo={chooseLogo}
              onRemoveLogo={setConfirmLogo}
              onDelete={(item) => setConfirm(item)}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={() => setDrag({ id: null, over: null })}
            />
          ))}
        </ol>
      ) : (
        <EmptyState icon={Tags} title={t("adminListings.brands.empty.title", { zone: zoneBrand })}>
          {t("adminListings.brands.empty.text")}
        </EmptyState>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={LOGO_TYPES}
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          uploadLogo(event.target.files[0]);
          event.target.value = "";
        }}
      />

      {confirmLogo && (
        <ConfirmDialog
          title={t("adminListings.brands.confirmLogo.title", { name: isolate(confirmLogo.name) })}
          description={t("adminListings.brands.confirmLogo.description")}
          confirmLabel={t("adminListings.brands.confirmLogo.confirm")}
          cancelLabel={t("common.actions.cancel")}
          onConfirm={() => removeLogo(confirmLogo)}
          onClose={() => setConfirmLogo(null)}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={t("adminListings.brands.confirm.title", { name: isolate(confirm.name) })}
          description={
            confirm.listings
              ? t("adminListings.brands.confirm.withListings", { count: confirm.listings, name: isolate(confirm.name) })
              : t("adminListings.brands.confirm.description", { name: isolate(confirm.name) })
          }
          confirmLabel={t("adminListings.brands.confirm.confirm")}
          cancelLabel={t("common.actions.cancel")}
          onConfirm={() => remove(confirm)}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}

export default function BrandsPage() {
  const { t } = useI18n();
  const { request } = useAdmin();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabRefs = useRef({});
  const zone = isCategoryKey(searchParams.get("zone")) ? searchParams.get("zone") : CATEGORIES[0].key;
  const brands = useAdminData(request, `/api/admin/brands?category=${zone}`);

  function selectZone(key, focus = false) {
    setSearchParams(key === CATEGORIES[0].key ? {} : { zone: key }, { replace: true, preventScrollReset: true });

    if (focus) {
      tabRefs.current[key]?.focus();
    }
  }

  function handleKeyDown(event, index) {
    const keys = { ArrowRight: 1, ArrowLeft: -1, Home: "first", End: "last" };
    let step = keys[event.key];

    if (step === undefined) {
      return;
    }

    event.preventDefault();

    if (document.documentElement.dir === "rtl" && typeof step === "number") {
      step = -step;
    }

    const next =
      step === "first" ? 0 : step === "last" ? CATEGORIES.length - 1 : (index + step + CATEGORIES.length) % CATEGORIES.length;

    selectZone(CATEGORIES[next].key, true);
  }

  return (
    <div className="brd-page">
      <div className="console-head">
        <div>
          <h1>{t("adminListings.brands.title")}</h1>
          <p>{t("adminListings.brands.lead")}</p>
        </div>
      </div>

      <div className="brd-tabs" role="tablist" aria-label={t("adminListings.brands.zones")}>
        {CATEGORIES.map((category, index) => {
          const Icon = category.icon;
          const selected = category.key === zone;

          return (
            <button
              key={category.key}
              ref={(element) => {
                tabRefs.current[category.key] = element;
              }}
              id={`brd-tab-${category.key}`}
              type="button"
              role="tab"
              className="brd-tab"
              aria-selected={selected}
              aria-controls="brd-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => selectZone(category.key)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              <Icon size={18} aria-hidden="true" />
              {category.brand}
            </button>
          );
        })}
      </div>

      <section id="brd-panel" role="tabpanel" aria-labelledby={`brd-tab-${zone}`} className="console-card brd-card">
        <div className="console-card__body brd-body">
          {brands.error && <LoadError message={brands.error} onRetry={brands.reload} retrying={brands.refreshing} />}
          {!brands.error && !brands.data && (
            <div className="brd-skeleton" aria-busy="true">
              <p className="visually-hidden" role="status">
                {t("adminListings.brands.loading")}
              </p>
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="skeleton brd-skeleton__row" />
              ))}
            </div>
          )}
          {brands.data && <BrandList key={zone} zone={zone} initial={brands.data.brands} />}
        </div>
      </section>
    </div>
  );
}
