import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "en" | "ar";

const STORAGE_KEY = "manifest.lang";

// ---------------------------------------------------------------------------
// Document type labels. The DATABASE values never change (see manifest.ts).
// We only map each stored value to a human label per language for display.
// Unknown / custom (extra) document names fall through unchanged.
// ---------------------------------------------------------------------------
const DOC_LABELS: Record<string, { en: string; ar: string }> = {
  "Swift (Bank Transfer)": { en: "Swift (Bank Transfer)", ar: "السويفت (حوالة بنكية)" },
  Invoice: { en: "Invoice", ar: "الفاتورة" },
  "Packing List": { en: "Packing List", ar: "قائمة التعبئة" },
  "Certificate of Origin": { en: "Certificate of Origin", ar: "شهادة المنشأ" },
  "Shipping Documents": { en: "Shipping Documents", ar: "مستندات الشحن" },
  "البيان الكمركي": { en: "Customs Declaration", ar: "البيان الكمركي" },
  "Exit Permission": { en: "Exit Permission", ar: "إذن الخروج" },
  "البيان الكمركي المسبق": { en: "Advance Customs Declaration", ar: "البيان الكمركي المسبق" },
};

export function docLabel(docType: string, lang: Lang): string {
  const entry = DOC_LABELS[docType];
  return entry ? entry[lang] : docType;
}

// ---------------------------------------------------------------------------
// Translation dictionary
// ---------------------------------------------------------------------------
type Dict = Record<string, string>;

