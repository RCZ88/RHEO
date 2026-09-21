import * as React from "react";
interface ModalOverlayProps {
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function ModalOverlay({ onClose, children, className = '' }: ModalOverlayProps) {
  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[var(--z-overlay)]"
      onClick={onClose}
      style={{ animation: 'overlayIn var(--fast) var(--ease-out)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={className}
        style={{ animation: 'modalIn var(--normal) var(--ease-out)' }}
      >
        {children}
      </div>
    </div>
  );
}
