/**
 * 圧縮設定（固定値）
 */
export const compressionConfig = {
  // 全般設定
  enabled: true,
  minSizeForCompression: 1024, // 1KB以上で圧縮対象
  minCompressionRatio: 0.1, // 10%以上の削減効果がある場合のみ圧縮

  // 画像設定
  image: {
    useWebP: true, // 常にWebP形式を使用
    webpQuality: 80, // WebP品質（80%）
    pngCompression: true, // PNG用gzip圧縮（フォールバック時）
  },

  // 音声設定
  audio: {
    compressMP3: true, // MP3用gzip圧縮
  },
} as const;
