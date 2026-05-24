import { createContext, useCallback, useContext, useMemo, useState } from "react";
import "./ConfirmContext.css";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setRequest({
        message,
        confirmLabel: options.confirmLabel || "OK",
        cancelLabel: options.cancelLabel || "Cancel",
        danger: Boolean(options.danger),
        resolve,
      });
    });
  }, []);

  const close = useCallback(
    (result) => {
      if (request?.resolve) request.resolve(result);
      setRequest(null);
    },
    [request],
  );

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {request && (
        <div className="confirm-popover" role="dialog" aria-modal="true">
          <div className="confirm-message">{request.message}</div>
          <div className="confirm-actions">
            <button
              type="button"
              className="confirm-btn confirm-cancel"
              onClick={() => close(false)}
            >
              {request.cancelLabel}
            </button>
            <button
              type="button"
              className={`confirm-btn confirm-ok ${request.danger ? "danger" : ""}`}
              onClick={() => close(true)}
            >
              {request.confirmLabel}
            </button>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error("useConfirm must be used inside ConfirmProvider");
  return context;
}
