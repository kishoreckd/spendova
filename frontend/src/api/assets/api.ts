import { apiFetch } from "../client";
import type { AssetInput, AssetItem } from "./types";

export const assetsApi = {
  list: (signal?: AbortSignal) => apiFetch<AssetItem[]>("/assets", { signal }),
  create: (body: AssetInput) =>
    apiFetch<AssetItem>("/assets", { method: "POST", body }),
  update: (id: string, body: Partial<AssetInput>) =>
    apiFetch<AssetItem>(`/assets/${id}`, { method: "PATCH", body }),
  archive: (id: string) =>
    apiFetch<void>(`/assets/${id}`, { method: "DELETE" }),
};
