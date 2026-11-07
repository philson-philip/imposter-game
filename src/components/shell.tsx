import type { ReactNode } from "react";

/** Phone-width page container with safe-area padding. */
export function Screen({ children, className = "", ...rest }: { children?: ReactNode; className?: string } & Record<`aria-${string}`, string>) {
  return (
    <main
      {...rest}
      className={`relative isolate mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] ${className}`}
    >
      {children}
    </main>
  );
}

/** Soft violet spotlight used behind hero moments. */
export function Spotlight({ tone = "violet" }: { tone?: "violet" | "rose" | "green" }) {
  const color =
    tone === "rose" ? "bg-rose-600/25" : tone === "green" ? "bg-emerald-500/20" : "bg-violet-600/25";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className={`absolute left-1/2 top-[-10%] h-[80vmin] w-[80vmin] -translate-x-1/2 rounded-full blur-3xl animate-drift ${color}`}
      />
    </div>
  );
}
