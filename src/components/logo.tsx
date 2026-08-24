import Image from "next/image";

export function Logo({
  className,
  grande = false,
}: {
  className?: string;
  grande?: boolean;
}) {
  if (grande) {
    return (
      <div className={className}>
        <Image
          src="/brand/estacion-verde-logo-v2.png"
          alt="Estación Verde — Frutas y Verduras"
          width={206}
          height={172}
          priority
          className="h-auto w-48 object-contain drop-shadow-[0_16px_32px_rgba(94,58,18,0.12)] sm:w-56"
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 md:justify-center ${className ?? ""}`}>
      <Image
        src="/brand/estacion-verde-logo-v2.png"
        alt="Estación Verde — Frutas y Verduras"
        width={132}
        height={110}
        className="h-12 w-14 shrink-0 object-contain md:h-auto md:w-32"
      />
      <div className="flex flex-col leading-[1.15] md:hidden">
        <span className="font-heading text-[16px] font-extrabold tracking-[-0.035em] text-current">
          estación verde
        </span>
        <span className="text-[9px] font-semibold tracking-[0.15em] text-current opacity-60 uppercase">
          Frutas y Verduras
        </span>
      </div>
    </div>
  );
}