const en: Dict = {
  "app.tagline": "TT document control",

  "lang.toggle": "ع",
  "lang.label": "Language",

  "nav.dashboard": "Dashboard",
  "nav.cases": "Cases",
  "nav.signOut": "Sign out",

  // Dashboard
  "dashboard.title": "Dashboard",
  "dashboard.subtitle": "Document status across all transfers.",
  "stat.inProgress": "In progress",
  "stat.complete": "Complete",
  "stat.sentToBank": "Sent to bank",
  "stat.totalCases": "Total cases",
  "needsDocs.title": "Needs documents",
  "needsDocs.subtitle": "In-progress cases, most complete first.",
  "needsDocs.empty": "No open cases. Everything is either complete or submitted.",
  "common.loading": "Loading…",
  "dashboard.daysOpen": "{n}d open",

  // Cases list
  "cases.title": "Cases",
  "cases.subtitle": "One case per telegraphic transfer.",
  "cases.new": "New case",
  "cases.searchPlaceholder": "Search company, supplier, vessel, bank, reference, amount…",
  "filter.all": "All",
  "filter.in_progress": "In progress",
  "filter.complete": "Complete",
  "filter.sent": "Sent to bank",
  "col.reference": "Reference",
  "col.company": "Company",
  "col.bank": "Bank",
  "col.amount": "Amount",
  "col.progress": "Progress",
  "col.status": "Status",
  "cases.noMatch": "No cases match.",

  // Status badges
  "status.in_progress": "In progress",
  "status.complete": "Complete",
  "status.sent": "Sent to bank",

  // Case detail
  "case.backAll": "All cases",
  "case.edit": "Edit",
  "case.delete": "Delete case",
  "case.opened": "Opened",
  "case.daysAgo": "{n}d ago",
  "case.loading": "Loading case…",
  "case.notFound": "Case not found.",
  "manifest.title": "Document manifest",
  "manifest.verifiedCount": "{v}/{t} verified",
  "doc.notAttached": "Not attached",
  "doc.view": "view",
  "doc.badge.copy": "copy",
  "doc.badge.extra": "Extra",
  "doc.attach": "Attach",
  "doc.uploading": "Uploading…",
  "doc.dropHere": "Drop file here",
  "doc.dropWrongType": "Unsupported file type. Allowed: PDF, PNG, JPG, JPEG, TIF, TIFF.",
  "doc.dropOneFile": "One document slot takes one file — used the first.",
  "doc.verify": "Verify",
  "doc.unverify": "Unverify",
  "doc.verified": "Verified",
  "doc.removeTitle": "Remove file (un-verifies the document)",
  "doc.removeAria": "Remove file",
  "doc.addCopyTitle": "Add another copy (e.g. another shipment or truck)",
  "doc.addCopyAria": "Add another copy",
  "doc.deleteRowTitle": "Delete this document row",
  "doc.deleteRowAria": "Delete document row",
  "doc.addPlaceholder": "Add another document (e.g. Insurance Certificate)…",
  "doc.add": "Add",
  "case.markComplete": "Mark complete",
  "case.mustVerifyAll": "All documents must be verified before the case can be marked complete.",
  "case.markSent": "Mark sent to bank",
  "case.reopen": "Reopen",
  "case.submitted": "Submitted to {bank}. Case archived.",
  "case.backToComplete": "Back to complete",


  // Export PDF
  "export.button": "Export PDF",
  "export.title": "Combined PDF export",
  "export.subtitle": "Merge the attached documents into a single PDF for the bank.",
  "export.selectAll": "Select all",
  "export.selectNone": "Select none",
  "export.includeCover": "Include cover page",
  "export.notAttached": "not attached",
  "export.warning": "This case isn't complete — some documents are missing. You can still export what's attached.",
  "export.generate": "Generate PDF",
  "export.generating": "Generating…",
  "export.none": "No documents are attached yet.",
  "export.success": "PDF generated",
  "export.successSkipped": "PDF generated. {n} item(s) couldn't be included.",
  "export.failed": "Could not generate PDF",

  // Delete confirm
  "delete.title": "Delete case",
  "delete.body": "This will permanently remove case {ref}, all of its documents, and every attached file. This action cannot be undone.",
  "delete.cancel": "Cancel",
  "delete.confirm": "Delete case",
  "delete.deleting": "Deleting…",

  // Dialogs
  "dialog.newCase": "New case",
  "dialog.editCase": "Edit case",
  "dialog.autoCreateNote": "A reference and the standard documents are created automatically.",
  "field.company": "Company",
  "field.supplier": "Supplier",
  "field.vessel": "Vessel",
  "field.blNumber": "B/L number",
  "field.eta": "ETA",
  "field.bank": "Bank",
  "field.amount": "Amount",
  "field.currency": "Currency",
  "field.notes": "Notes",
  "field.optional": "(optional)",
  "field.bankOther": "Other…",
  "field.bankNamePlaceholder": "Bank name",
  "dialog.cancel": "Cancel",
  "dialog.create": "Create case",
  "dialog.creating": "Creating…",
  "dialog.save": "Save changes",
  "dialog.saving": "Saving…",
  "dialog.close": "Close",

  // Auth
  "auth.signInTitle": "Sign in",
  "auth.signUpTitle": "Create account",
  "auth.recoveryTitle": "Reset password",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.signIn": "Sign in",
  "auth.signUp": "Sign up",
  "auth.sendReset": "Send reset link",
  "auth.pleaseWait": "Please wait…",
  "auth.forgot": "Forgot password?",
  "auth.backToSignIn": "Back to sign in",
  "auth.alreadyRegistered": "Already registered? Sign in",
  "auth.noAccount": "No account yet? Create one",

  // Reset password
  "reset.title": "Set new password",
  "reset.newPassword": "New password",
  "reset.confirmPassword": "Confirm new password",
  "reset.update": "Update password",
  "reset.invalid": "The reset link is invalid or has expired. Request a new one from the sign-in page.",

  // Not found / error
  "nf.title": "Page not found",
  "nf.body": "The page you're looking for doesn't exist or has been moved.",
  "nf.home": "Go home",
  "err.title": "This page didn't load",
  "err.body": "Something went wrong on our end. You can try refreshing or head back home.",
  "err.retry": "Try again",
  "err.home": "Go home",

  // Toasts
  "toast.caseOpened": "Case {ref} opened",
  "toast.caseUpdated": "Case {ref} updated",
  "toast.caseDeleted": "Case deleted",
  "toast.updateFailed": "Update failed",
  "toast.deleteFailed": "Delete failed",
  "toast.uploadFailed": "Upload failed",
  "toast.removeFailed": "Remove failed",
  "toast.addCopyFailed": "Could not add copy",
  "toast.addDocFailed": "Could not add document",
  "toast.createFailed": "Could not create case",
  "toast.updateCaseFailed": "Could not update case",
  "toast.authFailed": "Authentication failed",
  "toast.accountCreated": "Account created. Check your email to confirm, then sign in.",
  "toast.resetSent": "Password reset link sent. Check your email.",
  "toast.resetInvalid": "This password reset link is invalid or expired.",
  "toast.pwMismatch": "Passwords do not match.",
  "toast.pwUpdated": "Password updated. Please sign in with your new password.",
  "toast.pwUpdateFailed": "Could not update password",
};

