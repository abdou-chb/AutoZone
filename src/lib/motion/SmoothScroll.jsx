import { useEffect, useState } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import { setSmoothScroll } from "../scroll";
import "lenis/dist/lenis.css";

const OPTIONS = { lerp: 0.11, wheelMultiplier: 0.9 };

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export default function SmoothScroll({ children }) {
  const [reduced] = useState(prefersReducedMotion);
  const lenis = useLenis();

  useEffect(() => {
    setSmoothScroll(lenis || null);

    return () => setSmoothScroll(null);
  }, [lenis]);

  if (reduced) {
    return children;
  }

  return (
    <ReactLenis root options={OPTIONS}>
      {children}
    </ReactLenis>
  );
}
