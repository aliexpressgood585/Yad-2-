# לוח

לוח מודעות ישראלי מלא — עברית, RTL, פרודקשן-רדי.
רכב, נדל&quot;ן, יד שנייה, דרושים, בעלי חיים, עסקים ובעלי מקצוע.

> **הבהרה:** "לוח" הוא מותג עצמאי שנבנה לצורך הפרויקט. אין באתר שימוש בשמות,
> בלוגו, בצבעים או בטקסטים של אף לוח מודעות קיים.

---

## מה יש כאן

| תחום | מה מומש |
| --- | --- |
| חיפוש | Postgres FTS + `pg_trgm` לתיקון שגיאות כתיב בעברית, מילים נרדפות עברית↔אנגלית, דירוג רלוונטיות משוקלל |
| פילטרים | מערכת שדות דינמית לכל קטגוריה (49 קטגוריות, 103 שדות, 444 ערכים), כולל שדות תלויים (יצרן ← דגם) |
| מודעה | גלריה עם lightbox וזום, חשיפת טלפון מוגבלת בקצב, WhatsApp, מפה עם מיקום מקורב, היסטוריית מחירים, מודעות דומות |
| פרסום | אשף 4 שלבים, גרירת תמונות, דחיסה בלקוח, הסרת EXIF בשרת, טיוטות, זיהוי כפילויות, הצעת מחיר לפי חציון |
| אמון ובטיחות | ציון אמינות מוכר, מנוע זיהוי הונאות, דיווחים, תור מודרציה, יומן פעולות |
| אזור אישי | ניהול מודעות, סטטיסטיקות עם גרף, מועדפים, חיפושים שמורים, צ'אט, התראות |
| ניהול | לוח בקרה, מודרציה, ניהול מודעות ומשתמשים, יומן פעולות |
| נוסף | מפה עם clustering, השוואת עד 4 מודעות, PWA עם offline, מצב לילה, נגישות AA |

---

## הרצה מקומית

```bash
# 1. תלויות
npm install

# 2. משתני סביבה
cp .env.example .env
#    לפחות DATABASE_URL, DIRECT_URL ו-AUTH_SECRET
#    יצירת מפתח: openssl rand -base64 32

# 3. בסיס הנתונים (מיגרציות + נתוני דמו)
npm run db:deploy
npm run db:seed

# 4. הרצה
npm run dev
```

האתר יעלה בכתובת <http://localhost:3000>.

### משתמשי דמו

| תפקיד | אימייל | סיסמה |
| --- | --- | --- |
| מנהל | `admin@luach.co.il` | `Password123!` |
| משתמש | `demo@luach.co.il` | `Password123!` |

בסביבת פיתוח אין ספק SMS מוגדר, ולכן קוד ה-OTP מוצג בהודעת toast ונכתב ללוג
השרת — אפשר להתחבר ולאמת טלפון בלי הגדרות נוספות.

---

## Stack

- **Next.js 15** (App Router, RSC, streaming) + **TypeScript strict**
- **Tailwind CSS** + רכיבי **Radix UI** בסגנון shadcn/ui, RTL מלא
- **Prisma** + **PostgreSQL** (`pg_trgm`, FTS, אינדקסים חלקיים)
- **Auth.js v5** — OTP ב-SMS, אימייל+סיסמה, Google
- **Zod** + React Hook Form, **Zustand**, **TanStack Query**
- **MaplibreGL** עם אריחי CARTO/OSM חינמיים (ללא מפתח API)
- **sharp** לעיבוד תמונות, **blurhash** ל-placeholders
- **Resend** למיילים, **web-push** להתראות, **Upstash Redis** ל-rate limiting

כל שירות חיצוני הוא אופציונלי: ללא מפתחות, המערכת נופלת חזרה למימוש מקומי
(אחסון תמונות בדיסק, מיילים ללוג, rate limiting בזיכרון, OTP מוצג במסך).

---

## פקודות

