import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request, { params }: { params: Promise<{ count: string }> }) {
  const { count } = await params;
  const correctCount = parseInt(count, 10);

  if (isNaN(correctCount) || correctCount < 1) {
    return new Response('Invalid count', { status: 400 });
  }

  // Noto Sans JPフォント（Black/900）を取得
  const fontData = await fetch(
    'https://fonts.gstatic.com/s/notosansjp/v55/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFLgk75s.ttf',
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '30px 40px',
          position: 'relative',
          fontFamily: 'Noto Sans JP',
          fontWeight: 900,
          background: "white",
        }}
      >
        {/* 左側：正解画像 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://en-ma.ster.jp.net/images/correct1.png"
          alt="ガッツポーズ"
          height={580}
          style={{
            marginRight: 50,
          }}
        />

        {/* 右側：テキスト */}
        <div
          style={{
            display: 'flex',
            flexGrow: 1,
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 64,
              color: '#2a2b3c',
              lineHeight: 1.4,
            }}
          >
            英語リスニング問題に
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 140,
              fontWeight: 'bold',
              color: '#2f8f9d',
              lineHeight: 1.4,
            }}
          >
            {correctCount}問連続
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 84,
              fontWeight: 'bold',
              color: '#d77a61',
            }}
          >
            正解しました！
          </div>
        </div>

        {/* 右下：サイト名（absolute） */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            bottom: 40,
            right: 40,
            fontSize: 52,
            color: '#2a2b3c',
            opacity: 0.7,
          }}
        >
          英語きわめ太郎
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Noto Sans JP',
          data: fontData,
          style: 'normal',
          weight: 900,
        },
      ],
    },
  );
}
