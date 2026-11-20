import { memo, useEffect, useRef } from "react";
import { ArrowLeft, ChevronRight, Info, Lightbulb, MoveVertical, PanelTop } from "lucide-react";
import { useI18n } from "../../i18n/i18n-context";
import OptionGroup from "./OptionGroup";
import { COMPONENTS, componentGroups, factoryFor, optionKey, optionOf } from "./options";
import { money, priceOf } from "./pricing";
import { useVehicle } from "./vehicle-context";
import { previewClass, previewStyle } from "./previews";

const NOTES = ["wheels", "lights", "details", "interior", "performance"];
// Text-only groups get an icon in the component list instead of a colour preview.
const GROUP_ICONS = { stance: MoveVertical, headliner: PanelTop };

// A lamp row: a small picture of the lamp in its LED colour behind its lens, and what is switched on.
function LampRow({ row, setup, onOpen, rowRef }) {
  const { t } = useI18n();
  const vehicle = useVehicle();
  const front = row === "frontLighting";
  const groups = componentGroups(row, vehicle);
  const factory = factoryFor(vehicle);
  const changed = groups.some((group) => setup[group] !== factory[group]);
  const lightsGroup = front ? "frontLights" : "rearLights";
  const switchable = groups.includes(lightsGroup);
  const lights = switchable ? setup[lightsGroup] : "off";
  const glow = front ? optionOf("ledColor", setup.ledColor).hex : "#ff2a1e";
  const lens = optionOf(front ? "headlights" : "taillights", front ? setup.headlights : setup.taillights).smoke;
  // What sets this lamp's look on this car: LED colour at the front, inner lens tone or outer lens finish at the rear.
  const lookGroup = front ? "ledColor" : ["tailTone", "taillights"].find((group) => groups.includes(group));
  const colour = lookGroup ? t(optionKey(lookGroup, setup[lookGroup], vehicle)) : null;
  const state = t(optionKey(lightsGroup, lights, vehicle));

  return (
    <li>
      <button type="button" ref={rowRef} className="tz-component" onClick={() => onOpen(row)}>
        <span
          className={`tz-component__face tz-lamp${front ? "" : " tz-lamp--rear"}${lights !== "off" ? " is-lit" : ""}`}
          style={{ "--led": glow, "--lens": lens }}
          aria-hidden="true"
        >
          <Lightbulb size={16} />
        </span>
        <span className="tz-component__text">
          <span className="tz-component__name">{t(`tuning.groups.${row}`)}</span>
          <span className="tz-component__value">
            {changed && <span className="tz-group__dot" role="img" aria-label={t("tuning.changed")} />}
            {switchable && colour ? t("tuning.lighting.rowValue", { lights: state, colour }) : switchable ? state : colour}
          </span>
        </span>
        <ChevronRight size={18} className="tz-component__chevron flip-rtl" aria-hidden="true" />
      </button>
    </li>
  );
}

function ComponentRow({ group, setup, onOpen, rowRef }) {
  const { t } = useI18n();
  const vehicle = useVehicle();
  const option = optionOf(group, setup[group]);
  const changed = setup[group] !== factoryFor(vehicle)[group];
  const Icon = GROUP_ICONS[group];
  const price = priceOf(vehicle, group, option.id);

  return (
    <li>
      <button type="button" ref={rowRef} className="tz-component" onClick={() => onOpen(group)}>
        {Icon ? (
          <span className="tz-component__face tz-component__face--icon" aria-hidden="true">
            <Icon size={18} />
          </span>
        ) : (
          <span className={`${previewClass(group, option, vehicle)} tz-component__face`} style={previewStyle(group, option, setup, vehicle)} aria-hidden="true" />
        )}
        <span className="tz-component__text">
          <span className="tz-component__name">{t(`tuning.groups.${group}`)}</span>
          <span className="tz-component__value">
            {changed && <span className="tz-group__dot" role="img" aria-label={t("tuning.changed")} />}
            {t(optionKey(group, option.id, vehicle))}
            {price > 0 && <span className="tz-component__price numeric">{money(t, price, { sign: true })}</span>}
          </span>
        </span>
        <ChevronRight size={18} className="tz-component__chevron flip-rtl" aria-hidden="true" />
      </button>
    </li>
  );
}

