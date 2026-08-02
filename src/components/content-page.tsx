import type { ReactNode } from "react";

/** פריסה אחידה לעמודי תוכן סטטיים (עזרה, תנאים, פרטיות וכו'). */
export function ContentPage({
  title,
  intro,
  updatedAt,
  children,
}: {
  title: string;
  intro?: string;
  updatedAt?: string;
  children: ReactNode;
}) {
  return (
    <div className="container max-w-3xl py-8">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-extrabold">{title}</h1>
        {intro ? <p className="mt-2 text-pretty text-muted-foreground">{intro}</p> : null}
        {updatedAt ? (
          <p className="mt-1 text-xs text-muted-foreground">עודכן לאחרונה: {updatedAt}</p>
        ) : null}
      </header>

      <div
        className="space-y-6 leading-relaxed
          [&_h2]:mt-8 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-bold
          [&_h3]:mt-5 [&_h3]:font-heading [&_h3]:text-base [&_h3]:font-bold
          [&_li]:leading-relaxed
          [&_p]:text-pretty [&_p]:text-muted-foreground
          [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:ps-5 [&_ul]:text-muted-foreground
          [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:ps-5 [&_ol]:text-muted-foreground
          [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2"
      >
        {children}
      </div>
    </div>
  );
}
