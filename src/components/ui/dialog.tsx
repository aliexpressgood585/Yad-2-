"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    hideClose?: boolean;
  }
>(({ className, children, hideClose, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed start-1/2 top-1/2 z-50 w-full max-w-lg -translate-y-1/2 translate-x-1/2",
        "max-h-[92dvh] overflow-y-auto border border-border bg-background p-5 sm:rounded-lg",
        "duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className,
      )}
      {...props}
    >
      {children}
      {hideClose ? null : (
        <DialogPrimitive.Close
          className={cn(
            "absolute end-4 top-4 rounded-sm p-1 opacity-70 transition-opacity",
            "hover:bg-muted hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:pointer-events-none",
          )}
        >
          <X className="size-4" aria-hidden />
          <span className="sr-only">סגירה</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

/**
 * מגירה צדדית / תחתונה. ממומשת מעל Dialog כדי לשמור על מלכודת פוקוס נכונה.
 * ב-RTL הצד ההתחלתי (`start`) הוא ימין.
 */
const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    side?: "start" | "end" | "bottom";
  }
>(({ className, children, side = "end", ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 flex flex-col gap-4 border-border bg-background",
        "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
        side === "bottom" &&
          "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl border-t p-5 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        side === "start" &&
          "inset-y-0 start-0 h-full w-11/12 max-w-sm border-e p-5 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
        side === "end" &&
          "inset-y-0 end-0 h-full w-11/12 max-w-sm border-s p-5 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className={cn(
          "absolute end-4 top-4 rounded-sm p-1 opacity-70 transition-opacity",
          "hover:bg-muted hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <X className="size-4" aria-hidden />
        <span className="sr-only">סגירה</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
SheetContent.displayName = "SheetContent";

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 pe-8 text-start", className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-start", className)}
      {...props}
    />
  );
}

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("font-heading text-lg font-bold leading-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  SheetContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
