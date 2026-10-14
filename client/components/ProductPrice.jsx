import { effectivePrice, hasSalePrice, money } from '@/lib/api';

export default function ProductPrice({ product, className = '' }) {
  const onSale = hasSalePrice(product);
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${className}`}>
      {onSale && <del className="text-sm font-normal text-stone-500">{money(product.price)}</del>}
      <span className={onSale ? 'font-bold text-berry' : ''}>{money(effectivePrice(product))}</span>
    </span>
  );
}
