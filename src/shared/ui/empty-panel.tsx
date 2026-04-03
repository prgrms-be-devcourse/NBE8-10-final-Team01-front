export function EmptyPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-app-border-strong bg-app-elevated p-6 text-center">
      <p className="font-medium text-app-primary">{title}</p>
      <p className="mt-2 text-sm leading-6 text-app-secondary">{description}</p>
    </div>
  );
}
