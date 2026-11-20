import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";

gsap.registerPlugin(useGSAP);

export default function useStaggerIn(ref, key) {
  useGSAP(
    () => {
      const items = ref.current?.children;

      if (!key || !items?.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }

      gsap.from(items, {
        y: 22,
        opacity: 0,
        duration: 0.55,
        ease: "power3.out",
        stagger: { each: 0.045, grid: "auto", from: "start" },
        clearProps: "transform,opacity",
      });
    },
    { dependencies: [key], scope: ref }
  );
}
