/**
 * בדיקת קבלה מקצה לקצה מול שרת פרודקשן חי.
 * הרשמה → אימות טלפון → פרסום מודעה → חיפוש עם פילטר → מועדפים →
 * הודעה למוכר → צפייה בפאנל הניהול.
 *
 * הרצה:  node scripts/e2e-check.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? "http://localhost:3112";

/**
 * בפרודקשן הקוד לא מוחזר בתגובה (בכוונה) אלא נשלח ב-SMS.
 * כשאין ספק SMS מוגדר הוא נכתב ללוג השרת, ומשם הבדיקה קוראת אותו —
 * בדיוק כפי שמפעיל המערכת היה עושה.
 */
async function otpFromServerLog(phone) {
  const path = process.env.E2E_SERVER_LOG;
  if (!path) return null;
  const { readFile } = await import("node:fs/promises");
  const log = await readFile(path, "utf8");
  const matches = [...log.matchAll(new RegExp(`\\[SMS→${phone}\\][^\\d]*(\\d{6})`, "g"))];
  return matches.length ? matches[matches.length - 1][1] : null;
}

const jars = new Map();

function jar(name) {
  if (!jars.has(name)) jars.set(name, new Map());
  return jars.get(name);
}

async function call(who, path, init = {}) {
  const cookies = jar(who);
  const cookieHeader = [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    redirect: "manual",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(init.headers ?? {}),
    },
  });
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const idx = pair.indexOf("=");
    cookies.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
  return res;
}

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text.slice(0, 200) };
  }
}

let failures = 0;
function check(label, condition, detail = "") {
  const mark = condition ? "PASS" : "FAIL";
  if (!condition) failures++;
  console.log(`  [${mark}] ${label}${detail ? ` — ${detail}` : ""}`);
}

