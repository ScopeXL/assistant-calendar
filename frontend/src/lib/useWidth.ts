import { useEffect, useRef, useState, type RefObject } from "react";

/** An element's content width in px, kept up to date; 0 until it has been measured (and while
 * it sits inside a closed sheet). */
export function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      setWidth(node.clientWidth);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);
  return [ref, width];
}

function rootScale(): number {
  if (typeof document === "undefined") return 1;
  return (Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;
}

/** The wall's text size as a factor of Standard (16 px): 0.875 at Small, 1.3 at Extra large.
 * It follows the setting when it changes, for layout worked out in px. */
export function useRootScale(): number {
  const [scale, setScale] = useState(rootScale);
  useEffect(() => {
    const read = () => {
      setScale(rootScale());
    };
    read();
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-text-size"],
    });
    return () => {
      observer.disconnect();
    };
  }, []);
  return scale;
}
