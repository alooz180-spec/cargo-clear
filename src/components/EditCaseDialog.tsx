import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";

import { updateCase } from "@/lib/case-api";
import { CURRENCIES, COMPANIES, IRAQI_BANKS, type CaseRow } from "@/lib/manifest";
import { useI18n } from "@/lib/i18n";

const OTHER_BANK = "__other__";

export function EditCaseDialog({
  open,
  onClose,
  kase,
}: {
  open: boolean;
  onClose: () => void;
  kase: CaseRow;
}) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [company, setCompany] = useState<string>(
    COMPANIES.includes(kase.company as (typeof COMPANIES)[number]) ? kase.company : COMPANIES[0],
  );
  const [supplier, setSupplier] = useState(kase.supplier ?? "");
  const [vessel, setVessel] = useState(kase.vessel ?? "");
  const [blNumber, setBlNumber] = useState(kase.bl_number ?? "");
  const [eta, setEta] = useState(kase.eta ?? "");
  const knownBank = (IRAQI_BANKS as readonly string[]).includes(kase.bank);
  const [bankChoice, setBankChoice] = useState<string>(knownBank ? kase.bank : OTHER_BANK);
  const [bankOther, setBankOther] = useState(knownBank ? "" : kase.bank);
  const [amount, setAmount] = useState(String(kase.amount));
  const [currency, setCurrency] = useState<string>(kase.currency);
  const [notes, setNotes] = useState(kase.notes ?? "");

  const bank = bankChoice === OTHER_BANK ? bankOther : bankChoice;

  const mutation = useMutation({
    mutationFn: () =>
      updateCase(kase.id, {
        company: company.trim(),
        supplier: supplier.trim() || null,
        vessel: vessel.trim() || null,
        bl_number: blNumber.trim() || null,
        eta: eta || null,
        bank: bank.trim(),
        amount: parseFloat(amount) || 0,
        currency,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case", kase.id] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      toast.success(t("toast.caseUpdated", { ref: kase.ref }));
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t("toast.updateCaseFailed")),
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
      aria-label={t("dialog.editCase")}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("dialog.editCase")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("dialog.close")}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{kase.ref}</p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("field.company")}</label>
            <select required value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls}>
              {COMPANIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("field.supplier")} <span className="font-normal">{t("field.optional")}</span>
            </label>
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("field.vessel")} <span className="font-normal">{t("field.optional")}</span>
            </label>
            <input value={vessel} onChange={(e) => setVessel(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("field.blNumber")} <span className="font-normal">{t("field.optional")}</span>
              </label>
              <input value={blNumber} onChange={(e) => setBlNumber(e.target.value)} className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("field.eta")} <span className="font-normal">{t("field.optional")}</span>
              </label>
              <input type="date" value={eta} onChange={(e) => setEta(e.target.value)} className={`${inputCls} font-mono`} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("field.bank")}</label>
            <select value={bankChoice} onChange={(e) => setBankChoice(e.target.value)} className={inputCls}>
              {IRAQI_BANKS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
              <option value={OTHER_BANK}>{t("field.bankOther")}</option>
            </select>
            {bankChoice === OTHER_BANK && (
              <input
                required
                value={bankOther}
                onChange={(e) => setBankOther(e.target.value)}
                placeholder={t("field.bankNamePlaceholder")}
                className={`${inputCls} mt-2`}
              />
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("field.amount")}</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${inputCls} text-end font-mono`}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("field.currency")}</label>
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
              {t("field.notes")} <span className="font-normal">{t("field.optional")}</span>
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
            {t("dialog.cancel")}
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-deep disabled:opacity-60"
          >
            {mutation.isPending ? t("dialog.saving") : t("dialog.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
