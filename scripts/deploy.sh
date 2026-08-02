#!/usr/bin/env bash
#
# פריסה של "לוח" ל-Vercel בפקודה אחת.
#
#   bash scripts/deploy.sh
#
# הסקריפט מתקין את vercel CLI אם צריך, מבקש את מחרוזות החיבור מ-Neon,
# מייצר AUTH_SECRET, מגדיר את משתני הסביבה, פורס, ומציע לזרוע נתוני דמו.
# אפשר להריץ אותו שוב בבטחה — משתנים קיימים מוחלפים ולא מוכפלים.

set -euo pipefail

BOLD=$'\033[1m'; DIM=$'\033[2m'; GREEN=$'\033[32m'; RED=$'\033[31m'
YELLOW=$'\033[33m'; RESET=$'\033[0m'

say()  { printf '%s\n' "$*"; }
step() { printf '\n%s==> %s%s\n' "$BOLD" "$*" "$RESET"; }
ok()   { printf '%s  ✓%s %s\n' "$GREEN" "$RESET" "$*"; }
warn() { printf '%s  !%s %s\n' "$YELLOW" "$RESET" "$*"; }
die()  { printf '\n%s  ✗ %s%s\n\n' "$RED" "$*" "$RESET" >&2; exit 1; }

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# --- בדיקות מקדימות -------------------------------------------------------

step "בדיקת סביבה"

command -v node >/dev/null 2>&1 || die "Node.js לא מותקן. נדרש Node 20 ומעלה."

node_major="$(node -p 'process.versions.node.split(".")[0]')"
[ "$node_major" -ge 20 ] || die "נדרש Node 20 ומעלה (מותקן: $(node -v))."
ok "Node $(node -v)"

if ! command -v vercel >/dev/null 2>&1; then
  warn "vercel CLI לא מותקן — מתקין גלובלית"
  npm install -g vercel >/dev/null 2>&1 || die "התקנת vercel CLI נכשלה. נסה: npm i -g vercel"
fi
ok "vercel CLI $(vercel --version 2>/dev/null | head -1)"

# --- מחרוזות החיבור מ-Neon ------------------------------------------------

step "בסיס נתונים"

cat <<'EOF'
  צריך שתי מחרוזות חיבור מ-Neon (https://console.neon.tech).
  במסך הפרויקט יש מתג "Pooled connection" ליד מחרוזת החיבור:

    דלוק  → זו ה-DATABASE_URL  (מכילה -pooler)
    כבוי  → זו ה-DIRECT_URL    (בלי -pooler)

EOF

read -r -p "  DATABASE_URL (pooled): " DATABASE_URL
[ -n "${DATABASE_URL:-}" ] || die "לא הוזנה DATABASE_URL."

read -r -p "  DIRECT_URL (direct):   " DIRECT_URL
[ -n "${DIRECT_URL:-}" ] || die "לא הוזנה DIRECT_URL."

case "$DATABASE_URL" in
  postgres://*|postgresql://*) ;;
  *) die "DATABASE_URL לא נראית כמו מחרוזת Postgres תקינה." ;;
esac
case "$DIRECT_URL" in
  postgres://*|postgresql://*) ;;
  *) die "DIRECT_URL לא נראית כמו מחרוזת Postgres תקינה." ;;
esac

# טעות נפוצה: להדביק פעמיים את אותה מחרוזת. לא חוסם, רק מזהיר.
if [ "$DATABASE_URL" = "$DIRECT_URL" ]; then
  warn "שתי המחרוזות זהות. ב-Neon הן אמורות להיות שונות (אחת עם -pooler)."
fi

step "בדיקת חיבור לבסיס הנתונים"
# `--url` מפורש: בלעדיו prisma דורש schema ונכשל גם על בסיס נתונים תקין
if npx --yes prisma db execute --url "$DIRECT_URL" --stdin <<<"SELECT 1;" >/dev/null 2>&1; then
  ok "החיבור עובד"
else
  die "לא הצלחתי להתחבר לבסיס הנתונים. בדוק את המחרוזת (כולל ?sslmode=require בסוף)."
fi

# --- מפתח האימות ----------------------------------------------------------

step "מפתח אימות"
if command -v openssl >/dev/null 2>&1; then
  AUTH_SECRET="$(openssl rand -base64 32)"
