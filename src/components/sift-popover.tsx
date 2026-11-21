import React, { useEffect } from 'react';
import { autoUpdate, flip, FloatingPortal, offset, shift, useFloating, type Placement } from '@floating-ui/react';

interface SiftPopoverProps {
  anchor: HTMLElement | null;
  children: React.ReactNode;
  placement?: Placement;
  onDismiss?: () => void;
}
/** Portal menus outside scroll/overflow containers with collision-aware placement. */
export function SiftPopover({ anchor, children, placement = 'bottom-start', onDismiss }: SiftPopoverProps) {
  const { refs, floatingStyles } = useFloating({
    open: true,
    strategy: 'fixed',
    placement,
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  useEffect(() => { refs.setReference(anchor); }, [anchor, refs]);
  useEffect(() => {
    if (!onDismiss) return;
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onDismiss(); };
    const down = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchor?.contains(target) || refs.floating.current?.contains(target)) return;
      onDismiss();
    };
    document.addEventListener('keydown', key);
    document.addEventListener('mousedown', down);
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('mousedown', down); };
  }, [anchor, onDismiss, refs.floating]);
  if (!anchor) return null;
  return (
    <FloatingPortal>
      <div ref={refs.setFloating} style={{ ...floatingStyles, zIndex: 100 }} data-sift-portal="" className="sift-popover">
        {children}
      </div>
    </FloatingPortal>
  );
}