```bash
npm run dev          # פיתוח
npm run build        # בנייה לפרודקשן (כולל prisma generate)
npm start            # הרצת גרסת פרודקשן
npm run typecheck    # בדיקת טיפוסים בלבד
npm run lint         # ESLint

npm run e2e          # בדיקת קבלה מקצה לקצה מול שרת חי

npm run db:migrate   # יצירת מיגרציה חדשה בפיתוח
npm run db:deploy    # החלת מיגרציות (פרודקשן)
npm run db:seed      # זריעת נתוני דמו
npm run db:reset     # איפוס מלא + זריעה
```

---

## בדיקת קבלה

`npm run e2e` מריץ 27 בדיקות מול שרת פרודקשן חי ומכסה את המסלול המלא:
הרשמה → אימות OTP → פרסום מודעה עם שדות דינמיים ותמונה → מציאתה בחיפוש
חופשי ובפילטרים → שמירה במועדפים → פנייה למוכר ותגובה → חשיפת טלפון →
דיווח → טיפול בפאנל הניהול → ובקרת הרשאות.

```bash
npm run build && npm start &
E2E_CATEGORY_ID=<id של קטגוריית private-cars> \
E2E_SERVER_LOG=<נתיב ללוג השרת> \
npm run e2e http://localhost:3000
```

`E2E_SERVER_LOG` נדרש כי בפרודקשן קוד ה-OTP אינו מוחזר בתגובה (בכוונה) —
הבדיקה קוראת אותו מלוג השרת, כפי שמפעיל המערכת היה עושה.

---

## מבנה הפרויקט

```
prisma/
  schema.prisma          מודל הנתונים
  migrations/            כולל מיגרציה ייעודית לאינדקסי FTS ו-trigram
  seed.ts                זריעה: קטגוריות, שדות דינמיים, 300 מודעות, 30 משתמשים
  seed/                  הגדרת עץ הקטגוריות ומחוללי תוכן בעברית

src/
  app/
    [category]/          דף קטגוריה + תת-קטגוריה (ISR)
    item/[slug]/         דף מודעה + OG image דינמי
    publish/             אשף פרסום ועריכה
    my/                  אזור אישי (מוגן)
    admin/               פאנל ניהול (ADMIN בלבד)
    api/                 כל ה-route handlers
  components/            רכיבי UI ותצוגה
  lib/                   לוגיקת ליבה: חיפוש, פילטרים, הונאות, אמון, העלאות
  stores/                מצב לקוח (מועדפים, השוואה, נצפו לאחרונה)
  middleware.ts          הגנת נתיבים
```

### קבצי הליבה

| קובץ | תפקיד |
| --- | --- |
| `lib/listings.ts` | מנוע החיפוש — בניית SQL, דירוג, פאסטים, מרחק |
| `lib/filters.ts` | תרגום בין פרמטרי URL לשאילתת חיפוש |
| `lib/categories.ts` | עץ הקטגוריות וירושת שדות דינמיים |
| `lib/fraud.ts` | יוריסטיקות זיהוי הונאה |
| `lib/trust.ts` | ציון אמינות מוכר |
| `lib/upload.ts` | עיבוד תמונות: הסרת EXIF, דחיסה, blurhash, dHash |

---

## החלטות ארכיטקטורה

התיעוד המלא נמצא ב-[`DECISIONS.md`](./DECISIONS.md). בקצרה:

- **חיפוש ב-Postgres ולא בשירות חיצוני** — `to_tsquery` עם סמנטיקת OR והתאמת
  תחילית, בשילוב `word_similarity` של `pg_trgm`. שאילתה מרובת מילים בעברית
  לא מחזירה אפס תוצאות כשמילה אחת חסרה, ושגיאות כתיב עדיין נתפסות.
- **שדות דינמיים בטבלה נפרדת** — `Attribute` / `AttributeValue` /
  `ListingAttribute`, עם ירושה מקטגוריית האב. הוספת קטגוריה חדשה עם שדות
  משלה אינה דורשת שינוי סכמה.
- **פרטיות מיקום** — נשמר מיקום מדויק לצד `displayLat/displayLng` מוסטים
  דטרמיניסטית בכ-500 מ'. רק המיקום המוסט נחשף החוצה.
