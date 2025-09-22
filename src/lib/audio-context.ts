/**
 * モバイルブラウザでの音声再生を有効化するためのダミー音声を再生
 * ユーザーインタラクション時に呼び出してAudioContextを初期化する
 */
export async function initializeAudioContext(): Promise<void> {
  try {
    // 極小サイズの無音WAVファイル（44バイト）
    const dummyAudio = new Audio(
      'data:audio/wav;base64,UklGRigAAABXQVZFZm10IAAAAAEAAQBEAEAAAgAUAGRhdGEEAAAAAAA=',
    );
    await dummyAudio.play();
    dummyAudio.pause();
  } catch (err) {
    console.warn('音声コンテキストの初期化に失敗しました:', err);
  }
}
