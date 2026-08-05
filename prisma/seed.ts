/**
 * זריעת בסיס הנתונים: עץ קטגוריות מלא עם שדות דינמיים,
 * 30 משתמשים ומודעות דמו מציאותיות בעברית לפי DISTRIBUTION.
 *
 * הרצה: npm run db:seed
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { AttributeType, PrismaClient, Role, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

import { CATEGORY_TREE, type AttrDef, type CatDef } from "./seed/categories";
import {
  generateListing,
  makeRng,
  pickFullName,
  type AttrValues,
} from "./seed/content";
import { UNIQUE_CITIES, neighborhoodsOf } from "../src/lib/cities";
import { buildSearchText, contentFingerprint } from "../src/lib/listing-text";
import { comparableBandFor } from "../src/lib/price-meter";
import { fuzzLocation, slugify } from "../src/lib/utils";

const prisma = new PrismaClient();

type DemoImage = {
  url: string;
  thumbUrl: string;
  blurhash: string;
  width: number;
  height: number;
};

/**
 * תמונות הדמו המקומיות, כולל blurhash אמיתי לכל אחת.
 * נוצרות ע"י `node scripts/generate-demo-images.mjs` — כך שהזריעה
 * אינה תלויה בחיבור לאינטרנט.
 */
const DEMO_IMAGES: Record<string, DemoImage[]> = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "public", "uploads", "demo", "manifest.json"),
    "utf8",
  ),
);

/** מחזיר תמונת דמו לנושא נתון, עם נפילה ל"יד שנייה" אם הנושא לא קיים. */
function demoImage(topic: string, index: number): DemoImage {
  const set = DEMO_IMAGES[topic] ?? DEMO_IMAGES.furniture!;
  return set[index % set.length]!;
}

const TOTAL_USERS = 30;

/**
 * ענפי העסקים שמופיעים בלוח.
 *
 * `rootSlug` קושר את העסק לקטגוריית השורש שבה מותר לו לפרסם — סוחר רכב
 * לא ימכור ספה. `names` מייצר שם מותאם לענף מתוך שם פרטי ושם משפחה.
 */
const BUSINESS_TRADES = [
  {
    rootSlug: "vehicles",
    names: (first: string, last: string) => [
      `${last} מוטורס`,
      `סוכנות רכב ${last}`,
      `${first} ${last} רכב`,
    ],
  },
  {
    rootSlug: "realestate",
    names: (first: string, last: string) => [
      `${last} נדל"ן`,
      `תיווך ${last}`,
      `${first} ${last} נכסים`,
    ],
  },
  {
    rootSlug: "second-hand",
    names: (first: string, last: string) => [
      `${last} ובניו`,
      `בית המכירות ${last}`,
      `${first} סחר`,
    ],
  },
  {
    rootSlug: "services",
    names: (first: string, last: string) => [
      `${last} שירותים`,
      `${first} ${last} עבודות`,
      `קבוצת ${last}`,
    ],
  },
  {
    rootSlug: "businesses",
    names: (_first: string, last: string) => [
      `${last} עסקים`,
      `${last} השקעות`,
    ],
  },
] as const;

/**
 * כמה מודעות לייצר בכל תת-קטגוריה.
 *
 * ארבע הקטגוריות הראשונות עמוקות בהרבה מהשאר, ובכוונה: מדד המחירים
 * מציג מספר רק כשיש לפחות `MIN_SAMPLE` מודעות להשוואה, ובפיזור אחיד על
 * 49 קטגוריות אף צירוף של דגם ושנה או של עיר ומספר חדרים לא היה מגיע
 * לסף. לוח אמיתי גם הוא אינו אחיד — רכב ונדל"ן הם רוב התנועה.
 */
