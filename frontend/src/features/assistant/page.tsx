import { useEffect, useRef, useState } from "react";
import { Bot, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type {
  AssistantReply,
  ChatTurn,
  PurchaseScenario,
} from "@/api/insights/types";
import { Field, FormAlert } from "@/components/common/form-field";
import { PageActions } from "@/components/layout/page-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { controlProps, errorMessage } from "@/lib/forms";
import { currencySymbol, formatMoney } from "@/lib/format";
import { useFinanceAssistant, useFinanceSnapshot } from "./hooks";
import { AssistantUsage } from "./usage";
import { PurchaseCheck } from "./purchase-check";
const schema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Enter a question")
    .max(2000, "Keep your question under 2000 characters"),
});
const suggestions = [
  "How much can I save?",
  "When do my FD and RD mature?",
  "Which loan should I repay first?",
  "Can I afford another EMI?",
];
type Message = ChatTurn & { id: string; reply?: AssistantReply };
export default function AssistantPage() {
  const snapshot = useFinanceSnapshot();
  const chat = useFinanceAssistant();
  const [messages, setMessages] = useState<Message[]>([]);
  const [useAI, setUseAI] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { question: "" },
  });
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, chat.isPending]);
  const context = messages.at(-1)?.reply?.snapshot ?? snapshot.data;
  const money = (v: string | number) =>
    formatMoney(v, context?.currency ?? "INR");
  async function ask(question: string, scenario?: PurchaseScenario) {
    if (chat.isPending) return;
    try {
      const result = await chat.mutateAsync({
        question,
        history: messages.slice(-12).map(({ role, content }) => ({
          role,
          content: content.slice(0, 6000),
        })),
        use_ai: useAI,
        scenario,
      });
      setMessages((items) => [
        ...items,
        { id: crypto.randomUUID(), role: "user", content: question },
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.answer,
          reply: result,
        },
      ]);
      form.reset();
    } catch (reason) {
      toast.error(errorMessage(reason, "Could not get an answer"));
    }
  }
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <AssistantUsage />
      <PageActions>
        <Button
          variant="outline"
          disabled={chat.isPending || !messages.length}
          onClick={() => {
            setMessages([]);
            chat.reset();
          }}
        >
          <Trash2 />
          <span className="hidden sm:inline">New chat</span>
        </Button>
      </PageActions>
      {snapshot.isPending && (
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      )}
      {snapshot.error && (
        <div className="space-y-3">
          <FormAlert>
            {errorMessage(snapshot.error, "Could not load your finances")}
          </FormAlert>
          <Button variant="outline" onClick={() => void snapshot.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {context && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Average income", context.average_income],
              ["Average spending", context.average_spending],
              ["Monthly EMIs", context.monthly_emi],
              ["Monthly headroom", context.monthly_headroom],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardContent className="space-y-2 p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="break-words text-lg font-semibold tabular-nums">
                    {money(value)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {context.period_start} to {context.period_end} (exclusive)
          </p>
        </>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_300px]">
        <Card className="min-w-0">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="flex items-center gap-2 font-semibold">
              <Bot className="size-5 text-primary" />
              Finance Assistant
            </div>
            <div
              role="log"
              aria-label="Finance conversation"
              aria-live="polite"
              className="max-h-[55dvh] min-h-48 space-y-4 overflow-y-auto overscroll-contain"
            >
              {!messages.length && (
                <div className="flex min-h-48 flex-col items-start justify-center gap-2">
                  {suggestions.map((question) => (
                    <Button
                      key={question}
                      variant="outline"
                      className="h-auto max-w-full whitespace-normal text-left"
                      disabled={chat.isPending || !context}
                      onClick={() => void ask(question)}
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              )}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "ml-6 rounded-2xl bg-primary/10 p-4"
                      : "mr-2 space-y-3 rounded-2xl bg-muted/50 p-4"
                  }
                >
                  <p className="text-xs font-medium text-muted-foreground">
                    {message.role === "user"
                      ? "You"
                      : message.reply?.mode === "ai"
                        ? "AI assistant"
                        : "Local assistant"}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {message.content}
                  </p>
                  {message.reply?.calculation?.kind === "deposit" && (
                    <dl className="grid gap-3 border-t pt-3 min-[480px]:grid-cols-2">
                      {[
                        ["Contributions", "contributed"],
                        ["Estimated maturity", "estimated_maturity"],
                        ["Estimated interest", "estimated_interest"],
                      ].map(([label, key]) => (
                        <div key={key}>
                          <dt className="text-xs text-muted-foreground">
                            {label}
                          </dt>
                          <dd className="font-medium">
                            {money(String(message.reply!.calculation![key]))}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {message.reply?.calculation &&
                    message.reply.calculation.kind !== "deposit" && (
                      <dl className="grid grid-cols-1 gap-3 border-t pt-3 min-[480px]:grid-cols-2">
                        {[
                          ["Total you pay", "total_outlay"],
                          ["Save first (months)", "save_first_months"],
                          ["EMI / income (%)", "emi_to_income_percent"],
                        ].map(([label, key]) => (
                          <div key={key}>
                            <dt className="text-xs text-muted-foreground">
                              {label}
                            </dt>
                            <dd className="font-medium">
                              {message.reply?.calculation?.[key] == null
                                ? "Unavailable"
                                : key === "total_outlay"
                                  ? money(
                                      String(message.reply.calculation[key]),
                                    )
                                  : String(message.reply.calculation[key])}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                </div>
              ))}
              {chat.isPending && (
                <p
                  role="status"
                  className="animate-pulse text-sm text-muted-foreground"
                >
                  Reviewing your finances...
                </p>
              )}
              <div ref={end} />
            </div>
            {chat.error && (
              <FormAlert>
                {errorMessage(
                  chat.error,
                  "Could not get an answer. Try again.",
                )}
              </FormAlert>
            )}
            <form
              noValidate
              onSubmit={form.handleSubmit((v) => ask(v.question))}
              className="space-y-3"
            >
              <Field
                id="finance-question"
                label="Your question"
                error={form.formState.errors.question?.message}
              >
                <Textarea
                  {...controlProps(
                    "finance-question",
                    form.formState.errors.question?.message,
                  )}
                  {...form.register("question")}
                  rows={3}
                  maxLength={2000}
                  placeholder="Ask about your savings, loans or next purchase"
                />
              </Field>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex min-h-10 items-center gap-2 text-sm">
                  <Checkbox
                    checked={useAI}
                    onCheckedChange={(checked) => setUseAI(checked === true)}
                    disabled={!context?.ai_available || chat.isPending}
                  />
                  Use AI
                </label>
                <Button
                  type="submit"
                  loading={chat.isPending}
                  disabled={!context}
                >
                  <Send />
                  Ask
                </Button>
              </div>
              {useAI && (
                <p className="text-xs text-muted-foreground">
                  Sends your question, recent chat and financial summary to
                  OpenAI.
                </p>
              )}
            </form>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-4">
              <Button
                variant="outline"
                className="w-full"
                aria-expanded={purchaseOpen}
                onClick={() => setPurchaseOpen(!purchaseOpen)}
              >
                Purchase check
              </Button>
              {purchaseOpen && (
                <PurchaseCheck
                  symbol={currencySymbol(context?.currency ?? "INR")}
                  pending={chat.isPending}
                  onSubmit={(scenario) =>
                    ask(
                      "Can I afford this purchase, or should I save first?",
                      scenario,
                    )
                  }
                />
              )}
            </CardContent>
          </Card>
          {context && (
            <details className="rounded-2xl border bg-card p-4 text-sm">
              <summary className="cursor-pointer font-medium">
                Assumptions & missing data
              </summary>
              <ul className="mt-3 space-y-2 text-muted-foreground">
                {context.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
