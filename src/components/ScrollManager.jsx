import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { glideToTop, jumpTo, scrollToSection, takeZoneSwitch } from "../lib/scroll";

export default function ScrollManager() {
  const { pathname, hash } = useLocation();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    const pageChanged = previousPathname.current !== pathname;
    previousPathname.current = pathname;

    if (hash && scrollToSection(hash.slice(1))) {
      return;
    }

    if (pageChanged) {
      if (takeZoneSwitch()) {
        glideToTop();
      } else {
        jumpTo(0);
      }
    }
  }, [pathname, hash]);

  return null;
}