// One section's panel: a list of components, or the options of the one the user opened.
function SectionPanel({ section, index, setup, detail, onOpen, onBack, onChoose, focusView, onView, highlight, children }) {
  const { t } = useI18n();
  const vehicle = useVehicle();
  const headingRef = useRef(null);
  const rowRefs = useRef({});
  const lastDetail = useRef(detail);
  const { id, layout, groups, views } = section;
  const rows = section.rows || groups;
  const Heading = index === 0 ? "h1" : "h2";
  const title = detail ? t(`tuning.groups.${detail}`) : t(`tuning.sections.${id}.title`, { car: vehicle.model });
  // Text and note: the car's own when it has one, the Golf's otherwise (they name the Golf's parts).
  const text = t(vehicle.texts?.[id] || `tuning.sections.${id}.text`);
  const note = vehicle.notes ? vehicle.notes[id] && t(vehicle.notes[id]) : NOTES.includes(id) && t(`tuning.notes.${id}`);

  // Keep keyboard and screen reader users where they were: on the new heading, or back on the row they opened.
  useEffect(() => {
    if (detail && detail !== lastDetail.current) {
      headingRef.current?.focus({ preventScroll: true });
    } else if (!detail && lastDetail.current) {
      rowRefs.current[lastDetail.current]?.focus({ preventScroll: true });
    }

    lastDetail.current = detail;
  }, [detail]);

  return (
    <div className="tz-panel">
      {detail ? (
        <nav className="tz-crumbs" aria-label={t("tuning.panel.breadcrumb")}>
          <button type="button" className="tz-crumbs__back" onClick={onBack}>
            <ArrowLeft size={16} aria-hidden="true" className="flip-rtl" />
            <span>{t("tuning.panel.back")}</span>
          </button>
          <span className="tz-crumbs__trail">
            <span>{t(`tuning.sections.${id}.nav`)}</span>
            <ChevronRight size={14} aria-hidden="true" className="flip-rtl" />
            <span aria-current="page">{t(`tuning.groups.${detail}`)}</span>
          </span>
        </nav>
      ) : (
        <p className="tz-panel__kicker">
          <span className="numeric">{String(index + 1).padStart(2, "0")}</span> {t(`tuning.sections.${id}.nav`)}
        </p>
      )}

      <Heading id={`tuning-${id}-title`} ref={headingRef} tabIndex={-1} className={`tz-panel__title${detail ? " tz-panel__title--detail" : ""}`}>
        {title}
      </Heading>

      <div className="tz-panel__body" key={detail || "overview"}>
        {!detail && <p className="tz-panel__text">{text}</p>}

        {!detail && views && (
          <div className="tz-views" role="group" aria-label={t("tuning.panel.views")}>
            {views.map((view) => {
              const current = (focusView || section.view) === view;

              return (
                <button key={view} type="button" className="tz-view" aria-pressed={current} onClick={() => onView(view, section.id)}>
                  {t(`tuning.views.${view}`)}
                </button>
              );
            })}
          </div>
        )}

        {detail ? (
          componentGroups(detail, vehicle).map((group) => (
            <OptionGroup key={group} group={group} value={setup[group]} setup={setup} onChange={onChoose} highlighted={highlight === group} />
          ))
        ) : layout === "list" ? (
          <ul className="tz-components" aria-label={t("tuning.panel.components")}>
            {rows.map((row) => {
              const Row = COMPONENTS[row] ? LampRow : ComponentRow;

              return (
                <Row
                  key={row}
                  row={row}
                  group={row}
                  setup={setup}
                  onOpen={onOpen}
                  rowRef={(node) => {
                    rowRefs.current[row] = node;
                  }}
                />
              );
            })}
          </ul>
        ) : (
          groups.map((group) => <OptionGroup key={group} group={group} value={setup[group]} setup={setup} onChange={onChoose} highlighted={highlight === group} />)
        )}

        {!detail && children}

        {!detail && note && (
          <p className="tz-note">
            <Info size={16} aria-hidden="true" />
            <span>
              <strong>{t("tuning.notInModel")}.</strong> {note}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

// Memoised: scrolling changes the active section many times, and only the panels whose props change re-render.
export default memo(SectionPanel);
