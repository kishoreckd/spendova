import { useContext } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { PageActionsSlot } from "@/app/page-actions-context";

/** Places a page's primary buttons beside its title in the shell header. */
export function PageActions({ children }: { children: ReactNode }) {
  const slot = useContext(PageActionsSlot);
  return slot ? createPortal(children, slot) : null;
}
