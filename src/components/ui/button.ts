/**
 * Button class recipes.
 *
 * Exported as strings rather than a component so `<button>`, `<Link>` and
 * form submit buttons can all share exactly the same visual treatment.
 */

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl tracking-wide transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60";

const SIZES = {
  sm: "px-4 py-2 text-sm font-semibold",
  md: "px-5 py-2.5 text-base font-bold",
} as const;

const VARIANTS = {
  primary:
    "relative overflow-hidden bg-gradient-to-r from-sky-500 via-sky-600 to-blue-600 text-white font-bold " +
    "shadow-md shadow-sky-500/25 " +
    "hover:from-sky-400 hover:via-sky-500 hover:to-blue-500 " +
    "hover:shadow-lg hover:shadow-sky-500/35 " +
    "before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/20 before:to-transparent before:pointer-events-none",
  secondary:
    "border border-slate-300 bg-white text-slate-800 font-semibold " +
    "shadow-sm " +
    "hover:bg-slate-50 hover:border-sky-400 hover:text-sky-700 hover:shadow-md",
  ghost: "text-slate-600 font-semibold hover:bg-slate-100 hover:text-sky-700",
  danger:
    "border border-rose-200 bg-rose-50 text-rose-700 font-semibold shadow-sm " +
    "hover:bg-rose-100 hover:border-rose-300 hover:shadow-md",
} as const;

export function buttonClass(
  variant: keyof typeof VARIANTS = "primary",
  size: keyof typeof SIZES = "md",
): string {
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]}`;
}
