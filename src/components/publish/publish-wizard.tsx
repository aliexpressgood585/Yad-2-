"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { StepCategory } from "@/components/publish/step-category";
import { StepDetails } from "@/components/publish/step-details";
import { StepImages, type DraftImage } from "@/components/publish/step-images";
import { StepPreview } from "@/components/publish/step-preview";
import { VerifyPhoneGate } from "@/components/publish/verify-phone-gate";
import type { CategoryNode, ResolvedAttribute } from "@/lib/categories";
import { cn } from "@/lib/utils";

export type PublishFormState = {
  id?: string;
  status?: string;
  categoryId: string;
  title: string;
  description: string;
  price: number | null;
  isNegotiable: boolean;
  city: string;
  neighborhood: string;
  address: string;
  contactPhone: string;
  contactName: string;
  allowChat: boolean;
  images: DraftImage[];
  attributes: Record<string, string | number | boolean | string[]>;
};

const STEPS = ["קטגוריה", "פרטי המודעה", "תמונות", "תצוגה מקדימה"] as const;

const DRAFT_KEY = "kedai-publish-draft";
const AUTOSAVE_MS = 1500;

function emptyState(defaults: { phone: string; name: string }): PublishFormState {
  return {
    categoryId: "",
    title: "",
    description: "",
    price: null,
    isNegotiable: false,
    city: "",
    neighborhood: "",
    address: "",
    contactPhone: defaults.phone,
    contactName: defaults.name,
    allowChat: true,
    images: [],
    attributes: {},
  };
}

