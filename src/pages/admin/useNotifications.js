import { useCallback, useEffect, useRef, useState } from "react";
import { translate } from "../../i18n/core";

const POLL_MS = 20000;

function chime() {
  try {
    const context = new AudioContext();
    const gain = context.createGain();

    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.5);

    [880, 1320].forEach((frequency, index) => {
      const oscillator = context.createOscillator();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.12);
      oscillator.stop(context.currentTime + 0.5);
    });

    window.setTimeout(() => context.close().catch(() => undefined), 800);
  } catch {
    return;
  }
}

export function notificationText(item) {
  return translate(`adminShell.notifications.types.${item.type}`, { title: item.title });
}

export default function useNotifications(request, onNew) {
  const [summary, setSummary] = useState(null);
  const lastSeen = useRef(null);
  const lastText = useRef("");
  const onNewRef = useRef(onNew);

  useEffect(() => {
    onNewRef.current = onNew;
  });

  const refresh = useCallback(async () => {
    try {
      const data = await request("/api/admin/notifications/summary");

      if (lastSeen.current !== null && data.lastId > lastSeen.current) {
        const fresh = data.latest.filter((item) => item.id > lastSeen.current && !item.read_at);

        if (fresh.length) {
          onNewRef.current?.(fresh);
          chime();

          if (document.hidden && "Notification" in window && Notification.permission === "granted") {
            fresh.slice(0, 3).forEach((item) => new Notification("AutoZone", { body: notificationText(item), tag: `n${item.id}` }));
          }
        }
      }

      lastSeen.current = data.lastId;

      const text = JSON.stringify(data);

      if (text !== lastText.current) {
        lastText.current = text;
        setSummary(data);
      }
    } catch {
      return;
    }
  }, [request]);

  useEffect(() => {
    const first = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, POLL_MS);
    const onFocus = () => refresh();

    window.addEventListener("focus", onFocus);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const markRead = useCallback(
    async (ids) => {
      await request("/api/admin/notifications/read", { method: "POST", body: ids ? { ids } : {} }).catch(() => undefined);
      refresh();
    },
    [request, refresh]
  );

  return { summary, refresh, markRead };
}