else
  AUTH_SECRET="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("base64"))')"
fi
ok "AUTH_SECRET נוצר"

# --- קישור הפרויקט --------------------------------------------------------

step "קישור הפרויקט ל-Vercel"
say "  ייפתח דפדפן להתחברות אם עוד לא התחברת."
vercel link || die "קישור הפרויקט נכשל."
ok "הפרויקט מקושר"

# --- משתני סביבה ----------------------------------------------------------

step "הגדרת משתני סביבה"

set_env() {
  local name="$1" value="$2"
  # הסרה שקטה של ערך קיים כדי שהרצה חוזרת לא תיצור כפילות
  vercel env rm "$name" production --yes >/dev/null 2>&1 || true
  printf '%s' "$value" | vercel env add "$name" production >/dev/null 2>&1 \
    && ok "$name" \
    || die "הגדרת $name נכשלה."
}

set_env DATABASE_URL "$DATABASE_URL"
set_env DIRECT_URL "$DIRECT_URL"
set_env AUTH_SECRET "$AUTH_SECRET"
set_env AUTH_TRUST_HOST "true"

# --- פריסה ----------------------------------------------------------------

step "פריסה לפרודקשן"
say "  המיגרציות רצות אוטומטית כחלק מהבנייה (vercel-build)."
say "  זה לוקח בערך דקה וחצי.\n"

# הפלט נשמר לקובץ ובמקביל מוצג, כדי שהמשתמש יראה את התקדמות הבנייה
# וגם נוכל לחלץ ממנו את הכתובת. `|| true` מונע מ-pipefail להפיל את
# הסקריפט לפני שנספיק להדפיס שגיאה מובנת.
deploy_log="$(mktemp)"
trap 'rm -f "$deploy_log"' EXIT

vercel deploy --prod 2>&1 | tee "$deploy_log" || true
DEPLOY_URL="$(grep -Eo 'https://[a-zA-Z0-9.-]+\.vercel\.app' "$deploy_log" | tail -1 || true)"

if [ -z "${DEPLOY_URL:-}" ]; then
  say ""
  die "הפריסה נכשלה. השגיאה מופיעה למעלה — לרוב זה משתנה סביבה חסר או מחרוזת חיבור שגויה."
fi

# עכשיו שיש כתובת, מגדירים אותה ופורסים שוב כדי שקישורים מוחלטים יהיו נכונים
step "עדכון כתובת האתר"
set_env NEXT_PUBLIC_SITE_URL "$DEPLOY_URL"

# --- זריעה ----------------------------------------------------------------

step "נתוני דמו"
read -r -p "  לזרוע 300 מודעות דמו בעברית? [Y/n] " seed_answer
seed_answer="${seed_answer:-Y}"

if [[ "$seed_answer" =~ ^[Yy]$ ]]; then
  [ -d node_modules ] || npm install
  if DATABASE_URL="$DIRECT_URL" DIRECT_URL="$DIRECT_URL" npm run db:seed; then
    ok "נתוני הדמו נזרעו"
  else
    warn "הזריעה נכשלה. אפשר לנסות שוב ידנית:"
    say "    DATABASE_URL=\"\$DIRECT_URL\" npm run db:seed"
  fi
fi

step "פריסה מחדש כדי להחיל את הכתובת ואת הנתונים"
vercel deploy --prod >/dev/null 2>&1 && ok "הושלם" || warn "הפריסה החוזרת נכשלה — הרץ 'vercel deploy --prod' ידנית."

# --- סיכום ----------------------------------------------------------------

cat <<EOF

${BOLD}${GREEN}האתר באוויר${RESET}

  ${BOLD}${DEPLOY_URL}${RESET}

  התחברות כמנהל:  admin@luach.co.il / Password123!
  פאנל הניהול:    ${DEPLOY_URL}/admin

${DIM}  מומלץ להוסיף בהמשך (Vercel → Settings → Environment Variables):
    UPLOAD_PROVIDER=cloudinary + מפתחות  — כדי שתמונות שמשתמשים מעלים ישרדו
    UPSTASH_REDIS_REST_URL / TOKEN        — הגבלת קצב חוצת מופעים
    SMS_PROVIDER + SMS_API_KEY            — שליחת קודי אימות אמיתית${RESET}

EOF
