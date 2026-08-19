import { cookies, headers } from "next/headers";

export const LOCALES = ["nl", "en"];
export const DEFAULT_LOCALE = "nl";

// Bepaalt de taal voor de publieke pagina's (landing/login/contact): een handmatig
// gekozen taal (cookie) wint altijd; anders volgen we de browsertaal (Accept-Language).
export async function getLocale() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("locale")?.value;
  if (LOCALES.includes(cookieLocale)) return cookieLocale;

  const headerList = await headers();
  const acceptLanguage = headerList.get("accept-language") ?? "";
  return acceptLanguage.toLowerCase().startsWith("nl") ? "nl" : "en";
}

const dictionaries = {
  nl: {
    nav: { login: "Inloggen" },
    landing: {
      badge: "House of Digital · AI Transformatie Simulator",
      heroTitlePre: "Waar raakt AI",
      heroTitleHighlight: "jullie organisatie",
      heroTitlePost: "het eerst?",
      heroText:
        "Een gerichte simulatie op basis van jullie rollen, taken en sector — die laat zien welke functies verschuiven, welke competenties belangrijker worden, en waar het gesprek over automatisering het eerst gevoerd moet worden.",
      cta: "Neem contact op",
      resultsHeading: "Wat de simulatie",
      resultsHeadingHighlight: "oplevert",
      resultsSub: "Concreet, per rol, en met een organisatiebreed beeld — geen algemene AI-praatjes.",
      card1Title: "Per rol, concreet",
      card1Text:
        "Voor elke functie: welk deel van de taken automatiseerbaar is (realistisch en agressief scenario), en wat er aan menselijk werk overblijft.",
      card2Title: "Competentieverschuiving",
      card2Text:
        "Welke vaardigheden nu belangrijk zijn — en welke dat na de transformatie worden. Zo weet je waar om- en bijscholing het meeste verschil maakt.",
      card3Title: "Organisatiebreed beeld",
      card3Text:
        "Krimpende en groeiende rollen, kansen voor samenvoeging, en concrete aanbevelingen — inclusief een visueel voor/na-organogram.",
      howHeading: "Hoe het werkt",
      step1Title: "Roster & functieprofielen aanleveren",
      step1Text: "Jullie rollen met FTE, uren en kosten, plus de bijbehorende functieprofielen. Wij verzorgen de verwerking.",
      step2Title: "Positionering in de sector",
      step2Text: "Een korte set vragen over sectorrisico en -kans, en hoe klaar de organisatie is voor verandering.",
      step3Title: "Analyse & rapport",
      step3Text:
        "Binnen enkele dagen een rapport (Word/PDF) met bevindingen, aanbevelingen en een organogram — als vertrekpunt voor het gesprek, niet als eindoordeel.",
      disclaimer:
        "Deze simulatie geeft {richting}, geen exacte voorspelling — ze is bedoeld om de awareness-fase op gang te brengen. Het diepgaande consultancytraject volgt daarna.",
      disclaimerStrong: "richting",
      footerTagline: "AI Organisatie Transformatie Simulator — House of Digital",
    },
    login: {
      subtitle: "Intern — inloggen voor bureau-accounts",
      email: "E-mailadres",
      password: "Wachtwoord",
      error: "E-mailadres of wachtwoord onjuist.",
      submit: "Inloggen",
      submitting: "Inloggen...",
      forgot: "Wachtwoord vergeten?",
    },
    contact: {
      title: "Neem",
      titleHighlight: "contact",
      titlePost: "op",
      text: "Vertel kort waar jullie tegenaan lopen — we nemen zo snel mogelijk contact op.",
      sentTitle: "Bericht verstuurd",
      sentText: "Bedankt — we nemen zo snel mogelijk contact met je op.",
      name: "Naam",
      email: "E-mailadres",
      organisation: "Organisatie (optioneel)",
      message: "Bericht",
      submit: "Verstuur bericht",
      submitting: "Versturen...",
      fallbackError: "Versturen mislukt.",
    },
  },
  en: {
    nav: { login: "Log in" },
    landing: {
      badge: "House of Digital · AI Transformation Simulator",
      heroTitlePre: "Where does AI hit",
      heroTitleHighlight: "your organization",
      heroTitlePost: "first?",
      heroText:
        "A focused simulation based on your roles, tasks and sector — showing which roles are shifting, which competencies are becoming more important, and where the conversation about automation needs to start.",
      cta: "Get in touch",
      resultsHeading: "What the simulation",
      resultsHeadingHighlight: "delivers",
      resultsSub: "Concrete, per role, with an organization-wide view — no generic AI talk.",
      card1Title: "Per role, concrete",
      card1Text:
        "For every role: which share of the tasks is automatable (realistic and aggressive scenario), and what human work remains.",
      card2Title: "Competency shift",
      card2Text:
        "Which skills matter now — and which will matter after the transformation. So you know where reskilling makes the biggest difference.",
      card3Title: "Organization-wide view",
      card3Text:
        "Shrinking and growing roles, opportunities for consolidation, and concrete recommendations — including a visual before/after org chart.",
      howHeading: "How it works",
      step1Title: "Provide roster & role profiles",
      step1Text: "Your roles with FTE, hours and costs, plus the matching role profiles. We handle the processing.",
      step2Title: "Positioning within the sector",
      step2Text: "A short set of questions on sector risk and opportunity, and how ready the organization is for change.",
      step3Title: "Analysis & report",
      step3Text:
        "Within a few days, a report (Word/PDF) with findings, recommendations and an org chart — as a starting point for the conversation, not a final verdict.",
      disclaimer:
        "This simulation provides {richting}, not an exact prediction — it's meant to kick off the awareness phase. The in-depth consultancy trajectory follows after that.",
      disclaimerStrong: "direction",
      footerTagline: "AI Organization Transformation Simulator — House of Digital",
    },
    login: {
      subtitle: "Internal — login for agency accounts",
      email: "Email address",
      password: "Password",
      error: "Incorrect email address or password.",
      submit: "Log in",
      submitting: "Logging in...",
      forgot: "Forgot password?",
    },
    contact: {
      title: "Get in",
      titleHighlight: "touch",
      titlePost: "",
      text: "Briefly tell us what you're running into — we'll get back to you as soon as possible.",
      sentTitle: "Message sent",
      sentText: "Thanks — we'll be in touch as soon as possible.",
      name: "Name",
      email: "Email address",
      organisation: "Organization (optional)",
      message: "Message",
      submit: "Send message",
      submitting: "Sending...",
      fallbackError: "Failed to send.",
    },
  },
};

export function getDictionary(locale) {
  return dictionaries[LOCALES.includes(locale) ? locale : DEFAULT_LOCALE];
}
