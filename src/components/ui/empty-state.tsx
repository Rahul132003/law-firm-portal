export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      {" "}
      <h3 className="text-sm font-semibold text-primary">{title}</h3>{" "}
      <p className="mt-1.5 max-w-sm text-sm text-secondary">{description}</p>{" "}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/**
 * Placeholder for a case-detail tab whose module has not been built yet.
 * Says which build step delivers it rather than pretending to be empty.
 */
export function ComingSoon({
  title,
  step,
  description,
}: {
  title: string;
  step: number;
  description: string;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      {" "}
      <span className="rounded-full border border-hairline px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
        Build step {step}
      </span>
      <h3 className="mt-3 text-sm font-semibold text-primary">{title}</h3>{" "}
      <p className="mt-1.5 max-w-sm text-sm text-secondary">{description}</p>
    </div>
  );
}
