import { FormAlert } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { useAuth } from "./auth-context";

export function ProfileRecovery() {
  const { error, retryProfile, signOut, loading } = useAuth();
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">Could not load your profile</h1>
      <FormAlert>{error || "Please try again."}</FormAlert>
      <Button loading={loading} onClick={() => void retryProfile()}>
        Try again
      </Button>
      <Button variant="outline" onClick={() => void signOut()}>
        Sign out
      </Button>
    </main>
  );
}
