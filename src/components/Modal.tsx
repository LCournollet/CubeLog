import type { ReactNode } from "react";
import { useEffect } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** Fenêtre modale simple (fermeture par Échap ou clic en dehors). */
export function Modal({ title, onClose, children, footer }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="row between mb">
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="btn ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="row mt" style={{ justifyContent: "flex-end" }}>{footer}</div>}
      </div>
    </div>
  );
}
