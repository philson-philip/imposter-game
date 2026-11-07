import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "lg" | "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold tracking-tight transition duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]";

const sizes: Record<Size, string> = {
  lg: "h-14 w-full px-6 text-lg",
  md: "h-11 px-4 text-base",
  sm: "h-9 rounded-xl px-3 text-sm",
};

const variants: Record<Variant, string> = {
  primary:
    "bg-linear-to-br from-violet-600 to-violet-500 text-white shadow-[0_12px_32px_-12px_rgba(139,92,246,0.9)] hover:brightness-110",
  secondary: "border border-ink-700 bg-ink-800 text-mist-200 hover:border-ink-600 hover:bg-ink-700/60",
  ghost: "text-mist-400 hover:bg-ink-800 hover:text-mist-200",
  danger: "border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20",
};

export function buttonClass(variant: Variant = "primary", size: Size = "lg", className = ""): string {
  return [base, sizes[size], variants[variant], className].filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  size = "lg",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "lg",
  className = "",
  children,
}: {
  href: ComponentProps<typeof Link>["href"];
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-4 rounded-2xl border border-ink-700 bg-ink-800 px-4 py-3 text-left transition hover:border-ink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
    >
      <span className="flex-1">
        <span className="block font-semibold text-mist-200">{label}</span>
        {hint && <span className="mt-0.5 block text-sm leading-snug text-mist-400">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-violet-500" : "bg-ink-600"}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`}
        />
      </span>
    </button>
  );
}

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl border border-ink-700 bg-ink-800 p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`h-10 rounded-xl text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
              active ? "bg-violet-500 text-white shadow" : "text-mist-400 hover:text-mist-200"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
        selected
          ? "border-violet-500/60 bg-violet-500/20 text-violet-200"
          : "border-ink-700 bg-ink-800 text-mist-300 hover:border-ink-600"
      }`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-mist-500">{label}</h2>
        {hint && <span className="text-sm text-mist-400">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-mist-500">{children}</p>;
}
