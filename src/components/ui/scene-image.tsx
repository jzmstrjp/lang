import Image from 'next/image';

type SceneImageProps = {
  src: string;
  alt: string;
  opacity?: 'low' | 'medium' | 'full';
  className?: string;
  onLoad?: () => void;
  sentence1?: string;
  sentence2?: string;
};

/**
 * 学習画面で使用する共通の画像コンポーネント
 * 縦横比: 500x750 (2:3)
 */
export function SceneImage({
  src,
  alt,
  opacity = 'full',
  className = '',
  onLoad,
  sentence1,
  sentence2,
}: SceneImageProps) {
  const opacityClass =
    opacity === 'low' ? 'opacity-30' : opacity === 'medium' ? 'opacity-50' : 'opacity-100';

  return (
    <div className="relative w-full max-w-[500px] mx-auto">
      <Image
        src={src}
        alt={alt}
        width={500}
        height={750}
        className={`w-full h-auto object-contain ${opacityClass} ${className}`}
        priority
        unoptimized
        onLoad={onLoad}
      />
      {/* 画像中央の白い横線 */}
      <div className="absolute top-1/2 left-0 w-full h-[2%] bg-white -translate-y-1/2" />

      {/* sentence1: 区切り棒の上あたり */}
      {sentence1 && (
        <div
          className="absolute left-[3%] right-[3%] text-center text-white bg-black/50 p-1 bottom-[53%]"
          style={{ textShadow: '0 0 4px black' }}
        >
          {sentence1}
        </div>
      )}

      {/* sentence2: 画像の一番下 */}
      {sentence2 && (
        <div
          className="absolute bottom-[2%] left-[3%] right-[3%] text-center text-white bg-black/50 p-1"
          style={{ textShadow: '0 0 4px black' }}
        >
          {sentence2}
        </div>
      )}
    </div>
  );
}
