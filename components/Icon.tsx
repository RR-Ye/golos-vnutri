import { href } from "@/lib/base";

/** Встроенная иконка OpenMoji из public/icons. Декоративная: смысл передаёт подпись или голос. */
export function Icon({ id, size = 64, className = "" }: { id: string; size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={href(`/icons/${id}.svg`)} width={size} height={size} alt="" aria-hidden draggable={false} className={className} />
  );
}
