import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { preferencesApi } from "@/api/preferences/api";
import { Field, FormAlert } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { queryKeys } from "@/lib/query-client";
import {
  controlProps,
  errorMessage,
  notifySuccess,
  notifyError,
} from "@/lib/forms";
import { Controller } from "react-hook-form";
const schema = z.object({
  daily_token_limit: z
    .string()
    .regex(/^\d+$/, "Enter a whole number")
    .refine((v) => Number(v) <= 1000000, "Maximum 1,000,000"),
  bills: z.boolean(),
  deposits: z.boolean(),
  budgets: z.boolean(),
  weekly: z.boolean(),
});
type Values = z.infer<typeof schema>;
export function PreferencesCard() {
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.preferences,
    queryFn: ({ signal }) => preferencesApi.get(signal),
    refetchInterval: 30000,
  });
  const save = useMutation({
    mutationFn: preferencesApi.save,
    onSuccess: () =>
      cache.invalidateQueries({ queryKey: queryKeys.preferences }),
  });
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      daily_token_limit: "20000",
      bills: false,
      deposits: false,
      budgets: false,
      weekly: false,
    },
  });
  const {
    reset,
    formState: { isDirty, errors },
  } = form;
  useEffect(() => {
    if (query.data && !isDirty)
      reset({
        ...query.data,
        daily_token_limit: String(query.data.daily_token_limit),
      });
  }, [query.data, isDirty, reset]);
  if (query.isPending)
    return <div className="h-56 animate-pulse rounded-2xl bg-muted" />;
  if (query.error)
    return (
      <Card>
        <CardContent className="space-y-3 p-5">
          <FormAlert>
            {errorMessage(query.error, "Could not load settings")}
          </FormAlert>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  const prefs = query.data!;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Finance assistant & email</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">
              Tokens used / reserved today
            </dt>
            <dd className="font-semibold">
              {prefs.tokens_used.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Remaining</dt>
            <dd className="font-semibold">
              {prefs.tokens_remaining.toLocaleString()}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Resets{" "}
          {new Date(prefs.resets_at).toLocaleString(undefined, {
            timeZone: prefs.reset_timezone,
          })}{" "}
          ({prefs.reset_timezone})
        </p>
        {!prefs.ai_available && (
          <p className="text-sm text-muted-foreground">AI not configured</p>
        )}
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            if (Number(values.daily_token_limit) > prefs.max_daily_tokens) {
              form.setError("daily_token_limit", {
                message: `Maximum ${prefs.max_daily_tokens.toLocaleString()}`,
              });
              return;
            }
            try {
              const result = await save.mutateAsync({
                ...values,
                daily_token_limit: Number(values.daily_token_limit),
              });
              reset({
                ...result,
                daily_token_limit: String(result.daily_token_limit),
              });
              notifySuccess("Settings saved");
            } catch (reason) {
              notifyError(reason, "Could not save settings");
            }
          })}
        >
          <Field
            id="daily-tokens"
            label="Daily AI token limit"
            error={errors.daily_token_limit?.message}
          >
            <Input
              {...controlProps(
                "daily-tokens",
                errors.daily_token_limit?.message,
              )}
              inputMode="numeric"
              {...form.register("daily_token_limit")}
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            0 pauses AI. Maximum {prefs.max_daily_tokens.toLocaleString()}.
            Failed requests may retain a token reservation.
          </p>
          {(
            [
              ["bills", "Bill & EMI reminders"],
              ["deposits", "FD / RD maturity reminders"],
              ["budgets", "Budget alerts"],
              ["weekly", "Weekly review email"],
            ] as const
          ).map(([key, label]) => (
            <div
              key={key}
              className="flex min-h-12 items-center justify-between gap-3"
            >
              <label htmlFor={`email-${key}`} className="text-sm">
                {label}
              </label>
              <Controller
                name={key}
                control={form.control}
                render={({ field }) => (
                  <Switch
                    id={`email-${key}`}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={save.isPending}
                  />
                )}
              />
            </div>
          ))}
          {save.error && (
            <FormAlert>
              {errorMessage(save.error, "Could not save settings")}
            </FormAlert>
          )}
          <Button
            type="submit"
            loading={save.isPending}
            disabled={!isDirty}
            className="w-full"
          >
            Save settings
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
