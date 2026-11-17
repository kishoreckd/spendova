import { useEffect, useState } from "react";
import { DatePicker } from "@/components/common/date-picker";
import { Field, FormAlert } from "@/components/common/form-field";
import { MoneyInput } from "@/components/common/money-input";
import { TilePicker } from "@/components/common/tile-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Users, UserRound } from "lucide-react";
import { useMoney } from "@/hooks/use-money";
import { errorMessage, notifySuccess } from "@/lib/forms";
import { useCreateTrip } from "./hooks";

export function CreateTripDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const money = useMoney();
  const create = useCreateTrip();
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [mode, setMode] = useState<"personal" | "split">("personal");
  const [budget, setBudget] = useState("");
  const [startOn, setStartOn] = useState("");
  const [endOn, setEndOn] = useState("");
  const [participants, setParticipants] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setName("");
      setDestination("");
      setMode("personal");
      setBudget("");
      setStartOn("");
      setEndOn("");
      setParticipants("");
      setNotes("");
      setError("");
    }
  }, [open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Enter a trip name");
    if (startOn && endOn && endOn < startOn)
      return setError("End date must be on or after the start date");
    try {
      const trip = await create.mutateAsync({
        name: name.trim(),
        destination: destination.trim() || null,
        mode,
        currency: money.currency,
        budget: budget || null,
        start_on: startOn || null,
        end_on: endOn || null,
        notes: notes.trim() || null,
        participants:
          mode === "split"
            ? participants
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
            : [],
      });
      notifySuccess(`${trip.name} created`);
      onOpenChange(false);
    } catch (reason) {
      setError(errorMessage(reason, "Could not create this trip"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-xl max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none">
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6">
          <DialogTitle>New trip</DialogTitle>
          <DialogDescription className="sr-only">
            Trip details and participants
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={submit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="space-y-4 overflow-y-auto px-4 py-3 sm:px-6">
            <FormAlert>{error}</FormAlert>
            <Field id="trip-mode" label="Trip type">
              <TilePicker
                id="trip-mode"
                value={mode}
                onChange={(value) => setMode(value as typeof mode)}
                tiles={[
                  {
                    value: "personal",
                    label: "Personal / family",
                    icon: UserRound,
                  },
                  { value: "split", label: "Split trip", icon: Users },
                ]}
              />
            </Field>
            <div className="grid gap-4 min-[480px]:grid-cols-2">
              <Field id="trip-name" label="Name">
                <Input
                  id="trip-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={160}
                  placeholder="e.g. Goa road trip"
                />
              </Field>
              <Field id="trip-destination" label="Destination" optional>
                <Input
                  id="trip-destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  maxLength={160}
                />
              </Field>
            </div>
            <div className="grid gap-4 min-[480px]:grid-cols-2">
              <Field id="trip-start" label="Start" optional>
                <DatePicker
                  id="trip-start"
                  value={startOn}
                  onChange={setStartOn}
                />
              </Field>
              <Field id="trip-end" label="End" optional>
                <DatePicker
                  id="trip-end"
                  value={endOn}
                  onChange={setEndOn}
                  min={startOn || undefined}
                />
              </Field>
            </div>
            <Field id="trip-budget" label="Budget" optional>
              <MoneyInput
                id="trip-budget"
                symbol={money.symbol}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </Field>
            {mode === "split" && (
              <Field id="trip-participants" label="Other travellers" optional>
                <Input
                  id="trip-participants"
                  value={participants}
                  onChange={(e) => setParticipants(e.target.value)}
                  placeholder="Rahul, Meera, Arjun"
                />
              </Field>
            )}
            <Field id="trip-notes" label="Notes" optional>
              <Textarea
                id="trip-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={1000}
                rows={3}
              />
            </Field>
          </div>
          <DialogFooter className="sticky bottom-0 mt-auto border-t bg-background p-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Create trip
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
