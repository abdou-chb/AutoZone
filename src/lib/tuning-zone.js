import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";

export const TUNING_MODEL_URL = "/models/golf.glb";

export const TUNING_ZONE = {
  key: "tuning",
  brand: "TuningZone",
  home: "/tuning",
  icon: Wrench,
  accent: "#f4f4f4",
};

let check = null;

function modelInstalled() {
  check ||= fetch(TUNING_MODEL_URL, { method: "HEAD" })
    .then((response) => response.ok && !String(response.headers.get("content-type")).includes("text/html"))
    .catch(() => false);

  return check;
}

export function useTuningAvailable() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let active = true;

    modelInstalled().then((value) => active && setAvailable(value));

    return () => {
      active = false;
    };
  }, []);

  return available;
}
