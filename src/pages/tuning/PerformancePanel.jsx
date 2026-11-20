import { useI18n } from "../../i18n/i18n-context";
import { performanceOf, POWER_SCALE, TORQUE_SCALE } from "./performance-data";

function Source({ estimated }) {
  const { t } = useI18n();

  return <span className={`tz-source${estimated ? " tz-source--estimate" : ""}`}>{t(estimated ? "tuning.performance.estimate" : "tuning.performance.manufacturer")}</span>;
}

function Bar({ stock, range, scale, label }) {
  const { t } = useI18n();
  const base = (stock / scale) * 100;
  const from = (range[0] / scale) * 100;
  const to = (range[1] / scale) * 100;

  return (
    <div className="tz-bar-meter" role="img" aria-label={label}>
      <span className="tz-bar-meter__stock" style={{ inlineSize: `${base}%` }} title={t("tuning.performance.stockBar")} />
      {to > base && (
        <span
          className="tz-bar-meter__range"
          style={{ insetInlineStart: `${from}%`, inlineSize: `${to - from}%` }}
          title={t("tuning.performance.tunedBar")}
        />
      )}
    </div>
  );
}

export default function PerformancePanel({ powertrain, stage }) {
  const { t } = useI18n();
  const { base, estimated, power, torque } = performanceOf(powertrain, stage);
  const p = (key, values) => t(`tuning.performance.${key}`, values);
  const powerText = estimated ? p("psRange", { from: power[0], to: power[1] }) : p("ps", { value: base.power.ps });
  const torqueText = estimated ? p("nmRange", { from: torque[0], to: torque[1] }) : p("nm", { value: base.torque });

  return (
    <div className="tz-perf">
      <dl className="tz-perf__specs">
        <div className="tz-perf__row tz-perf__row--wide">
          <dt>{p("power")}</dt>
          <dd>
            <strong className="numeric">{powerText}</strong>
            {!estimated && <span className="tz-perf__sub numeric">{p("kw", { value: base.power.kw })}</span>}
            <Source estimated={estimated} />
            <Bar stock={base.power.ps} range={power} scale={POWER_SCALE} label={`${p("power")}: ${powerText}`} />
          </dd>
        </div>
        <div className="tz-perf__row tz-perf__row--wide">
          <dt>{p("torque")}</dt>
          <dd>
            <strong className="numeric">{torqueText}</strong>
            <Source estimated={estimated} />
            <Bar stock={base.torque} range={torque} scale={TORQUE_SCALE} label={`${p("torque")}: ${torqueText}`} />
          </dd>
        </div>
        <div className="tz-perf__row">
          <dt>{p("sprint")}</dt>
          <dd className="numeric">{estimated ? p("notEstimated") : p("seconds", { value: base.sprint })}</dd>
        </div>
        <div className="tz-perf__row">
          <dt>{p("topSpeed")}</dt>
          <dd className="numeric">{p("limited", { value: base.topSpeed })}</dd>
        </div>
        <div className="tz-perf__row">
          <dt>{p("engine")}</dt>
          <dd>{base.engine}</dd>
        </div>
        <div className="tz-perf__row">
          <dt>{p("gearbox")}</dt>
          <dd>{p(base.gearbox)}</dd>
        </div>
        <div className="tz-perf__row tz-perf__row--wide">
          <dt>{p("drive")}</dt>
          <dd>{p(base.drive)}</dd>
        </div>
      </dl>
      <p className="tz-perf__note">{estimated ? p("stageNote") : p("factoryNote")}</p>
    </div>
  );
}
