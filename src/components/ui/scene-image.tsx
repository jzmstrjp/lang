import Image from 'next/image';

type SceneImageProps = {
  src: string;
  alt: string;
  opacity?: 'low' | 'medium' | 'full';
  className?: string;
  onLoad?: () => void;
  sentence1?: string;
  sentence2?: string;
  isBlurred?: boolean;
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
  isBlurred = false,
}: SceneImageProps) {
  const opacityClass =
    opacity === 'low' ? 'opacity-30' : opacity === 'medium' ? 'opacity-50' : 'opacity-100';

  return (
    <div className={`relative w-full w-[500px] max-w-full sm:mt-2 mx-auto ${isBlurred ? 'blur-sm' : ''}`}>
      <Image
        src={src}
        alt={alt}
        width={500}
        height={750}
        className={`w-full h-auto object-contain ${opacityClass} ${className}`}
        style={{
          maskImage:
            'linear-gradient(to bottom, black 0%, black 48.7%, transparent 48.7%, transparent 51.3%, black 51.3%, black 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, black 0%, black 48.7%, transparent 48.7%, transparent 51.3%, black 51.3%, black 100%)',
        }}
        priority
        unoptimized
        onLoad={onLoad}
      />

      {/* sentence1: 区切り棒の上あたり */}
      {sentence1 && (
        <div
          className="absolute left-[3%] right-[3%] text-center text-[var(--background)] bg-[var(--overlay-dark)] p-1 bottom-[53%]"
          style={{ textShadow: '0 0 4px var(--text-black)' }}
        >
          {sentence1}
        </div>
      )}

      {/* sentence2: 画像の一番下 */}
      {sentence2 && (
        <div
          className="absolute bottom-[2%] left-[3%] right-[3%] text-center text-[var(--background)] bg-[var(--overlay-dark)] p-1"
          style={{ textShadow: '0 0 4px var(--text-black)' }}
        >
          {sentence2}
        </div>
      )}
    </div>
  );
}
