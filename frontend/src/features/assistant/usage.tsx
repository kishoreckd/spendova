import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { preferencesApi } from "@/api/preferences/api";
import { queryKeys } from "@/lib/query-client";
export function AssistantUsage() {
  const query = useQuery({
    queryKey: queryKeys.preferences,
    queryFn: ({ signal }) => preferencesApi.get(signal),
    refetchInterval: 30000,
  });
  if (!query.data) return null;
  const usage = query.data;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm">
      <span>
        {usage.tokens_remaining.toLocaleString()} /{" "}
        {usage.daily_token_limit.toLocaleString()} AI tokens remaining today
      </span>
      <Link
        className="text-primary underline underline-offset-4"
        to="/settings"
      >
        Manage allowance
      </Link>
    </div>
  );
}
