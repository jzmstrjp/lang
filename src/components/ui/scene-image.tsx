import Image from 'next/image';

type SceneImageProps = {
  frameNumber: 1 | 2;
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
  frameNumber,
  src,
  alt,
  className = '',
  onLoad,
  sentence1,
  sentence2,
  isBlurred = false,
}: SceneImageProps) {
  return (
    <div
      className={`relative w-[1000px] max-w-full aspect-[4/2.9] mx-auto ${isBlurred ? 'blur-sm' : ''}`}
    >
      <div
        className={`absolute top-0 left-0 w-full h-full transition duration-200 ${className} ${frameNumber === 1 ? '' : 'brightness-50 portrait:[transform:scale(0.4)_translateY(-120%)] portrait:[transform-origin:top_center] landscape:[transform:scale(0.4)_translateX(-110%)] landscape:[transform-origin:center_left]'} ${frameNumber === 1 ? 'rounded-xl' : 'rounded-4xl'} overflow-hidden`}
      >
        <Image
          src={src}
          alt={alt}
          width={500}
          height={750}
          className={`w-full h-auto object-contain scale-[1.02] origin-top`}
          priority
          unoptimized
          onLoad={onLoad}
        />
        {sentence1 && (
          <div className="md:text-3xl lg:text-4xl font-extrabold leading-[1.5] absolute bottom-[2%] left-[1%] right-[1%] text-center text-white p-1 text-shadow-[0_0_2px_black,0_0_2px_black,0_0_2px_black,0_0_2px_black,0_0_2px_black,0_0_2px_black,0_0_2px_black,0_0_2px_black,0_0_2px_black,0_0_2px_black,0_0_2px_black]">
            {sentence1}
          </div>
        )}
      </div>

      <div
        className={`absolute top-0 left-0 w-full h-full transition duration-200 ${className} ${frameNumber === 2 ? '' : 'brightness-50 portrait:[transform:scale(0.4)_translateY(120%)] portrait:[transform-origin:bottom_center] landscape:[transform:scale(0.4)_translateX(110%)] landscape:[transform-origin:center_right]'} ${frameNumber === 2 ? 'rounded-xl' : 'rounded-4xl'} overflow-hidden`}
      >
        <Image
          src={src}
          alt={alt}
          width={500}
          height={750}
          className={`w-full h-auto object-contain absolute bottom-0 left-0 scale-[1.02] origin-bottom`}
          priority
          unoptimized
          onLoad={onLoad}
        />
        {sentence2 && (
          <div className="md:text-3xl lg:text-4xl font-extrabold leading-[1.5] absolute bottom-[2%] left-[1%] right-[1%] text-center text-white p-1 text-shadow-[0_0_2px_black,0_0_2px_black,0_0_2px_black,0_0_2px_black,0_0_2px_black,0_0_2px_black,0_0_2px_black,0_0_2px_black,0_0_2px_black,0_0_2px_black,0_0_2px_black]">
            {sentence2}
          </div>
        )}
      </div>
    </div>
  );
}
