-- אינדקסי חיפוש: Full-Text Search + trigram לתיקון שגיאות כתיב בעברית.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- חיפוש מילים מלאות. עברית אינה נתמכת ע"י מילון פנימי של Postgres,
-- ולכן משתמשים בתצורת 'simple' שמפרקת לטוקנים ללא stemming.
CREATE INDEX IF NOT EXISTS "Listing_searchText_fts_idx"
  ON "Listing" USING GIN (to_tsvector('simple', "searchText"));

-- דמיון טקסטואלי (trigram) — מאפשר התאמה גם עם שגיאות כתיב.
CREATE INDEX IF NOT EXISTS "Listing_searchText_trgm_idx"
  ON "Listing" USING GIN ("searchText" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Listing_title_trgm_idx"
  ON "Listing" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Listing_city_trgm_idx"
  ON "Listing" USING GIN ("city" gin_trgm_ops);

-- אינדקס חלקי למודעות פעילות בלבד — רוב השאילתות מסננות לפי סטטוס.
CREATE INDEX IF NOT EXISTS "Listing_active_published_idx"
  ON "Listing" ("publishedAt" DESC)
  WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL;

-- שליפת מודעות לפי מיקום (מפה / מיון לפי מרחק).
CREATE INDEX IF NOT EXISTS "Listing_geo_idx"
  ON "Listing" ("displayLat", "displayLng")
  WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL;
