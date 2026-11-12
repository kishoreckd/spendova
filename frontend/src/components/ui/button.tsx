import { buttonVariants } from "./button-variants";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Loader2 } from "lucide-react";

function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /** Shows a spinner, hides other icons, and blocks repeat clicks. */
    loading?: boolean;
  }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(
        buttonVariants({ variant, size, className }),
        "data-loading:cursor-wait [&[data-loading]>svg:not([data-spinner])]:hidden",
      )}
      {...props}
    >
      {loading && <Loader2 data-spinner className="animate-spin" aria-hidden />}
      {children}
    </ButtonPrimitive>
  );
}

export { Button };
