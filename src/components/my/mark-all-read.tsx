"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

export function MarkAllRead() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      loading={pending}
      onClick={async () => {
        setPending(true);
        try {
          await fetch("/api/notifications", { method: "PATCH" });
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      <CheckCheck aria-hidden />
      סימון הכול כנקרא
    </Button>
  );
}
