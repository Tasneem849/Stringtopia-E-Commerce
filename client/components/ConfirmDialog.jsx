'use client';

import { useEffect, useRef } from 'react';

export default function ConfirmDialog({
  open,
  title,
  description,
  itemName,
  itemType = 'item',
  confirmLabel,
  cancelLabel = 'Keep it',
  busyLabel = 'Working…',
  inputLabel,
  inputHint,
  inputValue,
  onInputChange,
  confirmStyle = 'danger',
  busy = false,
  error = '',
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return undefined;
    const handleCancel = (event) => {
      event.preventDefault();
      if (!busy) onCancel();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      role="alertdialog"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      onClick={(event) => {
        if (event.target === dialogRef.current && !busy) onCancel();
      }}
    >
      <div className="confirm-dialog-card">
        <div className="confirm-dialog-art" aria-hidden="true">
          <span className="confirm-dialog-yarn">🧶</span>
          <span className="confirm-dialog-sparkle">✦</span>
        </div>
        <p className="confirm-dialog-kicker">STRINGTOPIA · ADMIN</p>
        <h2 id="confirm-dialog-title">{title}</h2>
        <p id="confirm-dialog-description" className="confirm-dialog-copy">
          {description || <>You’re about to remove <strong>{itemName}</strong> {itemType === 'product' ? 'from your shop' : 'from your category list'}. This can’t be undone.</>}
        </p>
        {inputLabel && (
          <label className="confirm-dialog-input-wrap">
            <span className="confirm-dialog-input-label">{inputLabel}</span>
            <input
              type="number"
              step="1"
              value={inputValue}
              onChange={(event) => onInputChange(event.target.value)}
              className="field confirm-dialog-input"
              aria-describedby={inputHint ? 'confirm-dialog-input-hint' : undefined}
              autoFocus
              disabled={busy}
            />
            {inputHint && <span id="confirm-dialog-input-hint" className="confirm-dialog-input-hint">{inputHint}</span>}
          </label>
        )}
        {error && <p className="confirm-dialog-error" role="alert">{error}</p>}
        <div className="confirm-dialog-actions">
          <button type="button" onClick={onCancel} disabled={busy} className="btn btn-ghost" autoFocus={!inputLabel}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={`btn ${confirmStyle === 'danger' ? 'confirm-dialog-delete' : 'btn-primary'}`}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
