/**
 * English catalogue.
 *
 * Typed as `Messages`, so a key present in Hebrew and missing here is a
 * compile error rather than a blank label at runtime. See `he.ts`.
 */
import type { Messages } from "./he";

export const en: Messages = {
  /* --- site chrome ------------------------------------------------------- */
  "chrome.skipToContent": "Skip to main content",
  "chrome.publishListing": "Post a listing",
  "chrome.mainCategories": "Main categories",
  "chrome.mapView": "Map view",
  "chrome.categories": "Categories",
  "chrome.language": "Language",
  "chrome.chooseLanguage": "Choose interface language",

  /* --- footer ------------------------------------------------------------ */
  "footer.board": "The board",
  "footer.legal": "Legal",
  "footer.about": "About",
  "footer.priceIndex": "Price index",
  "footer.carGuide": "Car price guide",
  "footer.cityPrices": "Apartment prices",
  "footer.help": "Help and support",
  "footer.safety": "Safety guide",
  "footer.business": "Business solutions",
  "footer.terms": "Terms of use",
  "footer.privacy": "Privacy policy",
  "footer.accessibility": "Accessibility statement",
  "footer.cookies": "Cookie policy",
  "footer.rights": "All rights reserved.",
  "footer.builtIn": "Built in Israel · Accessible per Israeli Standard 5568 (WCAG 2.1 AA)",
};
