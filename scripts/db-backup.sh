#!/usr/bin/env bash
# גיבוי יומי של מסד הנתונים, כולל בדיקה שהשחזור עובד.
#
#   scripts/db-backup.sh            גיבוי בלבד
#   scripts/db-backup.sh --verify   גיבוי + שחזור למסד זמני + ספירה
#
# **גיבוי שלא שוחזר מעולם אינו גיבוי.** הבדיקה כאן משחזרת למסד נפרד
# וסופרת שורות; בלעדיה מגלים שהקובץ פגום ביום שבו צריך אותו.
#
# להרצה יומית: cron ב-VPS, או GitHub Action מתוזמן עם DATABASE_URL
# כסוד. Neon ו-Supabase מגבים לבד — הסקריפט הזה נועד לגיבוי שנמצא
# אצלך ולא אצל הספק, שזה בדיוק מה שחסר כשהחשבון אצל הספק ננעל.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL חסר}"

# Prisma מוסיף ?schema=public, ו-pg_dump דוחה את הפרמטר הזה כלא חוקי.
PG_URL="${DATABASE_URL%%\?*}"
DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$DIR/kedai-$STAMP.dump"

mkdir -p "$DIR"

echo "→ גיבוי אל $FILE"
pg_dump --format=custom --no-owner --no-privileges --dbname="$PG_URL" --file="$FILE"
SIZE=$(du -h "$FILE" | cut -f1)
echo "  ✓ $SIZE"

if [[ "${1:-}" == "--verify" ]]; then
  # מסד זמני בשם ייחודי, כדי ששתי הרצות במקביל לא ידרסו זו את זו
  TMPDB="kedai_restore_check_$STAMP"
  ADMIN_URL="${PG_URL%/*}/postgres"

  echo "→ בדיקת שחזור אל $TMPDB"
  psql "$ADMIN_URL" -qc "CREATE DATABASE \"$TMPDB\";"
  trap 'psql "$ADMIN_URL" -qc "DROP DATABASE IF EXISTS \"$TMPDB\";" >/dev/null 2>&1 || true' EXIT

  pg_restore --no-owner --no-privileges --dbname="${PG_URL%/*}/$TMPDB" "$FILE" >/dev/null

  ROWS=$(psql "${PG_URL%/*}/$TMPDB" -tAc 'SELECT count(*) FROM "Listing";')
  echo "  ✓ שוחזר, $ROWS מודעות"
  if [[ "$ROWS" -eq 0 ]]; then
    echo "  ✗ הגיבוי שוחזר ריק — זה אינו גיבוי תקין." >&2
    exit 1
  fi
fi

echo "→ ניקוי גיבויים ישנים מ-$KEEP_DAYS ימים"
find "$DIR" -name 'kedai-*.dump' -mtime "+$KEEP_DAYS" -delete
echo "✓ הסתיים"
