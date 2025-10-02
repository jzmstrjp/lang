/**
 * CDN関連のユーティリティ関数
 */

/**
 * URLのホスト名をNEXT_PUBLIC_R2_PUBLIC_DOMAINに置換
 */
export function replaceUrlHost(url: string | null): string {
  if (!url) return '';

  const NEXT_PUBLIC_R2_PUBLIC_DOMAIN = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN;
  if (!NEXT_PUBLIC_R2_PUBLIC_DOMAIN) {
    console.warn('[CDN] NEXT_PUBLIC_R2_PUBLIC_DOMAIN not set, returning original URL');
    return url;
  }

  try {
    const urlObj = new URL(url);
    // パス部分のみを取得（先頭の "/" を削除）
    const path = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;

    // NEXT_PUBLIC_R2_PUBLIC_DOMAINがスラッシュで終わっていたら削除
    const domain = NEXT_PUBLIC_R2_PUBLIC_DOMAIN.endsWith('/')
      ? NEXT_PUBLIC_R2_PUBLIC_DOMAIN.slice(0, -1)
      : NEXT_PUBLIC_R2_PUBLIC_DOMAIN;

    return `${domain}/${path}`;
  } catch (error) {
    console.error('[CDN] Invalid URL format:', url, error);
    return url;
  }
}

/**
 * CDNへのウォームアップリクエストを送信
 * R2にアップロードした後、CDNキャッシュにファイルを配置するために使用
 */
export async function warmupCDN(url: string): Promise<boolean> {
  const cdnUrl = replaceUrlHost(url);
  if (!cdnUrl) {
    console.warn('[CDN] URLが空のためウォームアップをスキップ');
    return false;
  }

  console.log(`   🔥 CDNウォームアップ中: ${cdnUrl}`);

  // Node.jsのfetchがHTTP/2で問題を起こす可能性があるため、
  // より互換性の高いGETメソッドを使用し、AbortControllerで明示的にタイムアウトを制御
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(cdnUrl, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      console.log(`   ✅ CDNウォームアップ成功 (${response.status})`);
      return true;
    } else {
      console.warn(`   ⚠️ CDNウォームアップで非200応答: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        console.warn('   ⚠️ CDNウォームアップタイムアウト (10秒)');
      } else {
        console.warn(`   ⚠️ CDNウォームアップエラー: ${error.name}: ${error.message}`);
        if ('cause' in error && error.cause) {
          console.warn(`   📋 原因: ${error.cause}`);
        }
      }
    } else {
      console.warn('   ⚠️ CDNウォームアップエラー:', error);
    }
    return false;
  }
}

/**
 * 複数のURLに対してCDNウォームアップを実行
 * エラーが発生しても処理を継続する
 */
export async function warmupMultipleCDNUrls(urls: (string | null)[]): Promise<void> {
  const validUrls = urls.filter((url): url is string => Boolean(url));

  if (validUrls.length === 0) {
    console.log('   ℹ️ ウォームアップするURLがありません');
    return;
  }

  console.log(`   🔥 ${validUrls.length}件のURLに対してCDNウォームアップを実行...`);

  // 並列でウォームアップリクエストを送信
  const results = await Promise.allSettled(validUrls.map((url) => warmupCDN(url)));

  const successCount = results.filter((r) => r.status === 'fulfilled' && r.value).length;
  const failCount = results.length - successCount;

  if (failCount > 0) {
    console.log(`   ⚠️ CDNウォームアップ完了: 成功 ${successCount}件、失敗 ${failCount}件`);
  } else {
    console.log(`   ✅ CDNウォームアップ完了: ${successCount}件すべて成功`);
  }
}
