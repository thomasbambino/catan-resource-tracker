import { useEffect, useState } from 'react';

const KEY = 'catan.username';

export const readUser = (): string | null => {
  try {
    const v = window.localStorage.getItem(KEY);
    return v && v.trim().length > 0 ? v : null;
  } catch {
    return null;
  }
};

export const writeUser = (name: string | null): void => {
  try {
    if (name && name.trim().length > 0) {
      window.localStorage.setItem(KEY, name.trim());
    } else {
      window.localStorage.removeItem(KEY);
    }
    window.dispatchEvent(new Event('catan-user-changed'));
  } catch {
    // ignore
  }
};

export const useUser = (): [string | null, (name: string | null) => void] => {
  const [user, setUser] = useState<string | null>(() => readUser());

  useEffect(() => {
    const onChange = () => setUser(readUser());
    window.addEventListener('catan-user-changed', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('catan-user-changed', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  return [user, writeUser];
};
