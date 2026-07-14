import * as React from "react";
import { cn } from "@/lib/utils";

export function Empty({
  title,
  description,
  icon: Icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card/60 p-12 text-center", className)}>
      {Icon && (
        <div className="mb-4 rounded-2xl bg-gradient-to-br from-brand-100 to-gold-100 p-4">
          <Icon className="h-7 w-7 text-brand-600" />
        </div>
      )}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
