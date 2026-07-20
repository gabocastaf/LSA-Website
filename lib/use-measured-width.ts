"use client";

import { useLayoutEffect, useRef, useState } from "react";

const RESIZE_DEBOUNCE_MS = 180;

// Real container width in px, debounced on resize. useLayoutEffect (not
// useEffect) so the very first measurement lands before paint -- otherwise
// absolutely-positioned mosaic tiles would flash at the origin for a frame
// before snapping into place. Shared by moments-wall.tsx and
// photo-mosaic-group.tsx, both of which need a container's real width up
// front for a holistic layout pass (unlike CSS Grid, where each cell used to
// size itself independently).
export function useMeasuredWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    function measure() {
      if (el) setWidth(el.clientWidth);
    }

    measure();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(measure, RESIZE_DEBOUNCE_MS);
    });
    observer.observe(el);

    return () => {
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      observer.disconnect();
    };
  }, []);

  return { ref, width };
}
