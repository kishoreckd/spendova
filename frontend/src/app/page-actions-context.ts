import { createContext } from "react";

/** Element in the shell header where the current page renders its actions. */
export const PageActionsSlot = createContext<HTMLElement | null>(null);
