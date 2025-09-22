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

    // ボリュームを0にして音が聞こえないようにする
    dummyAudio.volume = 0;

    // load()を呼んでから再生
    dummyAudio.load();
    await dummyAudio.play();
    dummyAudio.pause();

    console.log('音声コンテキストの初期化が完了しました');
  } catch (err) {
    console.warn('音声コンテキストの初期化に失敗しました:', err);
  }
}

/**
 * 音声ファイルを事前ロードして再生準備する
 */
export async function preloadAndPlayAudio(audioSrc: string): Promise<HTMLAudioElement> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(audioSrc);

    const handleCanPlayThrough = () => {
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      audio.removeEventListener('error', handleError);
      resolve(audio);
    };

    const handleError = () => {
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      audio.removeEventListener('error', handleError);
      reject(new Error('音声ファイルの読み込みに失敗しました'));
    };

    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.addEventListener('error', handleError);

    // 読み込み開始
    audio.load();
  });
}
