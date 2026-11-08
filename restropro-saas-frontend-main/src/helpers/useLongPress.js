import { useRef } from 'react';

/**
 * Long-press (touch) / right-click (mouse) handler for POS tiles.
 *
 * Returns a factory: `bind(payload)` gives the props for one element. A long
 * press fires `onLongPress(payload)` and swallows the click that follows, so
 * the tile's normal tap action does not also run.
 */
export default function useLongPress(onLongPress, { delay = 550, moveTolerance = 10 } = {}) {
  const timer = useRef(null);
  const start = useRef(null);
  const fired = useRef(false);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  return (payload) => {
    if (!onLongPress) return {};
    return {
      onPointerDown: (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        fired.current = false;
        start.current = { x: e.clientX, y: e.clientY };
        clear();
        timer.current = setTimeout(() => {
          fired.current = true;
          if (navigator.vibrate) navigator.vibrate(30);
          onLongPress(payload);
        }, delay);
      },
      onPointerMove: (e) => {
        if (!start.current || !timer.current) return;
        if (Math.abs(e.clientX - start.current.x) > moveTolerance || Math.abs(e.clientY - start.current.y) > moveTolerance) clear();
      },
      onPointerUp: clear,
      onPointerLeave: clear,
      onPointerCancel: clear,
      onContextMenu: (e) => {
        e.preventDefault();
        clear();
        // Android fires contextmenu on long-press too: don't open twice.
        if (fired.current) return;
        fired.current = true;
        onLongPress(payload);
      },
      onClickCapture: (e) => {
        if (fired.current) {
          e.stopPropagation();
          e.preventDefault();
          fired.current = false;
        }
      },
    };
  };
}
