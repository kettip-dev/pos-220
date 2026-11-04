import React, { useCallback, useRef, useState } from "react";
import DeleteModal from "../components/DeleteModal";

/**
 * Promise-based drop-in replacement for window.confirm() that renders the
 * shared in-app DeleteModal instead of the browser's native dialog.
 *
 * Usage:
 *   const [confirm, ConfirmDialog] = useConfirm();
 *   if (!(await confirm({ title, description, confirmText }))) return;
 *   ...
 *   return <>...<ConfirmDialog /></>;
 *
 * `confirm` accepts any DeleteModal prop (title, description, itemName,
 * warningMessage, confirmText, cancelText) and resolves true / false.
 */
export default function useConfirm() {
  const [options, setOptions] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((opts = {}) => {
    // Settle any dialog that is still pending before opening a new one.
    resolverRef.current?.(false);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setOptions(opts);
    });
  }, []);

  const settle = useCallback((result) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const handleClose = useCallback(() => settle(false), [settle]);
  const handleConfirm = useCallback(() => settle(true), [settle]);

  const ConfirmDialog = useCallback(
    () => (
      <DeleteModal
        isOpen={Boolean(options)}
        onClose={handleClose}
        onConfirm={handleConfirm}
        {...(options || {})}
      />
    ),
    [options, handleClose, handleConfirm]
  );

  return [confirm, ConfirmDialog];
}