const ar: Dict = {
  "app.tagline": "التحكم بمستندات الحوالات",

  "lang.toggle": "EN",
  "lang.label": "اللغة",

  "nav.dashboard": "لوحة المعلومات",
  "nav.cases": "المعاملات",
  "nav.signOut": "تسجيل الخروج",

  // Dashboard
  "dashboard.title": "لوحة المعلومات",
  "dashboard.subtitle": "حالة المستندات لجميع الحوالات.",
  "stat.inProgress": "قيد الإنجاز",
  "stat.complete": "مكتمل",
  "stat.sentToBank": "مُرسل إلى المصرف",
  "stat.totalCases": "إجمالي المعاملات",
  "needsDocs.title": "بحاجة إلى مستندات",
  "needsDocs.subtitle": "المعاملات قيد الإنجاز، الأقرب للاكتمال أولاً.",
  "needsDocs.empty": "لا توجد معاملات مفتوحة. كل شيء مكتمل أو مُرسل إلى المصرف.",
  "common.loading": "جارٍ التحميل…",
  "dashboard.daysOpen": "مفتوحة منذ {n} يوم",

  // Cases list
  "cases.title": "المعاملات",
  "cases.subtitle": "معاملة واحدة لكل حوالة برقية.",
  "cases.new": "معاملة جديدة",
  "cases.searchPlaceholder": "ابحث بالشركة أو المورّد أو الباخرة أو المصرف أو الرقم المرجعي أو المبلغ…",
  "filter.all": "الكل",
  "filter.in_progress": "قيد الإنجاز",
  "filter.complete": "مكتمل",
  "filter.sent": "مُرسل إلى المصرف",
  "col.reference": "الرقم المرجعي",
  "col.company": "الشركة",
  "col.bank": "المصرف",
  "col.amount": "المبلغ",
  "col.progress": "التقدّم",
  "col.status": "الحالة",
  "cases.noMatch": "لا توجد معاملات مطابقة.",

  // Status badges
  "status.in_progress": "قيد الإنجاز",
  "status.complete": "مكتمل",
  "status.sent": "مُرسل إلى المصرف",

  // Case detail
  "case.backAll": "كل المعاملات",
  "case.edit": "تعديل",
  "case.delete": "حذف المعاملة",
  "case.opened": "تاريخ الفتح",
  "case.daysAgo": "منذ {n} يوم",
  "case.loading": "جارٍ تحميل المعاملة…",
  "case.notFound": "المعاملة غير موجودة.",
  "manifest.title": "بيان المستندات",
  "manifest.verifiedCount": "{v}/{t} مُدقّق",
  "doc.notAttached": "غير مُرفق",
  "doc.view": "عرض",
  "doc.badge.copy": "نسخة",
  "doc.badge.extra": "إضافي",
  "doc.attach": "إرفاق",
  "doc.uploading": "جارٍ الرفع…",
  "doc.dropHere": "أفلت الملف هنا",
  "doc.dropWrongType": "نوع الملف غير مدعوم. المسموح: PDF، PNG، JPG، JPEG، TIF، TIFF.",
  "doc.dropOneFile": "كل خانة مستند تقبل ملفًا واحدًا — تم استخدام الأول.",
  "doc.verify": "تدقيق",
  "doc.unverify": "إلغاء التدقيق",
  "doc.verified": "مُدقّق",
  "doc.removeTitle": "إزالة الملف (يلغي تدقيق المستند)",
  "doc.removeAria": "إزالة الملف",
  "doc.addCopyTitle": "إضافة نسخة أخرى (مثل شحنة أو شاحنة أخرى)",
  "doc.addCopyAria": "إضافة نسخة أخرى",
  "doc.deleteRowTitle": "حذف صف المستند هذا",
  "doc.deleteRowAria": "حذف صف المستند",
  "doc.addPlaceholder": "إضافة مستند آخر (مثل شهادة تأمين)…",
  "doc.add": "إضافة",
  "case.markComplete": "تحديد كمكتمل",
  "case.mustVerifyAll": "يجب تدقيق جميع المستندات قبل تحديد المعاملة كمكتملة.",
  "case.markSent": "تحديد كمُرسل إلى المصرف",
  "case.reopen": "إعادة فتح",
  "case.submitted": "أُرسلت إلى {bank}. تم أرشفة المعاملة.",
  "case.backToComplete": "الرجوع إلى مكتمل",


  // Export PDF
  "export.button": "تصدير PDF",
  "export.title": "تصدير PDF مُجمّع",
  "export.subtitle": "دمج المستندات المرفقة في ملف PDF واحد لإرساله إلى المصرف.",
  "export.selectAll": "تحديد الكل",
  "export.selectNone": "إلغاء التحديد",
  "export.includeCover": "تضمين صفحة الغلاف",
  "export.notAttached": "غير مُرفق",
  "export.warning": "هذه المعاملة غير مكتملة — بعض المستندات مفقودة. لا يزال بإمكانك تصدير المُرفق منها.",
  "export.generate": "إنشاء PDF",
  "export.generating": "جارٍ الإنشاء…",
  "export.none": "لا توجد مستندات مرفقة بعد.",
  "export.success": "تم إنشاء ملف PDF",
  "export.successSkipped": "تم إنشاء ملف PDF. تعذّر تضمين {n} عنصر.",
  "export.failed": "تعذّر إنشاء ملف PDF",

  // Delete confirm
  "delete.title": "حذف المعاملة",
  "delete.body": "سيؤدي هذا إلى حذف المعاملة {ref} وجميع مستنداتها وكل ملف مرفق نهائياً. لا يمكن التراجع عن هذا الإجراء.",
  "delete.cancel": "إلغاء",
  "delete.confirm": "حذف المعاملة",
  "delete.deleting": "جارٍ الحذف…",

  // Dialogs
  "dialog.newCase": "معاملة جديدة",
  "dialog.editCase": "تعديل المعاملة",
  "dialog.autoCreateNote": "يتم إنشاء رقم مرجعي والمستندات القياسية تلقائياً.",
  "field.company": "الشركة",
  "field.supplier": "المورّد",
  "field.vessel": "الباخرة",
  "field.blNumber": "رقم بوليصة الشحن",
  "field.eta": "الوصول المتوقع",
  "field.bank": "المصرف",
  "field.amount": "المبلغ",
  "field.currency": "العملة",
  "field.notes": "ملاحظات",
  "field.optional": "(اختياري)",
  "field.bankOther": "أخرى…",
  "field.bankNamePlaceholder": "اسم المصرف",
  "dialog.cancel": "إلغاء",
  "dialog.create": "إنشاء المعاملة",
  "dialog.creating": "جارٍ الإنشاء…",
  "dialog.save": "حفظ التغييرات",
  "dialog.saving": "جارٍ الحفظ…",
  "dialog.close": "إغلاق",

  // Auth
  "auth.signInTitle": "تسجيل الدخول",
  "auth.signUpTitle": "إنشاء حساب",
  "auth.recoveryTitle": "إعادة تعيين كلمة المرور",
  "auth.email": "البريد الإلكتروني",
  "auth.password": "كلمة المرور",
  "auth.signIn": "تسجيل الدخول",
  "auth.signUp": "إنشاء حساب",
  "auth.sendReset": "إرسال رابط إعادة التعيين",
  "auth.pleaseWait": "يرجى الانتظار…",
  "auth.forgot": "نسيت كلمة المرور؟",
  "auth.backToSignIn": "العودة لتسجيل الدخول",
  "auth.alreadyRegistered": "لديك حساب؟ سجّل الدخول",
  "auth.noAccount": "ليس لديك حساب؟ أنشئ واحداً",

  // Reset password
  "reset.title": "تعيين كلمة مرور جديدة",
  "reset.newPassword": "كلمة المرور الجديدة",
  "reset.confirmPassword": "تأكيد كلمة المرور الجديدة",
  "reset.update": "تحديث كلمة المرور",
  "reset.invalid": "رابط إعادة التعيين غير صالح أو منتهي الصلاحية. اطلب رابطاً جديداً من صفحة تسجيل الدخول.",

  // Not found / error
  "nf.title": "الصفحة غير موجودة",
  "nf.body": "الصفحة التي تبحث عنها غير موجودة أو تم نقلها.",
  "nf.home": "الصفحة الرئيسية",
  "err.title": "تعذّر تحميل هذه الصفحة",
  "err.body": "حدث خطأ ما لدينا. يمكنك المحاولة بالتحديث أو العودة إلى الصفحة الرئيسية.",
  "err.retry": "حاول مرة أخرى",
  "err.home": "الصفحة الرئيسية",

  // Toasts
  "toast.caseOpened": "تم فتح المعاملة {ref}",
  "toast.caseUpdated": "تم تحديث المعاملة {ref}",
  "toast.caseDeleted": "تم حذف المعاملة",
  "toast.updateFailed": "فشل التحديث",
  "toast.deleteFailed": "فشل الحذف",
  "toast.uploadFailed": "فشل الرفع",
  "toast.removeFailed": "فشلت الإزالة",
  "toast.addCopyFailed": "تعذّر إضافة نسخة",
  "toast.addDocFailed": "تعذّر إضافة المستند",
  "toast.createFailed": "تعذّر إنشاء المعاملة",
  "toast.updateCaseFailed": "تعذّر تحديث المعاملة",
  "toast.authFailed": "فشل المصادقة",
  "toast.accountCreated": "تم إنشاء الحساب. تحقق من بريدك للتأكيد ثم سجّل الدخول.",
  "toast.resetSent": "تم إرسال رابط إعادة تعيين كلمة المرور. تحقق من بريدك.",
  "toast.resetInvalid": "رابط إعادة تعيين كلمة المرور غير صالح أو منتهي الصلاحية.",
  "toast.pwMismatch": "كلمتا المرور غير متطابقتين.",
  "toast.pwUpdated": "تم تحديث كلمة المرور. يرجى تسجيل الدخول بكلمة المرور الجديدة.",
  "toast.pwUpdateFailed": "تعذّر تحديث كلمة المرور",
};

const DICTS: Record<Lang, Dict> = { en, ar };

export type TFn = (key: string, vars?: Record<string, string | number>) => string;

interface I18nValue {
  lang: Lang;
  dir: "ltr" | "rtl";
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: TFn;
  docLabel: (docType: string) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Start with "en" on server + first client render to avoid hydration
  // mismatch, then adopt the saved preference after mount.
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "ar" || saved === "en") setLangState(saved);
  }, []);

  const dir: "ltr" | "rtl" = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("lang", lang);
    el.setAttribute("dir", dir);
  }, [lang, dir]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setLangState((prev) => {
      const next: Lang = prev === "ar" ? "en" : "ar";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const t = useCallback<TFn>(
    (key, vars) => {
      const dict = DICTS[lang];
      const str = dict[key] ?? DICTS.en[key] ?? key;
      return interpolate(str, vars);
    },
    [lang],
  );

  const value = useMemo<I18nValue>(
    () => ({ lang, dir, setLang, toggle, t, docLabel: (d: string) => docLabel(d, lang) }),
    [lang, dir, setLang, toggle, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
