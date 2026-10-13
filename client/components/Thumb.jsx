import { img } from '@/lib/api';

export default function Thumb({ src }) {
  return (
    <div className="aspect-square w-full overflow-hidden rounded-2xl bg-sky">
      {src ? (
        <img src={img(src, 800)} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center"><p className="text-6xl">🧶✂️🧵</p></div>
      )}
    </div>
  );
}
