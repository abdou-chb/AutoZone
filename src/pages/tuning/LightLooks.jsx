import { Check } from "lucide-react";
import { useI18n } from "../../i18n/i18n-context";
import { LIGHT_LOOKS, lookFor, optionOf } from "./options";
import { useVehicle } from "./vehicle-context";

// Ready-made looks for both lamps. Each button pictures its headlamp glow behind its lens and its rear lens tone.
export default function LightLooks({ setup, onApply }) {
  const { t } = useI18n();
  const vehicle = useVehicle();

  return (
    <div className="tz-group tz-looks">
      <p className="tz-group__legend">
        <span className="tz-group__name">{t("tuning.lighting.looksTitle")}</span>
      </p>
      <div className="tz-looks__list" role="group" aria-label={t("tuning.lighting.looksTitle")}>
        {LIGHT_LOOKS.map((full) => lookFor(full, vehicle)).map((look) => {
          const current = Object.entries(look.setup).every(([group, id]) => group.endsWith("Lights") || setup[group] === id);
          const led = optionOf("ledColor", look.setup.ledColor).hex;
          const lens = optionOf("headlights", look.setup.headlights || "factory").smoke;
          const tail = optionOf("tailTone", look.setup.tailTone || "factory").hex;
          const tailSmoke = optionOf("taillights", look.setup.taillights || "factory").smoke;

          return (
            <button key={look.id} type="button" className="tz-look" aria-pressed={current} onClick={() => onApply(look)}>
              <span className="tz-look__face" style={{ "--led": led, "--lens": lens, "--tail": tail, "--tail-smoke": tailSmoke }} aria-hidden="true">
                <span className="tz-look__head" />
                <span className="tz-look__tail" />
                {current && <Check size={12} strokeWidth={3} className="tz-look__check" />}
              </span>
              <span className="tz-look__name">{t(`tuning.lighting.looks.${look.id}`)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