- **Suspense בתוך הדף ולא ב-`loading.tsx`** בדפי קטגוריה — כדי שכתובת של
  קטגוריה לא קיימת תחזיר 404 אמיתי ולא soft-404 עם סטטוס 200.

---

## פריסה ל-Vercel + Neon

### 1. בסיס נתונים (Neon)

צרו פרויקט ב-[Neon](https://neon.tech) והעתיקו שני חיבורים:

- `DATABASE_URL` — מחרוזת ה-**pooled** (מכילה `-pooler`), לשימוש האפליקציה.
- `DIRECT_URL` — החיבור הישיר, נדרש להרצת מיגרציות.

הסכמה יוצרת בעצמה את `pg_trgm` ואת `unaccent` דרך המיגרציה, כך שאין צורך
בהגדרה ידנית.

> עובד באותה מידה עם Supabase או כל Postgres 14+. ב-Supabase השתמשו ב-
> connection pooler עבור `DATABASE_URL` ובחיבור הישיר עבור `DIRECT_URL`.

### 2. פריסה

```bash
npm i -g vercel
vercel link
vercel env add DATABASE_URL production
vercel env add DIRECT_URL production
vercel env add AUTH_SECRET production      # openssl rand -base64 32
vercel env add NEXT_PUBLIC_SITE_URL production
vercel --prod
```

### 3. מיגרציות וזריעה בפרודקשן

```bash
DATABASE_URL="$DIRECT_URL" npx prisma migrate deploy
# אופציונלי, רק לסביבת הדגמה:
DATABASE_URL="$DIRECT_URL" npm run db:seed
```

### 4. הגדרות מומלצות לפרודקשן

| משתנה | למה |
| --- | --- |
| `UPLOAD_PROVIDER=cloudinary` + מפתחות | מערכת הקבצים של Vercel אינה קבועה — אחסון מקומי לא ישרוד בין הרצות |
| `UPSTASH_REDIS_REST_URL` / `TOKEN` | rate limiting חוצה מופעים (בלעדיו המגביל פועל בזיכרון של כל מופע בנפרד) |
| `RESEND_API_KEY` + `EMAIL_FROM` | שליחת מיילים בפועל |
| `SMS_PROVIDER` + `SMS_API_KEY` | שליחת OTP אמיתי; בלעדיו הקוד רק נכתב ללוג |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` | התראות Push (`npx web-push generate-vapid-keys`) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | התחברות עם Google |
| `CRON_SECRET` | הגנה על נתיב המשימות המתוזמנות |

### 5. משימות מתוזמנות

`vercel.json` כבר מגדיר את ה-crons:

| תזמון | משימה |
| --- | --- |
| כל שעה | התראות על חיפושים שמורים |
| כל שעה | סיום קידומים שפג תוקפם |
| יומי 03:15 | סימון מודעות שפג תוקפן |
| יומי 08:30 | תזכורת על מודעות שעומדות לפוג |

להרצה ידנית:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://<domain>/api/cron?job=saved-searches"
```

---

## אבטחה

- הגבלת קצב על התחברות, OTP, הרשמה, חיפוש, פרסום, חשיפת טלפון, הודעות,
  דיווחים והעלאות.
- אימות טלפון חובה לפני פרסום ראשון.
- CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, Referrer-Policy.
- כל route handler בודק הרשאות בשרת; ה-middleware הוא שכבה נוספת בלבד.
- ניקוי קלט מתגי HTML ומתווי בקרה, ואימות Zod על כל גוף בקשה.
- כתובות IP נשמרות כגיבוב בלבד; EXIF (כולל GPS) נמחק מכל תמונה.
- מחיקה רכה + `AuditLog` לכל פעולת ניהול.

---

## נגישות

עומד בתקן ישראלי 5568 / WCAG 2.1 AA — ראו [`/accessibility`](src/app/accessibility/page.tsx):
ניווט מקלדת מלא, דילוג לתוכן, טבעות פוקוס אחידות, `aria-live` באזורים
מתעדכנים, ניגודיות מספקת בשני מצבי התצוגה, וכיבוד `prefers-reduced-motion`.

---

## רישיון

קוד לדוגמה. תמונות הדמו נטענות מ-picsum.photos ואינן חלק מהמאגר.
