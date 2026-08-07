"use client";

import * as React from "react";

/**
 * קריסה בפריסה עצמה.
 *
 * `error.tsx` יושב **בתוך** ה-layout, ולכן כשה-layout הוא זה שנשבר
 * הוא לא נטען כלל. הקובץ הזה מחליף את כל המסמך, כולל `<html>` —
 * וזו הסיבה שהוא לא יכול להשתמש בשום רכיב, בשום טוקן ובשום גופן
 * של הפרויקט: אף אחד מהם לא נטען בשלב הזה.
 *
 * הכול inline, בערכים קפואים שזהים לטוקנים של החוגה הבהירה. זה
 * המקום היחיד בפרויקט שבו כפילות ערכי צבע היא הבחירה הנכונה.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
    void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error));
  }, [error]);

  return (
    <html lang="he" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#E6E2D6",
          color: "#16181B",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
          padding: 24,
        }}
      >
        <main style={{ maxWidth: 420, textAlign: "center" }}>
          {/* הסימן, מצויר ידנית — אין גישה לרכיבים בשלב הזה */}
          <svg
            viewBox="0 0 28 20"
            width="112"
            height="80"
            aria-hidden
            style={{ background: "#17191C", padding: 12, display: "block", margin: "0 auto 20px" }}
          >
            {[2, 8, 14, 20, 26].map((x) => (
              <line key={x} x1={x} x2={x} y1={7} y2={17} stroke="#3C4148" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            ))}
            <g transform="rotate(-14 1 17)" opacity={0.45}>
              <line x1={1} x2={1} y1={3} y2={17} stroke="#FFAE00" strokeWidth={3} vectorEffect="non-scaling-stroke" />
            </g>
          </svg>

          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>
            האתר לא נטען
          </h1>
          <p style={{ margin: "0 0 20px", color: "#5F5C54", lineHeight: 1.6 }}>
            לא עשית שום דבר לא בסדר. התקלה נרשמה אצלנו.
          </p>

          <button
            onClick={reset}
            style={{
              background: "#16181B",
              color: "#E6E2D6",
              border: 0,
              padding: "10px 20px",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            לנסות שוב
          </button>

          {error.digest ? (
            <p style={{ marginTop: 20, fontSize: 12, color: "#5F5C54", direction: "ltr" }}>
              {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
