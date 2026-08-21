export function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <svg width="34" height="34" viewBox="0 0 28 28" className="shrink-0">
        <circle cx="14" cy="14" r="13" fill="#F1E6CE" stroke="var(--border)" strokeWidth="0.75" />
        <path d="M14 1a13 13 0 0 1 9.19 22.19L18 14Z" fill="var(--primary)" opacity="0.55" />
        <circle cx="14" cy="14" r="9.5" fill="var(--primary)" />
      </svg>
      <div className="flex flex-col leading-[1.15]">
        <span className="font-heading text-[15.5px] font-semibold tracking-tight">
          Estación Verde
        </span>
        <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          Frutas y Verduras
        </span>
      </div>
    </div>
  );
}
