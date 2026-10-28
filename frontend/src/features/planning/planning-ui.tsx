import type { ReactNode } from "react";
import { MoreHorizontal, Trash2, type LucideIcon } from "lucide-react";
import { FormAlert } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { errorMessage } from "@/lib/forms";

export function ItemMenu({
  label,
  deleteLabel = "Delete",
  onDelete,
}: {
  label: string;
  deleteLabel?: string;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Actions for ${label}`}
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 />
          {deleteLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Skeletons() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[0, 1].map((item) => (
        <div key={item} className="h-40 animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  action,
}: {
  icon: LucideIcon;
  title: string;
  action?: ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex min-h-52 flex-col items-center justify-center gap-4 p-8 text-center">
        <span className="rounded-2xl bg-primary/10 p-4 text-primary">
          <Icon className="size-7" />
        </span>
        <h2 className="font-semibold">{title}</h2>
        {action}
      </CardContent>
    </Card>
  );
}

export function LoadError({
  error,
  fallback,
  onRetry,
}: {
  error: unknown;
  fallback: string;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-3">
      <FormAlert>{errorMessage(error, fallback)}</FormAlert>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
