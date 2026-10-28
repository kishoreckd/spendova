import { useState } from "react";
import type { KeyboardEvent, Ref } from "react";
import { Check, CircleAlert, Plus, X, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type Tile = {
  value: string;
  label: string;
  icon: LucideIcon;
  /** Any CSS colour; defaults to the brand primary. */
  color?: string;
};

type TilePickerProps = {
  id: string;
  tiles: Tile[];
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
  /** Lets react-hook-form focus the picker when it has an error. */
  focusRef?: Ref<HTMLButtonElement>;
  /** Enables the "+ New" tile. Resolve with the value to select. */
  onCreate?: (name: string) => Promise<string>;
  createLabel?: string;
  createPlaceholder?: string;
  maxNameLength?: number;
  /**
   * `tiles` suit frequent choices recognised by icon (transaction categories);
   * `chips` are compact tags for occasional choices (asset types).
   */
  variant?: "tiles" | "chips";
};

/**
 * Tap-to-choose grid used for categories and asset types. Creating a new
 * option happens inline so people never lose the form they are filling in.
 */
export function TilePicker({
  id,
  tiles,
  value,
  onChange,
  invalid,
  describedBy,
  focusRef,
  onCreate,
  createLabel = "New",
  createPlaceholder = "Name",
  maxNameLength = 80,
  variant = "tiles",
}: TilePickerProps) {
  const chips = variant === "chips";
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);
  const focusIndex = Math.max(
    0,
    tiles.findIndex((tile) => tile.value === value),
  );

  function closeCreate() {
    setCreating(false);
    setName("");
    setNameError("");
  }

  async function create() {
    const clean = name.trim().replace(/\s+/g, " ");
    if (!clean) return setNameError("Enter a name");
    if (clean.length > maxNameLength)
      return setNameError(`Keep this under ${maxNameLength} characters`);
    const existing = tiles.find(
      (tile) => tile.label.toLowerCase() === clean.toLowerCase(),
    );
    if (existing) {
      onChange(existing.value);
      return closeCreate();
    }
    setSaving(true);
    setNameError("");
    try {
      onChange(await onCreate!(clean));
      closeCreate();
    } catch (reason) {
      setNameError(
        reason instanceof Error ? reason.message : "Could not add this option",
      );
    } finally {
      setSaving(false);
    }
  }

  function onNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // The picker usually sits inside a larger form; Enter must not submit it.
    if (event.key === "Enter") {
      event.preventDefault();
      void create();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeCreate();
    }
  }

  return (
    <div
      id={id}
      role="group"
      aria-describedby={describedBy}
      className={cn(
        chips
          ? "flex flex-wrap gap-2"
          : "grid grid-cols-4 gap-2 min-[480px]:grid-cols-5 lg:grid-cols-6",
        invalid && "rounded-2xl p-1 ring-2 ring-destructive/40",
      )}
    >
      {tiles.map((tile, index) => {
        const selected = tile.value === value;
        const color = tile.color ?? "var(--primary)";
        const Icon = tile.icon;
        if (chips)
          return (
            <button
              key={tile.value}
              ref={index === focusIndex ? focusRef : undefined}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(tile.value)}
              className={cn(
                "inline-flex h-10 max-w-full items-center gap-1.5 rounded-full border bg-card pr-3.5 pl-2.5 text-sm font-medium outline-none transition active:scale-[.97] hover:border-primary/40 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-9",
                selected &&
                  "border-primary bg-primary/[0.08] text-primary hover:bg-primary/[0.12]",
              )}
            >
              {selected ? (
                <Check className="size-4 shrink-0" aria-hidden />
              ) : (
                <Icon
                  className="size-4 shrink-0"
                  style={{ color }}
                  aria-hidden
                />
              )}
              <span className="truncate">{tile.label}</span>
            </button>
          );
        return (
          <button
            key={tile.value}
            ref={index === focusIndex ? focusRef : undefined}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(tile.value)}
            className={cn(
              "relative flex min-h-[4.75rem] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border bg-card p-2 text-center outline-none transition active:scale-[.97] hover:border-primary/40 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50",
              selected && "border-primary bg-primary/[0.06] shadow-sm",
            )}
          >
            <span
              className="grid size-9 place-items-center rounded-full"
              style={{
                color,
                backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)`,
              }}
            >
              <Icon className="size-[18px]" aria-hidden />
            </span>
            <span className="line-clamp-2 w-full break-words text-[11px] leading-tight font-medium sm:text-xs">
              {tile.label}
            </span>
            {selected && (
              <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground animate-in zoom-in-50 duration-150">
                <Check className="size-3" aria-hidden />
              </span>
            )}
          </button>
        );
      })}
      {onCreate && !creating && chips && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-dashed pr-3.5 pl-2.5 text-sm font-medium text-muted-foreground outline-none transition hover:border-primary/50 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-9"
        >
          <Plus className="size-4" aria-hidden />
          {createLabel}
        </button>
      )}
      {onCreate && !creating && !chips && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex min-h-[4.75rem] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed p-2 text-muted-foreground outline-none transition hover:border-primary/50 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="grid size-9 place-items-center rounded-full bg-muted">
            <Plus className="size-[18px]" aria-hidden />
          </span>
          <span className="text-[11px] font-medium sm:text-xs">
            {createLabel}
          </span>
        </button>
      )}
      {creating && (
        <div className="col-span-full basis-full space-y-1.5 rounded-xl border border-dashed border-primary/40 bg-primary/[0.03] p-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={name}
              maxLength={maxNameLength + 20}
              placeholder={createPlaceholder}
              aria-label={createPlaceholder}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? `${id}-create-error` : undefined}
              onChange={(event) => {
                setName(event.target.value);
                setNameError("");
              }}
              onKeyDown={onNameKeyDown}
            />
            <Button
              type="button"
              loading={saving}
              onClick={() => void create()}
            >
              Add
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Cancel"
              disabled={saving}
              onClick={closeCreate}
            >
              <X />
            </Button>
          </div>
          {nameError && (
            <p
              id={`${id}-create-error`}
              role="alert"
              className="flex items-center gap-1.5 px-1 text-xs font-medium text-destructive"
            >
              <CircleAlert className="size-3.5 shrink-0" aria-hidden />
              {nameError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
