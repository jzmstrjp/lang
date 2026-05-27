## 基本

- チャットは全て日本語で答えること

## データベースについて

- `prisma db push` は絶対に使わない。データが消える危険があるため禁止。
- カラム追加・変更・削除など、スキーマ変更は必ず `prisma migrate dev` を使う。
  - マイグレーションコマンドは必ず許可をとってから実行すること

## 問題の種類

- kids・short・medium・long などがある
- `wordCount`（語数: `WORD_COUNT_RULES`）と `difficultyLevel`（難易度: `DIFFICULTY_LEVEL_RULES`）の2属性。子ども向け kids は生成時に両方セットされる（語数 2〜6 → `difficultyLevel` 1）。ルートでは `/level/kids` は難易度のみ、`/problems/*` は語数のみでフィルタする
- 定義の正本: `src/config/problem.ts`（`WORD_COUNT_RULES` / `DIFFICULTY_LEVEL_RULES` / `PROBLEM_ROUTE_LENGTHS`）
- DB 取得時のフィルタ: `src/lib/problem-service.ts` の `fetchProblems`
- ルート別の使い方: `src/app/level/[level]/page.tsx`（難易度）、`src/app/problems/[type]/page.tsx`（語数 short/medium/long）

## コーディングについて

- 基本的にuseEffectは使用しない。どうしても必要な時はユーザーにまず確認を取ること。
- Suspenseやuse()を使って、データ取得中でもできるだけスケルトンと共にUIを表示すること。
- 無闇にstateを増やさないこと。直和型で適切にstateを表現すること。
- Promiseのthen()メソッドを使わず、async/awaitを使用すること。
