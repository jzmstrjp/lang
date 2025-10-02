# Cloudflare R2 + Worker + Edge Cache 導入指示書（正しい時系列版）

対象:

- サイト本体: `https://en-ma.ster.jp.net/` (Vercelで稼働中, 現状 CNAME → `165d4216cd575f99.vercel-dns-017.com.`)
- CDNサブドメイン: `https://cdn.en-ma.ster.jp.net/` (新規作成, 画像/音声配信用)
- アセット: WebP画像（200KB×約1000件）, 数秒の音声ファイル（数千件）

目的:

- 静的アセットを本体サイトから分離。
- Cloudflare R2 + Worker + Edge Cache で低遅延・低コスト配信。
- 初回アクセス遅延は発生するが、以降は爆速化。

---

## 全体アーキテクチャ

```
ユーザー
   │
   ▼
cdn.en-ma.ster.jp.net (Cloudflare DNS)
   │
   ▼
Cloudflare Worker
   │
   ├─ HIT → Edgeキャッシュから即応答
   └─ MISS → R2から取得 → Edgeにキャッシュ保存
```

- 本体: `en-ma.ster.jp.net` → Vercel
- アセット: `cdn.en-ma.ster.jp.net` → R2 + Worker

---

## 手順（正しい時系列）

### Step 1. TerraformでCloudflareゾーン作成

まず Cloudflare 側に `cdn.en-ma.ster.jp.net` のゾーンを作成。これにより NS が割り当てられる。

`infra/cdn.tf`:

```hcl
resource "cloudflare_zone" "cdn_zone" {
  account_id = var.cloudflare_account_id
  zone       = "cdn.en-ma.ster.jp.net"
}

output "cdn_zone_nameservers" {
  value = cloudflare_zone.cdn_zone.name_servers
}
```

`terraform apply` 実行後に、次のような出力が得られる:

```
cdn_zone_nameservers = [
  "anna.ns.cloudflare.com",
  "matt.ns.cloudflare.com"
]
```

---

### Step 2. Value-Domain 側で NS 委任（手動）

1. Value-Domain の管理画面を開き、`cdn.en-ma.ster.jp.net` の NS を Step 1で出力された Cloudflare NS に設定。  
   例:
   ```
   cdn.en-ma.ster.jp.net.  IN NS  anna.ns.cloudflare.com.
   cdn.en-ma.ster.jp.net.  IN NS  matt.ns.cloudflare.com.
   ```
2. 反映には最大で数時間かかることがある。

---

### Step 3. TerraformでWorkerとRoute作成

NS設定が反映されたら、Cloudflare Workerを設定する。

`infra/cdn.tf` 追記:

```hcl
resource "cloudflare_worker_script" "cdn" {
  name               = "r2-cdn-worker"
  account_id         = var.cloudflare_account_id
  module             = true
  compatibility_date = "2024-01-01"
  filename           = "${path.module}/../workers/r2-cdn-worker.js"

  r2_bucket_binding {
    name        = "R2_BUCKET"
    bucket_name = var.cloudflare_r2_bucket_name
  }
}

resource "cloudflare_worker_route" "cdn_route" {
  zone_id     = cloudflare_zone.cdn_zone.id
  pattern     = "cdn.en-ma.ster.jp.net/*"
  script_name = cloudflare_worker_script.cdn.name
}
```

---

### Step 4. Worker実装

`workers/r2-cdn-worker.js`:

```js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\//, '');
    if (!path) return new Response('Bad Request', { status: 400 });

    // キャッシュ確認
    const cacheKey = new Request(url.toString(), request);
    const cached = await caches.default.match(cacheKey);
    if (cached) return cached;

    // R2から取得
    const obj = await env.R2_BUCKET.get(path);
    if (!obj) return new Response('Not Found', { status: 404 });

    // レスポンス生成
    const headers = new Headers();
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Content-Type', obj.httpMetadata?.contentType || 'application/octet-stream');
    headers.set('ETag', obj.httpEtag);
    const res = new Response(obj.body, { headers });

    // キャッシュ保存
    ctx.waitUntil(caches.default.put(cacheKey, res.clone()));
    return res;
  },
};
```

---

### Step 5. アプリ側の対応

- **DB保存形式**: 今後は `https://cdn.en-ma.ster.jp.net/...` を保存。
- **既存データ**: R2直リンクが残っている場合はフロントで変換。

変換関数例:

```ts
const BASE_URL = 'https://cdn.en-ma.ster.jp.net';

export function resolveCdnUrl(input: string): string {
  try {
    const u = new URL(input);
    return `${BASE_URL}${u.pathname}`;
  } catch {
    return `${BASE_URL}${input.startsWith('/') ? input : '/' + input}`;
  }
}
```

利用例:

```tsx
<img src={resolveCdnUrl(dbUrl)} alt="lesson" />
<audio controls src={resolveCdnUrl(dbUrl)} />
```

---

## 運用ルール

- 初回アクセスは遅いが、以降はキャッシュHITで高速。
- ファイル更新時は `?v=ハッシュ` やファイル名変更でキャッシュバイパス。
- Value-Domain 側の NS 設定は一度行えば以降不要。TerraformでCloudflare側のみ管理可能。
- コストは R2 の保存＋転送のみ。WorkerとCacheは無料枠で十分。

---

## まとめ

1. **Terraform apply** → Cloudflareゾーン作成 → NS出力を確認
2. **Value-Domain** にそのNSを設定（サブドメイン部分委任）
3. **Terraform apply** → Worker / Route 設定
4. **アプリ側**で `cdn.en-ma.ster.jp.net` を利用

この順番が正しく、時系列的な矛盾はない。
