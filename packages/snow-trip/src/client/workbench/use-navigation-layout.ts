import { useEffect, useRef, useState } from 'react';

export function useNavigationLayout() {
  const [railSize, setRailSize] = useState(() => ({
    width: window.innerWidth <= 1150 ? 260 : 320,
    viewport: window.innerWidth,
  }));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobile = railSize.viewport <= 760;
  const compactRail = mobile || railSize.width <= 280;
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [mobile]);
  const railMax = Math.max(
    145,
    Math.min(420, Math.floor(railSize.viewport / 2)),
  );
  const drag = useRef<{ x: number; width: number } | null>(null);
  const resizeRail = (width: number) =>
    setRailSize((size) => ({
      ...size,
      width: Math.max(145, Math.min(railMax, width)),
    }));
  useEffect(() => {
    const resize = () =>
      setRailSize((size) => ({
        viewport: window.innerWidth,
        width:
          window.innerWidth <= 760
            ? size.width
            : Math.min(
                size.width,
                Math.max(145, Math.min(420, Math.floor(window.innerWidth / 2))),
              ),
      }));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  return {
    railSize,
    mobileMenuOpen,
    setMobileMenuOpen,
    mobile,
    compactRail,
    railMax,
    drag,
    resizeRail,
  };
}
