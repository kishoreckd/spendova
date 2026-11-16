import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { authApi } from "@/api/auth/api";
import { Field } from "@/components/common/form-field";
import { PasswordInput } from "@/components/common/password-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { controlProps, errorMessage, notifySuccess } from "@/lib/forms";
import { queryKeys } from "@/lib/query-client";

export function TwoFactorCard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: queryKeys.twoFactor,
    queryFn: authApi.twoFactorStatus,
  });
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const disable = useMutation({
    mutationFn: () => authApi.disableTwoFactor(password),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.twoFactor });
      setOpen(false);
      setPassword("");
      notifySuccess("Two-step sign-in is off");
    },
    onError: (reason) => setError(errorMessage(reason, "Couldn't turn off")),
  });
  const data = status.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" /> Two-step sign-in
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {status.isPending ? (
          <Skeleton className="h-10 w-full" />
        ) : status.isError ? (
          <Button variant="outline" onClick={() => void status.refetch()}>
            Retry
          </Button>
        ) : data?.enabled ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">
                {data.method === "totp" ? "Authenticator app" : "Email code"}
              </Badge>
              <span className="text-muted-foreground">
                {data.recovery_codes_left} backup codes left
              </span>
            </div>
            <Button variant="outline" onClick={() => setOpen(true)}>
              Turn off
            </Button>
          </>
        ) : (
          <Button onClick={() => navigate("/secure-account")}>Turn on</Button>
        )}
      </CardContent>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          setPassword("");
          setError("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Turn off two-step sign-in</DialogTitle>
          </DialogHeader>
          <form
            noValidate
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!password) {
                setError("Enter your password");
                return;
              }
              setError("");
              disable.mutate();
            }}
          >
            <Field id="disable-password" label="Password" error={error}>
              <PasswordInput
                {...controlProps("disable-password", error)}
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
              />
            </Field>
            <DialogFooter showCloseButton>
              <Button
                type="submit"
                variant="destructive"
                loading={disable.isPending}
              >
                Turn off
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
