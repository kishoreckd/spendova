import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, ReceiptText, Search } from "lucide-react";
import type {
  TransactionFilters,
  TransactionItem,
} from "@/api/transactions/types";
import { FormAlert } from "@/components/common/form-field";
import type { ShellContext } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCategories } from "@/features/categories/hooks";
import { useMoney } from "@/hooks/use-money";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { errorMessage } from "@/lib/forms";
import { useTransactions } from "./hooks";
import { TransactionFilterBar } from "./transaction-filters";
import { TransactionList } from "./transaction-list";
import { TransactionDetailDialog } from "./transaction-detail-dialog";

const PAGE_SIZE = 50;
export default function TransactionsPage() {
  const { openTransaction } = useOutletContext<ShellContext>();
  const money = useMoney();
  const categories = useCategories(true, true);
  const [query, setQuery] = useState("");
  const search = useDebouncedValue(query, 300);
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<TransactionItem | null>(null);
  const validRange = !filters.from || !filters.to || filters.from <= filters.to;
  const result = useTransactions(
    {
      ...filters,
      search: search || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
    validRange,
  );
  const items = result.data ?? [];
  const error = !validRange
    ? "Start date must be before the end date"
    : result.error
      ? errorMessage(result.error, "Could not load transactions")
      : "";
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
          className="pl-10"
          placeholder="Search all transactions"
          aria-label="Search transactions"
        />
      </div>
      <TransactionFilterBar
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setPage(0);
        }}
      />
      {error && (
        <div className="space-y-3">
          <FormAlert>{error}</FormAlert>
          {validRange && (
            <Button variant="outline" onClick={() => void result.refetch()}>
              Try again
            </Button>
          )}
        </div>
      )}
      {result.isPending && validRange ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-2xl bg-muted"
            />
          ))}
        </div>
      ) : (
        !error && (
          <>
            {!items.length ? (
              <Card className="border-dashed">
                <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
                  <ReceiptText className="size-10 text-muted-foreground" />
                  <h2 className="font-semibold">
                    {query || Object.values(filters).some(Boolean) || page
                      ? "No matches"
                      : "No transactions yet"}
                  </h2>
                  <Button onClick={openTransaction}>
                    <Plus />
                    Add transaction
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div
                aria-busy={result.isFetching}
                className={
                  result.isPlaceholderData
                    ? "pointer-events-none opacity-50"
                    : ""
                }
              >
                <TransactionList
                  items={items}
                  categories={categories.items}
                  locale={money.locale}
                  onSelect={setSelected}
                />
              </div>
            )}
            <nav
              className="flex scroll-mb-40 items-center justify-between gap-3 pb-12 lg:pb-0 [&_button]:scroll-mb-40"
              aria-label="Transaction pages"
            >
              <Button
                variant="outline"
                disabled={page === 0 || result.isFetching}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </Button>
              <span
                className="text-sm text-muted-foreground"
                aria-live="polite"
              >
                Page {page + 1}
                {result.isFetching ? " ? Loading" : ""}
              </span>
              <Button
                variant="outline"
                disabled={items.length < PAGE_SIZE || result.isFetching}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </nav>
          </>
        )
      )}
      <TransactionDetailDialog
        key={selected?.id ?? "closed"}
        transaction={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
