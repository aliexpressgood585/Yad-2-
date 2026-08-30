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
  /* --- navigation --------------------------------------------------------- */
  "nav.openMenu": "Open menu",
  "nav.mainMenu": "Main navigation menu",
  "nav.moreLinks": "More links",
  "nav.publishFree": "Post a listing for free",
  "nav.advancedSearch": "Advanced search",
  "nav.favorites": "Favourites",
  "nav.savedSearches": "Saved searches",
  "nav.compare": "Compare listings",
  "nav.helpAndSafety": "Help and safety",
  "nav.myListings": "My listings",
  "nav.messages": "Messages",
  "nav.notifications": "Notifications",
  "nav.myProfile": "My profile",
  "nav.adminPanel": "Admin panel",

  /* --- bottom tab bar ----------------------------------------------------- */
  "tabBar.quickNav": "Quick navigation",
  "tabBar.home": "Home",
  "tabBar.search": "Search",
  "tabBar.publish": "Post",
  "tabBar.favorites": "Favourites",
  "tabBar.messages": "Messages",

  /* --- theme -------------------------------------------------------------- */
  "theme.choose": "Choose colour scheme",
  "theme.instrument": "Instrument face",
  "theme.day": "Day face",

  /* --- header search ------------------------------------------------------ */
  "search.listings": "Search listings",
  "search.placeholder": "What are you looking for? Car, flat, sofa…",
  "search.clear": "Clear search",
  "search.submit": "Search",

  /* --- user --------------------------------------------------------------- */
  "user.myMenu": "My menu",
  "user.anonymous": "User",
  "auth.login": "Log in",
  "auth.logout": "Log out",
};
