import { useEffect, useRef, useState } from 'react';
import { normalizeName } from './types';
import {
  PIN_LENGTH,
  PinRecord,
  clearPin,
  getPinRecord,
  isValidPin,
  setPin,
  verifyAgainstRecord,
} from './pin';

interface Props {
  open: boolean;
  user: string | null;
  onClose: () => void;
  onSignIn: (name: string) => void;
  onSignOut: () => void;
}

type Step =
  | 'name'
  | 'verify'
  | 'set-pin'
  | 'change-pin'
  | 'remove-pin';

export const LoginModal = ({
  open,
  user,
  onClose,
  onSignIn,
  onSignOut,
}: Props) => {
  const [step, setStep] = useState<Step>('name');
  const [draft, setDraft] = useState(user ?? '');
  const [pin, setPin_] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pending sign-in state during PIN verification.
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [pendingRecord, setPendingRecord] = useState<PinRecord | null>(null);

  // Whether the currently-signed-in user has a PIN configured. `null` while
  // still loading so we don't briefly render both "Set" and "Change" buttons.
  const [myPinRecord, setMyPinRecord] = useState<PinRecord | null | 'loading'>(
    'loading',
  );

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep('name');
    setDraft(user ?? '');
    setPin_('');
    setNewPin('');
    setConfirmPin('');
    setOldPin('');
    setBusy(false);
    setError(null);
    setPendingName(null);
    setPendingRecord(null);
    setMyPinRecord('loading');
    if (user) {
      getPinRecord(normalizeName(user))
        .then((r) => setMyPinRecord(r))
        .catch(() => setMyPinRecord(null));
    } else {
      setMyPinRecord(null);
    }
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    // Focus the primary input for the current step.
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const goName = () => {
    setStep('name');
    setPin_('');
    setNewPin('');
    setConfirmPin('');
    setOldPin('');
    setError(null);
    setPendingName(null);
    setPendingRecord(null);
  };

  const continueSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = draft.trim();
    if (trimmed.length === 0 || trimmed === user) return;
    setBusy(true);
    try {
      const rec = await getPinRecord(normalizeName(trimmed));
      if (rec) {
        setPendingName(trimmed);
        setPendingRecord(rec);
        setStep('verify');
      } else {
        onSignIn(trimmed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check PIN.');
    } finally {
      setBusy(false);
    }
  };

  const submitVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingName || !pendingRecord) return;
    if (!isValidPin(pin)) {
      setError(`Enter your ${PIN_LENGTH}-digit PIN.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ok = await verifyAgainstRecord(pendingRecord, pin);
      if (ok) {
        onSignIn(pendingName);
      } else {
        setError('That PIN is wrong.');
        setPin_('');
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify PIN.');
    } finally {
      setBusy(false);
    }
  };

  const submitSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!isValidPin(newPin)) {
      setError(`Enter a ${PIN_LENGTH}-digit PIN.`);
      return;
    }
    if (newPin !== confirmPin) {
      setError("Those PINs don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setPin(normalizeName(user), newPin);
      const rec = await getPinRecord(normalizeName(user));
      setMyPinRecord(rec);
      goName();
    } catch (err) {
      setError(
        err instanceof Error
          ? `Couldn't save PIN: ${err.message}`
          : "Couldn't save PIN.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submitChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !myPinRecord || myPinRecord === 'loading') return;
    if (!isValidPin(newPin)) {
      setError(`Enter a ${PIN_LENGTH}-digit PIN.`);
      return;
    }
    if (newPin !== confirmPin) {
      setError("Those PINs don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ok = await verifyAgainstRecord(myPinRecord, oldPin);
      if (!ok) {
        setError('Current PIN is wrong.');
        setBusy(false);
        return;
      }
      await setPin(normalizeName(user), newPin);
      const rec = await getPinRecord(normalizeName(user));
      setMyPinRecord(rec);
      goName();
    } catch (err) {
      setError(
        err instanceof Error
          ? `Couldn't change PIN: ${err.message}`
          : "Couldn't change PIN.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submitRemovePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !myPinRecord || myPinRecord === 'loading') return;
    setBusy(true);
    setError(null);
    try {
      const ok = await verifyAgainstRecord(myPinRecord, oldPin);
      if (!ok) {
        setError('Current PIN is wrong.');
        setBusy(false);
        return;
      }
      await clearPin(normalizeName(user));
      setMyPinRecord(null);
      goName();
    } catch (err) {
      setError(
        err instanceof Error
          ? `Couldn't remove PIN: ${err.message}`
          : "Couldn't remove PIN.",
      );
    } finally {
      setBusy(false);
    }
  };

  const title =
    step === 'verify'
      ? 'Enter PIN'
      : step === 'set-pin'
      ? 'Set a PIN'
      : step === 'change-pin'
      ? 'Change PIN'
      : step === 'remove-pin'
      ? 'Remove PIN'
      : user
      ? 'Switch user'
      : 'Sign in';

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
    >
      <form
        className="modal panel"
        onSubmit={
          step === 'verify'
            ? submitVerify
            : step === 'set-pin'
            ? submitSetPin
            : step === 'change-pin'
            ? submitChangePin
            : step === 'remove-pin'
            ? submitRemovePin
            : continueSignIn
        }
      >
        <h2 id="login-title" className="modal-title">{title}</h2>

        {step === 'name' && (
          <div className="modal-body">
            <p className="muted small" style={{ marginTop: 0 }}>
              Type the name you use as a player. You'll see matches and stats for
              yourself and the people you've played with.
            </p>
            <label className="field" style={{ marginTop: 10 }}>
              <span>Your name</span>
              <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="e.g. Tommy"
                autoComplete="off"
                spellCheck={false}
              />
            </label>

            {user && (
              <div className="pin-manage">
                <div className="pin-manage-label">
                  <span className="muted small">
                    Signed in as <strong>{user}</strong>
                  </span>
                  {myPinRecord === 'loading' ? (
                    <span className="pin-status">Checking PIN…</span>
                  ) : myPinRecord ? (
                    <span className="pin-status pin-status-on">PIN protected</span>
                  ) : (
                    <span className="pin-status">No PIN set</span>
                  )}
                </div>
                <div className="pin-manage-actions">
                  {myPinRecord === null && (
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setError(null);
                        setStep('set-pin');
                      }}
                    >
                      Set PIN
                    </button>
                  )}
                  {myPinRecord && myPinRecord !== 'loading' && (
                    <>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => {
                          setError(null);
                          setStep('change-pin');
                        }}
                      >
                        Change PIN
                      </button>
                      <button
                        type="button"
                        className="ghost danger"
                        onClick={() => {
                          setError(null);
                          setStep('remove-pin');
                        }}
                      >
                        Remove PIN
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {error && <p className="pin-error">{error}</p>}
          </div>
        )}

        {step === 'verify' && pendingName && (
          <div className="modal-body">
            <p className="muted small" style={{ marginTop: 0 }}>
              <strong>{pendingName}</strong>'s account is PIN protected.
            </p>
            <label className="field pin-field" style={{ marginTop: 10 }}>
              <span>{PIN_LENGTH}-digit PIN</span>
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d*"
                maxLength={PIN_LENGTH}
                value={pin}
                onChange={(e) => setPin_(e.target.value.replace(/\D/g, ''))}
                className="pin-input"
              />
            </label>
            {error && <p className="pin-error">{error}</p>}
          </div>
        )}

        {step === 'set-pin' && (
          <div className="modal-body">
            <p className="muted small" style={{ marginTop: 0 }}>
              A PIN is asked for anyone who tries to sign in as <strong>{user}</strong>.
              Choose {PIN_LENGTH} digits you'll remember.
            </p>
            <label className="field pin-field" style={{ marginTop: 10 }}>
              <span>New PIN</span>
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                pattern="\d*"
                maxLength={PIN_LENGTH}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                className="pin-input"
              />
            </label>
            <label className="field pin-field">
              <span>Confirm PIN</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                pattern="\d*"
                maxLength={PIN_LENGTH}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                className="pin-input"
              />
            </label>
            {error && <p className="pin-error">{error}</p>}
          </div>
        )}

        {step === 'change-pin' && (
          <div className="modal-body">
            <p className="muted small" style={{ marginTop: 0 }}>
              Enter your current PIN, then pick a new one.
            </p>
            <label className="field pin-field" style={{ marginTop: 10 }}>
              <span>Current PIN</span>
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                pattern="\d*"
                maxLength={PIN_LENGTH}
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
                className="pin-input"
              />
            </label>
            <label className="field pin-field">
              <span>New PIN</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                pattern="\d*"
                maxLength={PIN_LENGTH}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                className="pin-input"
              />
            </label>
            <label className="field pin-field">
              <span>Confirm new PIN</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                pattern="\d*"
                maxLength={PIN_LENGTH}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                className="pin-input"
              />
            </label>
            {error && <p className="pin-error">{error}</p>}
          </div>
        )}

        {step === 'remove-pin' && (
          <div className="modal-body">
            <p className="muted small" style={{ marginTop: 0 }}>
              Anyone will be able to sign in as <strong>{user}</strong> without a
              PIN after this.
            </p>
            <label className="field pin-field" style={{ marginTop: 10 }}>
              <span>Current PIN</span>
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                pattern="\d*"
                maxLength={PIN_LENGTH}
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
                className="pin-input"
              />
            </label>
            {error && <p className="pin-error">{error}</p>}
          </div>
        )}

        <div className="modal-actions">
          {step === 'name' && user && (
            <button
              type="button"
              className="ghost danger"
              onClick={onSignOut}
              style={{ marginRight: 'auto' }}
              disabled={busy}
            >
              Sign out
            </button>
          )}
          {step !== 'name' && (
            <button
              type="button"
              className="ghost"
              onClick={goName}
              style={{ marginRight: 'auto' }}
              disabled={busy}
            >
              ← Back
            </button>
          )}
          <button type="button" className="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          {step === 'name' && (
            <button
              type="submit"
              className="primary"
              disabled={
                busy ||
                draft.trim().length === 0 ||
                draft.trim() === user
              }
            >
              {busy ? '…' : user ? 'Switch' : 'Continue'}
            </button>
          )}
          {step === 'verify' && (
            <button
              type="submit"
              className="primary"
              disabled={busy || !isValidPin(pin)}
            >
              {busy ? '…' : 'Sign in'}
            </button>
          )}
          {step === 'set-pin' && (
            <button
              type="submit"
              className="primary"
              disabled={busy || !isValidPin(newPin) || !isValidPin(confirmPin)}
            >
              {busy ? '…' : 'Save PIN'}
            </button>
          )}
          {step === 'change-pin' && (
            <button
              type="submit"
              className="primary"
              disabled={
                busy ||
                !isValidPin(oldPin) ||
                !isValidPin(newPin) ||
                !isValidPin(confirmPin)
              }
            >
              {busy ? '…' : 'Save PIN'}
            </button>
          )}
          {step === 'remove-pin' && (
            <button
              type="submit"
              className="primary danger"
              disabled={busy || !isValidPin(oldPin)}
            >
              {busy ? '…' : 'Remove PIN'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

interface PillProps {
  user: string | null;
  onClick: () => void;
}

export const UserPill = ({ user, onClick }: PillProps) => (
  <button
    type="button"
    className={`user-pill ${user ? 'on' : ''}`}
    onClick={onClick}
    aria-label={user ? `Signed in as ${user}` : 'Sign in'}
  >
    <span className="user-avatar" aria-hidden="true">
      {user ? user.charAt(0).toUpperCase() : '?'}
    </span>
    <span className="user-pill-label">{user ?? 'Sign in'}</span>
  </button>
);
