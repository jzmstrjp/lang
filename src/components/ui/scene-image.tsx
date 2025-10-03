import Image from 'next/image';

type SceneImageProps = {
  src: string;
  alt: string;
  opacity?: 'low' | 'medium' | 'full';
  className?: string;
  onLoad?: () => void;
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
    </div>
  );
}
