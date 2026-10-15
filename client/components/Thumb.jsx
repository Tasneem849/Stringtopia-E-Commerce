import { img } from '@/lib/api';

export default function Thumb({ src, alt = '' }) {
  return (
    <div className="aspect-square w-full overflow-hidden rounded-2xl bg-sky">
      {src ? (
        <img src={img(src, 800)} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center"><p className="text-5xl min-[900px]:text-6xl">🧶✂️🧵</p></div>
      )}
    </div>
  );
}