const DISTRIBUTION: Record<string, number> = {
  "private-cars": 150,
  "commercial-vehicles": 12,
  suvs: 45,
  motorcycles: 10,
  scooters: 6,
  "off-road": 2,
  "trade-in": 4,

  "apartments-sale": 220,
  "apartments-rent": 200,
  roommates: 8,
  commercial: 6,
  lots: 3,
  vacation: 3,

  furniture: 18,
  electronics: 20,
  appliances: 14,
  fashion: 12,
  sports: 10,
  "baby-kids": 10,
  tools: 6,

  "jobs-tech": 6,
  "jobs-sales": 4,
  "jobs-hospitality": 4,
  "jobs-education": 4,
  "jobs-health": 3,
  "jobs-logistics": 3,
  "jobs-construction": 3,
  "jobs-admin": 3,

  dogs: 4,
  cats: 4,
  birds: 2,
  fish: 1,
  rodents: 1,
  "pet-supplies": 3,

  businesses: 10,

  renovations: 3,
  "electrician-plumber": 2,
  cleaning: 2,
  moving: 2,
  computers: 2,
  events: 2,
  tutoring: 1,
  beauty: 1,
};

const TOTAL_LISTINGS = Object.values(DISTRIBUTION).reduce((sum, n) => sum + n, 0);

type SeededAttribute = {
  id: string;
  key: string;
  type: AttributeType;
  valueIds: Map<string, string>;
};

