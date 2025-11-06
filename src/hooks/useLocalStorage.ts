import { useCallback, useSyncExternalStore } from 'react';

/**
 * useSyncExternalStoreを使用したlocalStorageフック
 * React 19のConcurrent Rendering対応
 *
 * @param key - localStorageのキー
 * @param initialValue - 初期値（SSR時やキーが存在しない場合に使用）
 * @returns [現在の値, 値を更新する関数]
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  // タブ間同期のためのsubscribe関数
  const subscribe = useCallback(
    (callback: () => void) => {
      const handleStorageChange = (event: StorageEvent) => {
        // 対象のキーが変更された場合のみコールバックを実行
        if (event.key === key || event.key === null) {
          callback();
        }
      };

      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    },
    [key],
  );

  // 現在のlocalStorage値を同期的に取得
  const getSnapshot = useCallback((): T => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);

      // nullの場合は初期値を返す
      if (item === null) {
        return initialValue;
      }

      // boolean型の場合
      if (typeof initialValue === 'boolean') {
        return (item === 'true') as T;
      }

      // number型の場合
      if (typeof initialValue === 'number') {
        const parsed = parseInt(item, 10);
        return (isNaN(parsed) ? initialValue : parsed) as T;
      }

      // その他の型の場合はJSON.parseを試みる
      return JSON.parse(item) as T;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  }, [key, initialValue]);

  // SSR時の初期値を返す
  const getServerSnapshot = useCallback((): T => {
    return initialValue;
  }, [initialValue]);

  // useSyncExternalStoreで値を購読
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // 値を更新する関数
  const setValue = useCallback(
    (newValue: T) => {
      try {
        let stringValue: string;

        // localStorageに保存
        if (typeof newValue === 'boolean') {
          stringValue = newValue.toString();
          window.localStorage.setItem(key, stringValue);
        } else if (typeof newValue === 'number') {
          stringValue = newValue.toString();
          window.localStorage.setItem(key, stringValue);
        } else {
          stringValue = JSON.stringify(newValue);
          window.localStorage.setItem(key, stringValue);
        }

        // 同一タブ内の他のコンポーネントに通知するため、手動でstorageイベントを発火
        // 注: storageイベントは通常、他のタブでのみ発火するため、同一タブ内では手動で発火が必要
        window.dispatchEvent(
          new StorageEvent('storage', {
            key,
            newValue: stringValue,
            oldValue: window.localStorage.getItem(key),
            storageArea: window.localStorage,
            url: window.location.href,
          }),
        );
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key],
  );

  return [value, setValue];
}