export function PublishWizard({
  tree,
  phoneVerified,
  defaultPhone,
  defaultName,
  initial,
}: {
  tree: CategoryNode[];
  phoneVerified: boolean;
  defaultPhone: string;
  defaultName: string;
  initial?: PublishFormState;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const [step, setStep] = React.useState(isEdit ? 1 : 0);
  const [form, setForm] = React.useState<PublishFormState>(
    initial ?? emptyState({ phone: defaultPhone, name: defaultName }),
  );
  const [attributes, setAttributes] = React.useState<ResolvedAttribute[]>([]);
  const [loadingAttrs, setLoadingAttrs] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const [verified, setVerified] = React.useState(phoneVerified);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const update = React.useCallback((patch: Partial<PublishFormState>) => {
    setForm((f) => ({ ...f, ...patch }));
  }, []);

  // שחזור טיוטה מקומית (רק במודעה חדשה)
  React.useEffect(() => {
    if (isEdit) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as PublishFormState & { savedAt?: string };
      if (saved.title || saved.categoryId) {
        setForm((f) => ({ ...f, ...saved }));
        toast.info("שחזרנו את הטיוטה האחרונה שלך", {
          action: {
            label: "התחלה מחדש",
            onClick: () => {
              localStorage.removeItem(DRAFT_KEY);
              setForm(emptyState({ phone: defaultPhone, name: defaultName }));
              setStep(0);
            },
          },
        });
      }
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [isEdit, defaultPhone, defaultName]);

  // שמירה אוטומטית של הטיוטה בדפדפן
  React.useEffect(() => {
    if (isEdit) return;
    const timer = setTimeout(() => {
      if (!form.title && !form.categoryId) return;
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      setSavedAt(new Date());
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [form, isEdit]);

  // טעינת השדות הדינמיים של הקטגוריה שנבחרה
  React.useEffect(() => {
    if (!form.categoryId) {
      setAttributes([]);
      return;
    }
    let cancelled = false;
    setLoadingAttrs(true);
    (async () => {
      try {
        const res = await fetch(`/api/categories/${form.categoryId}/attributes`);
        if (!res.ok) return;
        const data = (await res.json()) as { attributes: ResolvedAttribute[] };
        if (!cancelled) setAttributes(data.attributes);
      } finally {
        if (!cancelled) setLoadingAttrs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.categoryId]);

  function validateStep(index: number): boolean {
    const next: Record<string, string> = {};

    if (index === 0 && !form.categoryId) {
      next.categoryId = "יש לבחור קטגוריה";
    }

    if (index === 1) {
      if (form.title.trim().length < 6) next.title = "הכותרת חייבת להכיל לפחות 6 תווים";
      if (form.description.trim().length < 20)
        next.description = "התיאור חייב להכיל לפחות 20 תווים";
      if (!form.city) next.city = "יש לבחור עיר";
      for (const attr of attributes) {
        if (!attr.isRequired) continue;
        const v = form.attributes[attr.key];
        const empty =
          v === undefined || v === "" || v === null || (Array.isArray(v) && !v.length);
        if (empty) next[`attr:${attr.key}`] = `${attr.label} — שדה חובה`;
      }
    }

    if (index === 2 && form.images.length === 0) {
      next.images = "יש להוסיף לפחות תמונה אחת";
    }

    setErrors(next);
    if (Object.keys(next).length) {
      toast.error(Object.values(next)[0]);
      return false;
    }
    return true;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setStep((s) => Math.max(0, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(mode: "draft" | "publish") {
    if (mode === "publish") {
      for (let i = 0; i <= 2; i++) {
        if (!validateStep(i)) {
          setStep(i);
          return;
        }
      }
      if (!verified) {
        toast.error("יש לאמת מספר טלפון לפני הפרסום");
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          listingId: form.id,
          data: {
            categoryId: form.categoryId,
            title: form.title,
            description: form.description,
            price: form.price,
            isNegotiable: form.isNegotiable,
            city: form.city,
            neighborhood: form.neighborhood,
            address: form.address,
            contactPhone: form.contactPhone || undefined,
            contactName: form.contactName,
            allowChat: form.allowChat,
            images: form.images.map((i) => ({
              url: i.url,
              thumbUrl: i.thumbUrl,
              blurhash: i.blurhash,
              width: i.width,
              height: i.height,
              phash: i.phash,
            })),
            attributes: form.attributes,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.code === "PHONE_VERIFICATION_REQUIRED") {
          setVerified(false);
          toast.error("יש לאמת מספר טלפון לפני הפרסום");
          return;
        }
        toast.error(data.error ?? "השמירה נכשלה");
        return;
      }

      localStorage.removeItem(DRAFT_KEY);

      if (mode === "publish") {
        toast.success("המודעה פורסמה בהצלחה!");
        router.push(`/item/${data.slug}`);
      } else {
        toast.success("הטיוטה נשמרה");
        update({ id: data.id });
        router.push("/my?tab=drafts");
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container max-w-3xl py-6">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-extrabold sm:text-3xl">
          {isEdit ? "עריכת מודעה" : "פרסום מודעה חדשה"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEdit
            ? "השינויים ייכנסו לתוקף מיד לאחר השמירה."
            : "ארבעה שלבים קצרים. הפרסום חינם לחלוטין."}
        </p>
      </header>

      <Stepper current={step} onSelect={(i) => i < step && setStep(i)} />

      {!verified ? (
        <VerifyPhoneGate
          defaultPhone={form.contactPhone || defaultPhone}
          onVerified={(phone) => {
            setVerified(true);
            update({ contactPhone: phone });
          }}
        />
      ) : null}

      <div className="mt-6">
        {step === 0 ? (
          <StepCategory
            tree={tree}
            value={form.categoryId}
            error={errors.categoryId}
            onChange={(categoryId) => {
              // החלפת קטגוריה מאפסת שדות דינמיים שלא רלוונטיים עוד
              update({ categoryId, attributes: {} });
              setStep(1);
            }}
          />
        ) : null}

        {step === 1 ? (
          <StepDetails
            form={form}
            attributes={attributes}
            loadingAttributes={loadingAttrs}
            errors={errors}
            onChange={update}
          />
        ) : null}

        {step === 2 ? (
          <StepImages
            images={form.images}
            error={errors.images}
            onChange={(images) => update({ images })}
          />
        ) : null}

        {step === 3 ? (
          <StepPreview form={form} attributes={attributes} tree={tree} />
        ) : null}
      </div>

      <div className="sticky bottom-0 z-10 mt-8 flex items-center gap-2 border-t border-border bg-background/95 py-4 backdrop-blur">
        {step > 0 ? (
          <Button variant="outline" onClick={goBack} disabled={submitting}>
            <ChevronRight aria-hidden />
            הקודם
          </Button>
        ) : null}

        <span className="ms-auto flex items-center gap-2 text-xs text-muted-foreground">
          {savedAt ? (
            <>
              <Save className="size-3.5" aria-hidden />
              נשמר אוטומטית
            </>
          ) : null}
        </span>

        {step < STEPS.length - 1 ? (
          <Button onClick={goNext} disabled={submitting}>
            הבא
            <ChevronLeft aria-hidden />
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => void save("draft")}
              disabled={submitting}
            >
              שמירה כטיוטה
            </Button>
            <Button onClick={() => void save("publish")} loading={submitting}>
              {submitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {isEdit ? "שמירת השינויים" : "פרסום המודעה"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stepper({
  current,
  onSelect,
}: {
  current: number;
  onSelect: (index: number) => void;
}) {
  return (
    <ol className="flex items-center gap-1" aria-label="שלבי הפרסום">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-1">
            <button
              type="button"
              onClick={() => onSelect(i)}
              disabled={i >= current}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm transition-colors",
                done && "text-primary hover:bg-muted",
                active && "font-semibold",
                !done && !active && "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-bold",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary text-primary",
                  !done && !active && "border-border",
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span className="hidden truncate sm:inline">{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
