/**
 * Button class recipes.
 *
 * Exported as strings rather than a component so `<button>`, `<Link>` and
 * form submit buttons can all share exactly the same visual treatment.
 *
 * Flat fills and hairline borders, no gradients or coloured glows — a button
 * should read as a plain control on the surface, not as a piece of chrome
 * floating above it.
 */

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors " +
  "disabled:pointer-events-none disabled:opacity-55";

const SIZES = {
  sm: "px-3 py-1.5 text-[13px]",
  md: "px-4 py-2 text-sm",
} as const;

const VARIANTS = {
  primary: "bg-accent-700 text-white hover:bg-accent-800",
  secondary:
    "border border-hairline-strong bg-raised text-primary hover:bg-sunken",
  ghost: "text-secondary hover:bg-sunken hover:text-primary",
  danger:
    "border border-danger/30 bg-danger-soft text-danger hover:border-danger/50",
  /** For the one destructive action that should look destructive. */
  dangerSolid: "bg-danger text-white hover:brightness-95",
} as const;

export function buttonClass(
  variant: keyof typeof VARIANTS = "primary",
  size: keyof typeof SIZES = "md",
): string {
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]}`;
}
