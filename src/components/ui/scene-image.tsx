import Image from 'next/image';

type SceneImageProps = {
  src: string;
  alt: string;
  mode: 'top' | 'bottom';
  className?: string;
  onLoad?: () => void;
};

/**
 * 学習画面で使用する共通の画像コンポーネント
 * 元画像の縦横比: 500x750 (2:3)
 * 表示領域: 500x333 (3:2) - 上半分または下半分を表示
 */
export function SceneImage({ src, alt, mode, className = '', onLoad }: SceneImageProps) {
  return (
    <div className="relative w-full max-w-[720px] mx-auto aspect-[2/1.4] overflow-hidden">
      <Image
        src={src}
        alt={alt}
        width={500}
        height={750}
        className={`absolute w-full h-auto object-cover ${mode === 'top' ? 'top-0' : 'bottom-0'} ${className}`}
        priority
        unoptimized
        onLoad={onLoad}
      />
    </div>
  );
}