async function reset() {
  console.log("🧹 מנקה נתונים קיימים…");
  // הסדר חשוב בגלל מפתחות זרים
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ListingAttribute", "ListingImage", "PriceHistory", "ListingDailyStat",
      "PhoneReveal", "Boost", "FraudFlag", "Report", "Review", "Message",
      "Conversation", "Favorite", "SavedSearch", "Notification",
      "PushSubscription", "AuditLog", "Listing",
      "AttributeValue", "Attribute", "Category",
      "Account", "Session", "VerificationToken", "PhoneOtp", "User"
    RESTART IDENTITY CASCADE
  `);
}

/** יוצר קטגוריה ואת כל צאצאיה, כולל השדות הדינמיים. */
async function seedCategory(
  def: CatDef,
  parentId: string | null,
  order: number,
  registry: Map<string, Map<string, SeededAttribute>>,
): Promise<void> {
  const category = await prisma.category.create({
    data: {
      slug: def.slug,
      name: def.name,
      namePlural: def.namePlural ?? null,
      icon: def.icon,
      description: def.description ?? null,
      priceLabel: def.priceLabel ?? "מחיר",
      parentId,
      order,
    },
  });

  const attrsForCategory = new Map<string, SeededAttribute>();

  for (const [i, a] of (def.attributes ?? []).entries()) {
    const attribute = await prisma.attribute.create({
      data: {
        categoryId: category.id,
        key: a.key,
        label: a.label,
        type: a.type as AttributeType,
        unit: a.unit ?? null,
        placeholder: a.placeholder ?? null,
        helpText: a.helpText ?? null,
        isRequired: a.required ?? false,
        isFilter: a.filter ?? true,
        isHighlight: a.highlight ?? false,
        min: a.min ?? null,
        max: a.max ?? null,
        step: a.step ?? null,
        dependsOn: a.dependsOn ?? null,
        order: i * 10,
      },
    });

    const valueIds = new Map<string, string>();
    const options = normalizeOptions(a);
    if (options.length) {
      await prisma.attributeValue.createMany({
        data: options.map((o, idx) => ({
          attributeId: attribute.id,
          value: o.value,
          label: o.label,
          parentValue: o.parent ?? null,
          order: idx,
        })),
      });
      const created = await prisma.attributeValue.findMany({
        where: { attributeId: attribute.id },
        select: { id: true, value: true },
      });
      for (const v of created) valueIds.set(v.value, v.id);
    }

    attrsForCategory.set(a.key, {
      id: attribute.id,
      key: a.key,
      type: a.type as AttributeType,
      valueIds,
    });
  }

  // ירושה: קטגוריה-בת רואה גם את שדות ההורה
  const inherited = new Map(registry.get(parentId ?? "") ?? []);
  for (const [k, v] of attrsForCategory) inherited.set(k, v);
  registry.set(category.id, inherited);

  for (const [i, child] of (def.children ?? []).entries()) {
    await seedCategory(child, category.id, i * 10, registry);
  }
}

function normalizeOptions(a: AttrDef) {
  return (a.options ?? []).map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
}

/** משתמש שנזרע, יחד עם הענף שבו מותר לו לפרסם (null = פרטי). */
type SeedUser = { id: string; phone: string | null; name: string; businessRoot: string | null };

async function seedUsers(): Promise<SeedUser[]> {
  console.log("👥 יוצר משתמשים…");
  const passwordHash = await bcrypt.hash("Password123!", 10);
  const rng = makeRng(7);

  const admin = await prisma.user.create({
    data: {
      email: "admin@shnatot.co.il",
      phone: "0500000000",
      name: "מנהל המערכת",
      passwordHash,
      role: Role.ADMIN,
      verifiedAt: new Date(),
      bio: "צוות הלוח",
    },
  });

  const demo = await prisma.user.create({
    data: {
      email: "demo@shnatot.co.il",
      phone: "0501111111",
      name: "יעל דמו",
      passwordHash,
      role: Role.USER,
      verifiedAt: new Date(),
      ratingAvg: 4.8,
      ratingCount: 12,
      dealsCount: 15,
      responseMins: 22,
      bio: "מוכרת פריטים במצב מצוין. תמיד זמינה בוואטסאפ.",
    },
  });

  const users: SeedUser[] = [
    { id: admin.id, phone: admin.phone, name: admin.name, businessRoot: null },
    { id: demo.id, phone: demo.phone, name: demo.name, businessRoot: null },
  ];

  for (let i = 0; i < TOTAL_USERS - 2; i++) {
    // שם פרטי ושם משפחה מאותו מאגר — ראה pickFullName
    const { first, last } = pickFullName(rng);
    const isBusiness = rng.bool(0.2);
    const name = `${first} ${last}`;

    // לעסק יש ענף אחד, והשם נגזר ממנו. בלי זה "לוי מוטורס" היה מוכר ספה:
    // השם נבחר מרשימה מעורבת, והמודעות חולקו למשתמשים באקראי.
    const trade = isBusiness ? rng.pick(BUSINESS_TRADES) : null;
    const businessName = trade ? rng.pick(trade.names(first, last)) : null;

    const ratingCount = rng.int(0, 60);
    const created = await prisma.user.create({
      data: {
          email: `user${i + 1}@example.com`,
          phone: `05${rng.int(0, 8)}${String(rng.int(1_000_000, 9_999_999))}`.slice(0, 10),
          name,
          passwordHash,
          role: isBusiness ? Role.BUSINESS : Role.USER,
          verifiedAt: rng.bool(0.85) ? new Date(Date.now() - rng.int(1, 400) * 864e5) : null,
          ratingAvg: ratingCount ? +(3.4 + rng.float(0, 1.6)).toFixed(1) : 0,
          ratingCount,
          dealsCount: rng.int(0, 80),
          responseMins: rng.bool(0.7) ? rng.int(4, 600) : null,
          createdAt: new Date(Date.now() - rng.int(3, 1400) * 864e5),
          lastSeenAt: new Date(Date.now() - rng.int(0, 10) * 864e5),
          ...(businessName
            ? {
                businessName,
                businessSlug: `${slugify(businessName)}-${i + 1}`,
                businessAbout: `${businessName} — עוסקים בתחום כבר ${rng.int(3, 25)} שנים. שירות אמין, מחירים הוגנים וליווי אישי מהפנייה הראשונה ועד סגירת העסקה.`,
                businessCity: rng.pick(UNIQUE_CITIES).name,
              }
          : {}),
      },
    });

    users.push({
      id: created.id,
      phone: created.phone,
      name: created.name,
      businessRoot: trade?.rootSlug ?? null,
    });
  }

  console.log(`   ✓ ${users.length} משתמשים`);
  return users;
}

type LeafInfo = {
  id: string;
  slug: string;
  rootSlug: string;
  names: string[];
  attrs: Map<string, SeededAttribute>;
};

async function collectLeaves(
  registry: Map<string, Map<string, SeededAttribute>>,
): Promise<LeafInfo[]> {
  const all = await prisma.category.findMany({
    select: { id: true, slug: true, name: true, parentId: true },
  });
  const byId = new Map(all.map((c) => [c.id, c]));

  const pathOf = (id: string) => {
    const names: string[] = [];
    let cur = byId.get(id);
    let root = cur?.slug ?? "";
    while (cur) {
      names.unshift(cur.name);
      root = cur.slug;
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return { names, rootSlug: root };
  };

  return all
    .filter((c) => DISTRIBUTION[c.slug] !== undefined)
    .map((c) => {
      const { names, rootSlug } = pathOf(c.id);
      return {
        id: c.id,
        slug: c.slug,
        rootSlug,
        names,
        attrs: registry.get(c.id) ?? new Map(),
      };
    });
}

async function seedListings(users: SeedUser[], leaves: LeafInfo[]) {
  console.log("📋 יוצר מודעות…");
  const rng = makeRng(20260802);

  // מוכרים פרטיים מפרסמים בכל מקום; עסק מפרסם רק בענף שלו.
  const privateUsers = users.filter((u) => u.businessRoot === null);
  const byRoot = new Map<string, SeedUser[]>();
  for (const u of users) {
    if (!u.businessRoot) continue;
    const list = byRoot.get(u.businessRoot) ?? [];
    list.push(u);
    byRoot.set(u.businessRoot, list);
  }

  /**
   * בוחר מפרסם למודעה. בערך שליש מהמודעות בענף שיש בו סוחרים מגיעות
   * מסוחר — יחס שנראה נכון בלוח אמיתי בלי להטביע את המוכרים הפרטיים.
   */
  const pickOwner = (rootSlug: string): SeedUser => {
    const dealers = byRoot.get(rootSlug);
    if (dealers?.length && rng.bool(0.35)) return rng.pick(dealers);
    return rng.pick(privateUsers);
  };
  let created = 0;
  const listingIds: string[] = [];

  /**
   * ערים משוקללות לפי אוכלוסייה — זה מה שעמודת `pop` נועדה לה.
   *
   * בחירה אחידה מ-60 יישובים נתנה למיתר (8,000 תושבים) בדיוק כמה מודעות
   * כמו לירושלים, ובפועל אף עיר לא הגיעה למספר מודעות שמאפשר לגזור
   * ממנו חציון. השורש הריבועי ממתן את ההטיה, אחרת שלוש הערים הגדולות
   * בולעות את הלוח ובערים הבינוניות לא נשאר כלום.
   */
  const cityWeights = UNIQUE_CITIES.map((c) => [c, Math.round(Math.sqrt(c.pop) / 10)] as const);

  /**
   * נדל"ן מרוכז יותר: רק יישובים עם שוק דירות של ממש, ובמשקל מלא של
   * האוכלוסייה ולא בשורש. דף "מחירי הדירות ב<עיר>" מודד עיר אחת, ולכן
   * הוא זקוק לעומק בעיר ולא לפריסה על פני מפת הארץ.
   */
  const realEstateCityWeights = UNIQUE_CITIES.filter((c) => c.pop >= 50_000).map(
    (c) => [c, Math.round(c.pop / 1000)] as const,
  );

  for (const leaf of leaves) {
    const count = DISTRIBUTION[leaf.slug] ?? 0;

    for (let i = 0; i < count; i++) {
      const city = rng.weighted(
        leaf.rootSlug === "realestate" ? realEstateCityWeights : cityWeights,
      );
      const hoods = neighborhoodsOf(city.name);
      const neighborhood = hoods.length && rng.bool(0.6) ? rng.pick(hoods) : null;
      const owner = pickOwner(leaf.rootSlug);

      const gen = generateListing(rng, leaf.rootSlug, leaf.slug, city.name, city.region);

      const publishedAt = new Date(Date.now() - rng.int(0, 60) * 864e5 - rng.int(0, 86_400_000));
      const isPromoted = rng.bool(0.08);

      // פיזור מיקום בתוך העיר, ואז טשטוש נוסף לתצוגה ציבורית
      const lat = city.lat + rng.float(-0.02, 0.02);
      const lng = city.lng + rng.float(-0.025, 0.025);
      const slugBase = slugify(gen.title);
      const slug = `${slugBase}-${(created + 1).toString(36)}${rng.int(100, 999)}`;
      const display = fuzzLocation(lat, lng, slug, 500);

      const attributeLabels = Object.values(gen.attrs)
        .flatMap((v) => (Array.isArray(v) ? v : [v]))
        .filter((v) => typeof v === "string") as string[];

      const searchText = buildSearchText({
        title: gen.title,
        description: gen.description,
        city: city.name,
        neighborhood,
        categoryNames: leaf.names,
        attributeLabels,
      });

      const listing = await prisma.listing.create({
        data: {
          slug,
          userId: owner.id,
          categoryId: leaf.id,
          title: gen.title,
          description: gen.description,
          price: gen.price,
          isNegotiable: rng.bool(0.35),
          status: "ACTIVE",
          city: city.name,
          neighborhood,
          lat,
          lng,
          displayLat: display.lat,
          displayLng: display.lng,
          contactPhone: owner.phone,
          contactName: owner.name.split(" ")[0],
          viewCount: rng.int(3, 2400),
          contactRevealCount: rng.int(0, 180),
          favoriteCount: rng.int(0, 60),
          isPromoted,
          promotedUntil: isPromoted ? new Date(Date.now() + rng.int(1, 14) * 864e5) : null,
          bumpedAt: rng.bool(0.2) ? new Date(Date.now() - rng.int(0, 5) * 864e5) : null,
          publishedAt,
          createdAt: publishedAt,
          expiresAt: new Date(publishedAt.getTime() + 45 * 864e5),
          searchText,
          comparableBand: comparableBandFor(leaf.rootSlug, gen.attrs),
          contentHash: contentFingerprint({
            title: gen.title,
            description: gen.description,
            price: gen.price,
            categoryId: leaf.id,
          }),
          images: {
            create: Array.from({ length: gen.imageCount }, (_, idx) => ({
              ...demoImage(gen.imageTopic, created + idx),
              order: idx,
            })),
          },
        },
        select: { id: true },
      });

      listingIds.push(listing.id);
      await writeAttributes(listing.id, leaf.attrs, gen.attrs);

      // היסטוריית מחירים — לחלק מהמודעות ירידת מחיר
      if (gen.price && rng.bool(0.3)) {
        const drop = Math.round(gen.price * rng.float(0.04, 0.16));
        await prisma.priceHistory.createMany({
          data: [
            {
              listingId: listing.id,
              price: gen.price + drop,
              createdAt: publishedAt,
            },
            {
              listingId: listing.id,
              price: gen.price,
              createdAt: new Date(publishedAt.getTime() + rng.int(2, 20) * 864e5),
            },
          ],
        });
      } else if (gen.price) {
        await prisma.priceHistory.create({
          data: { listingId: listing.id, price: gen.price, createdAt: publishedAt },
        });
      }

      // סטטיסטיקות יומיות ל-30 הימים האחרונים
      const stats: Prisma.ListingDailyStatCreateManyInput[] = [];
      for (let d = 0; d < 30; d++) {
        const day = new Date();
        day.setUTCHours(0, 0, 0, 0);
        day.setUTCDate(day.getUTCDate() - d);
        if (day < publishedAt) continue;
        stats.push({
          listingId: listing.id,
          day,
          views: rng.int(0, 60),
          reveals: rng.int(0, 6),
          favorites: rng.int(0, 3),
          messages: rng.int(0, 2),
        });
      }
      if (stats.length) await prisma.listingDailyStat.createMany({ data: stats });

      created++;
      if (created % 50 === 0) console.log(`   … ${created}/${TOTAL_LISTINGS}`);
    }
  }

  console.log(`   ✓ ${created} מודעות`);
  return listingIds;
}

/** כותב את ערכי השדות הדינמיים למודעה. */
async function writeAttributes(
  listingId: string,
  available: Map<string, SeededAttribute>,
  values: AttrValues,
) {
  const rows: Prisma.ListingAttributeCreateManyInput[] = [];

  for (const [key, raw] of Object.entries(values)) {
    const attr = available.get(key);
    if (!attr) continue;

    const list = Array.isArray(raw) ? raw : [raw];
    for (const v of list) {
      if (v === undefined || v === null || v === "") continue;

      if (attr.type === "SELECT" || attr.type === "MULTISELECT") {
        const valueId = attr.valueIds.get(String(v));
        if (!valueId) continue;
        rows.push({ listingId, attributeId: attr.id, valueId, valueText: String(v) });
      } else if (attr.type === "NUMBER") {
        const num = Number(v);
        if (Number.isNaN(num)) continue;
        rows.push({ listingId, attributeId: attr.id, valueNumber: num });
      } else if (attr.type === "BOOLEAN") {
        rows.push({ listingId, attributeId: attr.id, valueBool: Boolean(v) });
      } else {
        rows.push({ listingId, attributeId: attr.id, valueText: String(v) });
      }
    }
  }

  if (rows.length) await prisma.listingAttribute.createMany({ data: rows });
}

async function seedEngagement(
  users: { id: string }[],
  listingIds: string[],
) {
  console.log("💬 יוצר מועדפים, שיחות ודירוגים…");
  const rng = makeRng(99);

  const listings = await prisma.listing.findMany({
    where: { id: { in: listingIds } },
    select: { id: true, userId: true, title: true, categoryId: true },
  });

  // מועדפים
  const favorites = new Set<string>();
  const favRows: Prisma.FavoriteCreateManyInput[] = [];
  for (let i = 0; i < 400; i++) {
    const u = rng.pick(users);
    const l = rng.pick(listings);
    if (l.userId === u.id) continue;
    const key = `${u.id}:${l.id}`;
    if (favorites.has(key)) continue;
    favorites.add(key);
    favRows.push({
      userId: u.id,
      listingId: l.id,
      createdAt: new Date(Date.now() - rng.int(0, 40) * 864e5),
    });
  }
  await prisma.favorite.createMany({ data: favRows, skipDuplicates: true });

  // שיחות והודעות
  const OPENERS = [
    "היי, המודעה עדיין רלוונטית?",
    "שלום, אפשר לדעת מה המחיר הסופי?",
    "מעוניין, מתי אפשר לבוא לראות?",
    "היי, יש אפשרות למשלוח לאזור המרכז?",
    "שלום, למה מוכרים? יש בעיות ידועות?",
  ];
  const REPLIES = [
    "היי, כן זמין. אפשר לתאם להיום או מחר בערב.",
    "המחיר גמיש קצת לרציניים שבאים לראות.",
    "בטח, שלח לי הודעה מתי נוח לך ואסדר.",
    "יש אפשרות למשלוח בתוספת עלות שליח.",
    "הכול תקין, פשוט אין לי בו צורך יותר.",
  ];

  const pairs = new Set<string>();
  for (let i = 0; i < 70; i++) {
    const l = rng.pick(listings);
    const buyer = rng.pick(users);
    if (buyer.id === l.userId) continue;
    const key = `${l.id}:${buyer.id}`;
    if (pairs.has(key)) continue;
    pairs.add(key);

    const start = new Date(Date.now() - rng.int(0, 25) * 864e5);
    const msgCount = rng.int(2, 6);
    const messages: Prisma.MessageCreateWithoutConversationInput[] = [];
    for (let m = 0; m < msgCount; m++) {
      const fromBuyer = m % 2 === 0;
      messages.push({
        sender: { connect: { id: fromBuyer ? buyer.id : l.userId } },
        body: fromBuyer ? rng.pick(OPENERS) : rng.pick(REPLIES),
        createdAt: new Date(start.getTime() + m * rng.int(5, 600) * 60_000),
      });
    }

    await prisma.conversation.create({
      data: {
        listingId: l.id,
        buyerId: buyer.id,
        sellerId: l.userId,
        createdAt: start,
        lastMessageAt: new Date(start.getTime() + msgCount * 30 * 60_000),
        buyerReadAt: new Date(),
        sellerReadAt: rng.bool(0.6) ? new Date() : null,
        messages: { create: messages },
      },
    });
  }

  // דירוגים
  const reviewKeys = new Set<string>();
  const reviewRows: Prisma.ReviewCreateManyInput[] = [];
  const BODIES = [
    "עסקה נעימה ומהירה, המוצר בדיוק כמו בתמונות. ממליץ בחום!",
    "תקשורת מצוינת וגמישות בתיאום. תודה רבה.",
    "הכול היה תקין, אדם הגון ואמין.",
    "המוצר היה במצב טוב פחות ממה שציפיתי, אבל המוכר היה הוגן בהנחה.",
    "שירות אדיב, הגיע בזמן שסוכם.",
  ];
  for (let i = 0; i < 120; i++) {
    const l = rng.pick(listings);
    const author = rng.pick(users);
    if (author.id === l.userId) continue;
    const key = `${author.id}:${l.userId}:${l.id}`;
    if (reviewKeys.has(key)) continue;
    reviewKeys.add(key);
    reviewRows.push({
      authorId: author.id,
      targetId: l.userId,
      listingId: l.id,
      rating: rng.bool(0.82) ? rng.int(4, 5) : rng.int(2, 3),
      body: rng.pick(BODIES),
      createdAt: new Date(Date.now() - rng.int(0, 200) * 864e5),
    });
  }
  await prisma.review.createMany({ data: reviewRows, skipDuplicates: true });

  // חיפושים שמורים
  const categories = await prisma.category.findMany({
    where: { parentId: { not: null } },
    select: { id: true, name: true, slug: true },
  });
  const searchRows: Prisma.SavedSearchCreateManyInput[] = [];
  for (let i = 0; i < 45; i++) {
    const u = rng.pick(users);
    const c = rng.pick(categories);
    const city = rng.pick(UNIQUE_CITIES);
    searchRows.push({
      userId: u.id,
      name: `${c.name} ב${city.name}`,
      filters: {
        categorySlug: c.slug,
        cities: [city.name],
        priceMin: rng.bool(0.5) ? rng.int(100, 5000) : undefined,
        priceMax: rng.bool(0.5) ? rng.int(6000, 400_000) : undefined,
        q: rng.bool(0.3) ? c.name : undefined,
      } as Prisma.InputJsonValue,
      frequency: rng.pick(["INSTANT", "DAILY", "WEEKLY", "OFF"] as const),
      createdAt: new Date(Date.now() - rng.int(0, 120) * 864e5),
    });
  }
  await prisma.savedSearch.createMany({ data: searchRows });

  // דיווחים פתוחים לתור המודרציה
  const reportRows: Prisma.ReportCreateManyInput[] = [];
  for (let i = 0; i < 12; i++) {
    const l = rng.pick(listings);
    reportRows.push({
      listingId: l.id,
      authorId: rng.pick(users).id,
      reason: rng.pick(["SPAM", "FRAUD", "OFFENSIVE", "DUPLICATE", "WRONG_CATEGORY", "SOLD_ALREADY"] as const),
      details: rng.pick([
        "נראה לי שהמחיר לא אמיתי, מבקשים תשלום מראש.",
        "המודעה כבר פורסמה פעמיים באותה קטגוריה.",
        "הפריט נמכר אבל המודעה עדיין פעילה.",
        "התמונות נלקחו מאתר אחר.",
      ]),
      status: "OPEN",
      createdAt: new Date(Date.now() - rng.int(0, 14) * 864e5),
    });
  }
  await prisma.report.createMany({ data: reportRows });

  // התראות למשתמש הדמו
  const demo = await prisma.user.findUnique({ where: { email: "demo@shnatot.co.il" } });
  if (demo) {
    await prisma.notification.createMany({
      data: [
        {
          userId: demo.id,
          type: "SAVED_SEARCH_MATCH",
          title: "3 מודעות חדשות תואמות לחיפוש שלך",
          body: 'נמצאו מודעות חדשות בקטגוריית "דירות להשכרה" בתל אביב-יפו.',
          url: "/my/searches",
          createdAt: new Date(Date.now() - 3 * 3600_000),
        },
        {
          userId: demo.id,
          type: "NEW_MESSAGE",
          title: "התקבלה הודעה חדשה",
          body: "קונה מתעניין שאל לגבי אחת המודעות שלך.",
          url: "/my/messages",
          createdAt: new Date(Date.now() - 26 * 3600_000),
        },
      ],
    });
  }

  console.log(
    `   ✓ ${favRows.length} מועדפים, ${pairs.size} שיחות, ${reviewRows.length} דירוגים, ${searchRows.length} חיפושים שמורים`,
  );
}

/**
 * היסטוריית מכירות — הבסיס לעקומת המחיר-מהירות.
 *
 * מסמן חלק מהמודעות כנמכרות ומזיז את `publishedAt` אחורה, כך שיהיה
 * מרווח אמיתי בין פרסום למכירה.
 *
 * **הקשר בין מחיר למהירות כאן סינתטי בכוונה.** בנתוני אמת העקומה
 * תהיה מה שתהיה; בזריעת דמו היא נבנית מונוטונית — הרבעון הזול נמכר
 * תוך כשבוע והיקר תוך כחודשיים — כדי שהפיצ'ר יהיה ניתן להדגמה. מי
 * שקורא מספרים מהסביבה הזו צריך לדעת שהם לא ממצא על השוק הישראלי.
 *
 * הפיזור נשאר רחב וחופף בין רבעונים, כי עקומה חלקה מדי נראית מזויפת
 * ומלמדת לסמוך על המספר יותר משמותר.
 */
async function seedSalesHistory() {
  console.log("🏷  יוצר היסטוריית מכירות…");

  const updated = await prisma.$executeRawUnsafe(`
    WITH ranked AS (
      SELECT
        id,
        NTILE(4) OVER (PARTITION BY "categoryId" ORDER BY price) AS q,
        ROW_NUMBER() OVER (PARTITION BY "categoryId" ORDER BY random()) AS rn,
        COUNT(*) OVER (PARTITION BY "categoryId") AS n
      FROM "Listing"
      WHERE status = 'ACTIVE' AND price IS NOT NULL AND "deletedAt" IS NULL
    ),
    picked AS (
      SELECT
        id,
        -- חציון עולה עם רבעון המחיר: כ-6, 12, 24 ו-48 יום
        GREATEST(1, ROUND((6 * POWER(2.0, q - 1)) * (0.6 + random() * 0.8))) AS days,
        -- לפני כמה זמן נמכרה. נדגם פעם אחת ומשמש לשני התאריכים.
        (5 + random() * 200) AS age
      FROM ranked
      WHERE rn <= CEIL(n * 0.28)
    )
    /*
     * שני התאריכים נגזרים מאותן שתי דגימות, ולכן ההפרש ביניהם שווה
     * בדיוק למספר הימים שנדגם. דגימה נפרדת לכל תאריך הייתה נותנת פער
     * אקראי לגמרי, והעקומה שמחושבת ממנו הייתה רעש שנראה כמו נתון.
     */
    UPDATE "Listing" l SET
      status = 'SOLD',
      "publishedAt" = NOW() - (INTERVAL '1 day' * (p.days + p.age)),
      "soldAt"      = NOW() - (INTERVAL '1 day' * p.age)
    FROM picked p
    WHERE l.id = p.id
  `);

  console.log(`   ✓ ${updated} מודעות סומנו כנמכרות`);
}

/** מסנכרן דירוג ממוצע ומספר מועדפים לפי הנתונים שנוצרו. */
async function syncAggregates() {
  console.log("🔄 מסנכרן מצרפים…");
  await prisma.$executeRawUnsafe(`
    UPDATE "User" u SET
      "ratingAvg" = COALESCE(r.avg, 0),
      "ratingCount" = COALESCE(r.cnt, 0)
    FROM (
      SELECT "targetId", ROUND(AVG(rating)::numeric, 1)::float AS avg, COUNT(*)::int AS cnt
      FROM "Review" GROUP BY "targetId"
    ) r
    WHERE u.id = r."targetId"
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "Listing" l SET "favoriteCount" = COALESCE(f.cnt, 0)
    FROM (SELECT "listingId", COUNT(*)::int AS cnt FROM "Favorite" GROUP BY "listingId") f
    WHERE l.id = f."listingId"
  `);
}

async function main() {
  const started = Date.now();
  await reset();

  console.log("🗂  יוצר קטגוריות ושדות דינמיים…");
  const registry = new Map<string, Map<string, SeededAttribute>>();
  for (const [i, def] of CATEGORY_TREE.entries()) {
    await seedCategory(def, null, i * 10, registry);
  }
  const catCount = await prisma.category.count();
  const attrCount = await prisma.attribute.count();
  const valCount = await prisma.attributeValue.count();
  console.log(`   ✓ ${catCount} קטגוריות, ${attrCount} שדות, ${valCount} ערכים`);

  const users = await seedUsers();
  const leaves = await collectLeaves(registry);
  const listingIds = await seedListings(users, leaves);
  await seedEngagement(users, listingIds);
  await seedSalesHistory();
  await syncAggregates();

  console.log(`\n✅ הזריעה הסתיימה תוך ${((Date.now() - started) / 1000).toFixed(1)} שניות`);
  console.log("   מנהל:  admin@shnatot.co.il / Password123!");
  console.log("   דמו:   demo@shnatot.co.il  / Password123!");
}

main()
  .catch((e) => {
    console.error("❌ הזריעה נכשלה:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
