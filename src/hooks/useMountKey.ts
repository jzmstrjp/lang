import { useEffect, useState } from 'react';

/**
 * Next.js 16 の `cacheComponents: true` 環境下では、ルート全体が React の `<Activity>` で
 * ラップされ、ナビゲーション時に unmount されず `display: none` になるだけになる。
 * その結果、`useState` などの client state が preserve されてしまい、
 * 「戻ってきたら前回の phase のまま」のような不具合が発生する。
 *
 * このフックは mount 直後に key をインクリメントすることで、
 * 親コンポーネントが `<Inner key={mountKey} />` のように使えば
 * Activity が visible に切り替わるたびに children を強制 remount できる。
 *
 * 参考: https://github.com/vercel/next.js/discussions/85502
 */
export function useMountKey() {
  const [mountKey, setMountKey] = useState(0);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setMountKey((prev) => prev + 1);
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, []);

  return mountKey;
}
