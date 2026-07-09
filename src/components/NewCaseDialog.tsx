import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";

import { createCase } from "@/lib/case-api";
import { CURRENCIES, COMPANIES, IRAQI_BANKS } from "@/lib/manifest";

const OTHER_BANK = "__other__";

export function NewCaseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [company, setCompany] = useState<string>(COMPANIES[0]);
  const [bankChoice, setBankChoice] = useState<string>(IRAQI_BANKS[0]);
  const [bankOther, setBankOther] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<string>("USD");
  const [notes, setNotes] = useState("");

  const bank = bankChoice === OTHER_BANK ? bankOther : bankChoice;

  const mutation = useMutation({
    mutationFn: () =>
      createCase({
        company: company.trim(),
        bank: bank.trim(),
        amount: parseFloat(amount) || 0,
        currency,
        notes: notes.trim() || null,
      }),
    onSuccess: (kase) => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      toast.success(`Case ${kase.ref} opened`);
      onClose();
      navigate({ to: "/cases/$caseId", params: { caseId: kase.id } });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not create case"),
  });

  if (!open) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  const inputCls =
    "w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="New case"
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">New case</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          A reference and the 7 standard documents are created automatically.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Company</label>
            <input required value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Bank</label>
            <input required value={bank} onChange={(e) => setBank(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Amount</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${inputCls} text-right font-mono`}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={`${inputCls} font-mono`}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Notes <span className="font-normal">(optional)</span>
            </label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-deep disabled:opacity-60"
          >
            {mutation.isPending ? "Creating…" : "Create case"}
          </button>
        </div>
      </form>
    </div>
  );
}
