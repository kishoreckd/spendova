import { useMutation, useQuery } from "@tanstack/react-query";
import { assetsApi } from "@/api/assets/api";
import type { AssetInput } from "@/api/assets/types";
import { queryClient, queryKeys } from "@/lib/query-client";

const invalidate = () =>
  queryClient.invalidateQueries({ queryKey: queryKeys.assets });

export function useAssets(enabled = true) {
  return useQuery({
    queryKey: queryKeys.assets,
    queryFn: assetsApi.list,
    enabled,
  });
}

export function useSaveAsset() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string | null; body: AssetInput }) =>
      id ? assetsApi.update(id, body) : assetsApi.create(body),
    onSuccess: invalidate,
  });
}

export function useArchiveAsset() {
  return useMutation({ mutationFn: assetsApi.archive, onSuccess: invalidate });
}
