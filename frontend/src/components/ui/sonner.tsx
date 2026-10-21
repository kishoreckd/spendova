import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme = "system" } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-5 text-emerald-600 dark:text-emerald-400" />
        ),
        info: <InfoIcon className="size-5 text-primary" />,
        warning: <TriangleAlertIcon className="size-5 text-amber-500" />,
        error: <OctagonXIcon className="size-5 text-destructive" />,
        loading: (
          <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "calc(var(--radius) * 1.1)",
          "--width": "380px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "cn-toast gap-3 !items-start p-4 shadow-lg shadow-black/5 dark:shadow-black/30",
          title: "text-sm font-semibold leading-5",
          description: "!text-muted-foreground text-[13px] leading-5",
          icon: "mt-0.5",
          error: "!border-destructive/30",
          closeButton:
            "!bg-popover !border-border !text-muted-foreground hover:!text-foreground opacity-0 transition-opacity group-hover:opacity-100 [[data-sonner-toast]:hover_&]:opacity-100 focus-visible:opacity-100",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