/** התחברות דרך ספק Credentials של Auth.js (דורש CSRF). */
async function signIn(who, provider, body) {
  const csrfRes = await call(who, "/api/auth/csrf");
  const { csrfToken } = await json(csrfRes);
  const form = new URLSearchParams({ ...body, csrfToken, json: "true" });
  const res = await call(who, `/api/auth/callback/${provider}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const session = await json(await call(who, "/api/auth/session"));
  return { status: res.status, session };
}

async function main() {
  const stamp = Date.now().toString().slice(-8);
  const seller = {
    name: `בודק אוטומטי ${stamp}`,
    email: `e2e-${stamp}@example.com`,
    password: "Password123!",
    phone: `052${stamp.slice(0, 7)}`,
  };

  console.log(`\nבדיקת קבלה מול ${BASE}\n`);

  // 1 — הרשמה
  console.log("1. הרשמה");
  const reg = await json(
    await call("seller", "/api/auth/register", {
      method: "POST",
      body: JSON.stringify(seller),
    }),
  );
  check("נוצר חשבון", Boolean(reg.user?.id), reg.user?.email ?? JSON.stringify(reg));

  const login = await signIn("seller", "password", {
    email: seller.email,
    password: seller.password,
  });
  check("התחברות והנפקת סשן", Boolean(login.session?.user?.id), login.session?.user?.name);

  // 2 — אימות טלפון (OTP מוחזר בפיתוח)
  console.log("\n2. אימות טלפון");
  const otp = await json(
    await call("seller", "/api/auth/otp", {
      method: "POST",
      body: JSON.stringify({ phone: seller.phone, purpose: "verify" }),
    }),
  );
  check("נשלח קוד", otp.sent === true);

  // השהיה קצרה כדי שהלוג ייכתב לדיסק
  await new Promise((r) => setTimeout(r, 400));
  const code = otp.devCode ?? (await otpFromServerLog(seller.phone));
  check("הקוד זמין לבדיקה", Boolean(code), code ? "מלוג השרת" : "לא נמצא");

  const verified = await json(
    await call("seller", "/api/auth/otp", {
      method: "PUT",
      body: JSON.stringify({ phone: seller.phone, code }),
    }),
  );
  check("הטלפון אומת", verified.verified === true, verified.phone ?? verified.error);

  // הסשן חייב להתרענן כדי ש-phoneVerified יעודכן בטוקן
  await signIn("seller", "password", { email: seller.email, password: seller.password });

  // 3 — פרסום מודעה עם שדות דינמיים ותמונה
  console.log("\n3. פרסום מודעה");
  const cats = await json(await call("seller", "/api/search?category=vehicles&countOnly=1"));
  check("קטגוריות זמינות", typeof cats.total === "number", `${cats.total} מודעות ברכב`);

  const catId = process.env.E2E_CATEGORY_ID;
  const attrs = await json(await call("seller", `/api/categories/${catId}/attributes`));
  check("נטענו שדות דינמיים", attrs.attributes?.length > 0, `${attrs.attributes?.length} שדות`);

  const byKey = Object.fromEntries((attrs.attributes ?? []).map((a) => [a.key, a]));
  const pick = (key, i = 0) => byKey[key]?.values?.[i]?.value;

  const title = `בדיקה אוטומטית ${stamp} טויוטה קורולה`;
  const published = await json(
    await call("seller", "/api/listings", {
      method: "POST",
      body: JSON.stringify({
        mode: "publish",
        data: {
          categoryId: catId,
          title,
          description:
            "מודעת בדיקה אוטומטית שנוצרה כחלק מבדיקת הקבלה של המערכת. הרכב במצב מצוין, טופל במוסך מורשה, ויש תיעוד מלא של כל הטיפולים.",
          price: 54000,
          isNegotiable: true,
          city: "תל אביב-יפו",
          neighborhood: "פלורנטין",
          contactPhone: seller.phone,
          contactName: "בודק",
          allowChat: true,
          images: [
            {
              url: "https://picsum.photos/seed/e2e-check/1200/900",
              thumbUrl: "https://picsum.photos/seed/e2e-check/400/300",
              blurhash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
              width: 1200,
              height: 900,
            },
          ],
          attributes: {
            manufacturer: "טויוטה",
            model: "טויוטה-קורולה",
            year: 2019,
            hand: "1",
            km: 78000,
            gearbox: pick("gearbox") ?? "אוטומטית",
            fuel: pick("fuel") ?? "בנזין",
          },
        },
      }),
    }),
  );
  check("המודעה פורסמה", Boolean(published.slug), published.slug ?? JSON.stringify(published));

  const listingId = published.id;
  const slug = published.slug;

  const itemRes = await call("seller", `/item/${encodeURIComponent(slug ?? "")}`);
  check("דף המודעה נטען", itemRes.status === 200, `HTTP ${itemRes.status}`);

  // 4 — מציאת המודעה בחיפוש עם פילטר דינמי
  console.log("\n4. חיפוש עם פילטרים");
  const q = encodeURIComponent(`בדיקה אוטומטית ${stamp}`);
  const found = await json(await call("seller", `/api/search?q=${q}`));
  check(
    "נמצאה בחיפוש חופשי",
    found.items?.some((i) => i.id === listingId),
    `${found.total} תוצאות`,
  );

  const gearbox = encodeURIComponent(pick("gearbox") ?? "אוטומטית");
  const filtered = await json(
    await call(
      "seller",
      `/api/search?category=vehicles&a_gearbox=${gearbox}&a_year_min=2018&priceMin=50000&priceMax=60000`,
    ),
  );
  check(
    "נמצאה עם פילטרים דינמיים (תיבה + שנה + מחיר)",
    filtered.items?.some((i) => i.id === listingId),
    `${filtered.total} תוצאות`,
  );

  // 5 — קונה: מועדפים והודעה למוכר
  console.log("\n5. קונה — מועדפים והודעה");
  const buyer = {
    name: `קונה בדיקה ${stamp}`,
    email: `e2e-buyer-${stamp}@example.com`,
    password: "Password123!",
  };
  await call("buyer", "/api/auth/register", {
    method: "POST",
    body: JSON.stringify(buyer),
  });
  const buyerLogin = await signIn("buyer", "password", {
    email: buyer.email,
    password: buyer.password,
  });
  check("הקונה מחובר", Boolean(buyerLogin.session?.user?.id));

  const fav = await json(
    await call("buyer", "/api/favorites", {
      method: "POST",
      body: JSON.stringify({ listingId }),
    }),
  );
  check("נשמר במועדפים", fav.favorited === true);
  const favIds = await json(await call("buyer", "/api/favorites"));
  check("מופיע ברשימת המועדפים", favIds.ids?.includes(listingId));

  const msg = await json(
    await call("buyer", "/api/messages", {
      method: "POST",
      body: JSON.stringify({ listingId, body: "היי, המודעה עדיין רלוונטית?" }),
    }),
  );
  check("נשלחה הודעה למוכר", Boolean(msg.conversationId));

  const thread = await json(
    await call("buyer", `/api/messages/${msg.conversationId ?? ""}`),
  );
  check("ההודעה נשמרה בשיחה", thread.messages?.length >= 1);

  // חשיפת טלפון
  const reveal = await json(
    await call("buyer", `/api/listings/${listingId}/reveal`, { method: "POST" }),
  );
  check("חשיפת מספר טלפון", Boolean(reveal.phone), reveal.phone);

  // 6 — צד המוכר רואה את השיחה
  console.log("\n6. המוכר רואה את הפנייה");
  const sellerThread = await json(
    await call("seller", `/api/messages/${msg.conversationId ?? ""}`),
  );
  check("המוכר ניגש לשיחה", sellerThread.messages?.length >= 1);
  const reply = await json(
    await call("seller", "/api/messages", {
      method: "PUT",
      body: JSON.stringify({
        conversationId: msg.conversationId,
        body: "היי, כן זמין. אפשר לתאם להיום בערב.",
      }),
    }),
  );
  check("המוכר השיב", Boolean(reply.message?.id));

  // 7 — אדמין
  console.log("\n7. פאנל ניהול");
  const adminLogin = await signIn("admin", "password", {
    email: "admin@shnatot.co.il",
    password: "Password123!",
  });
  check("מנהל מחובר", adminLogin.session?.user?.role === "ADMIN");

  const adminPage = await call("admin", "/admin");
  check("דף הניהול נטען", adminPage.status === 200, `HTTP ${adminPage.status}`);

  const adminListings = await call(
    "admin",
    `/admin/listings?q=${encodeURIComponent(String(stamp))}`,
  );
  const html = await adminListings.text();
  check("המודעה מופיעה בניהול", html.includes(String(stamp)), `HTTP ${adminListings.status}`);

  /*
   * דף המדידה.
   *
   * נבדק כאן ולא ב-`check:metrics` כי הבדיקה ההיא מכסה את החישוב בלבד.
   * מה שיכול להישבר בדף הוא הרינדור עצמו — שאילתה שנופלת בזמן ריצה
   * או טווח ריק שמחלק באפס — וזה נראה רק בבקשה אמיתית.
   */
  const metricsPage = await call("admin", "/admin/metrics?days=30");
  const metricsHtml = await metricsPage.text();
  check("דף המדידה נטען", metricsPage.status === 200, `HTTP ${metricsPage.status}`);
  check(
    "מדד הצפון והמשפך מוצגים",
    metricsHtml.includes("מדד הצפון") && metricsHtml.includes("חשיפת טלפון"),
  );

  // המגעים של הבדיקה עצמה נרשמו — חשיפת הטלפון וההודעה שנשלחו למעלה
  const metricsFresh = await call("admin", "/admin/metrics?days=7");
  check("המשפך רשם את המגעים של הריצה", (await metricsFresh.text()).includes("שיעור מענה"));

  // דיווח + מודרציה
  const report = await json(
    await call("buyer", "/api/reports", {
      method: "POST",
      body: JSON.stringify({
        listingId,
        reason: "FRAUD",
        details: "דיווח בדיקה אוטומטי",
      }),
    }),
  );
  check("נשלח דיווח", report.reported === true);

  const moderationPage = await call("admin", "/admin/moderation");
  const modHtml = await moderationPage.text();
  check("הדיווח מופיע בתור המודרציה", modHtml.includes(String(stamp)));

  const banned = await json(
    await call("admin", "/api/admin/moderate", {
      method: "POST",
      body: JSON.stringify({ listingId, action: "ban_listing" }),
    }),
  );
  check("המנהל הסיר את המודעה", banned.done === true);

  // 8 — הרשאות
  console.log("\n8. בקרת גישה");
  const anonAdmin = await call("anon", "/api/admin/moderate", {
    method: "POST",
    body: JSON.stringify({ listingId, action: "unban_listing" }),
  });
  check("אנונימי נחסם מ-API ניהול", anonAdmin.status === 401, `HTTP ${anonAdmin.status}`);

  const buyerAdmin = await call("buyer", "/api/admin/moderate", {
    method: "POST",
    body: JSON.stringify({ listingId, action: "unban_listing" }),
  });
  check("משתמש רגיל נחסם מ-API ניהול", buyerAdmin.status === 403, `HTTP ${buyerAdmin.status}`);

  const anonFav = await call("anon", "/api/favorites");
  check("מועדפים דורשים התחברות", anonFav.status === 401, `HTTP ${anonFav.status}`);

  const otherEdit = await json(
    await call("buyer", `/api/listings/${listingId}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "delete" }),
    }),
  );
  check("משתמש לא יכול למחוק מודעה של אחר", Boolean(otherEdit.error));

  console.log(
    `\n${failures === 0 ? "כל הבדיקות עברו" : `${failures} בדיקות נכשלו`}\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("בדיקת הקבלה קרסה:", err);
  process.exit(1);
});
