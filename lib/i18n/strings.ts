/**
 * Interface strings for the farmer-facing flow, in English, Sinhala and Tamil
 * (Sri Lanka first, per the EU-first depth decision — adding a language is a
 * dictionary, not a code change).
 *
 * Scope is deliberate and honest: the wizard chrome, checklist labels and
 * disclaimers are translated as fixed strings below. The per-document guidance
 * text (what/why/how) and the generated documents themselves remain in English —
 * documents because customs authorities expect English, guidance because
 * machine-translating semi-legal text without review risks misleading a farmer.
 * That guidance translation is the LLM seam noted in DECISIONS D-014.
 */

export type Lang = "en" | "si" | "ta";

export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "si", label: "සිංහල" },
  { code: "ta", label: "தமிழ்" },
];

type Dict = Record<string, string>;

const en: Dict = {
  app_tagline:
    "Sell your harvest abroad, legally — and keep the margin. We tell you exactly which certifications and customs documents you need to export directly to the EU, UK, and US, and generate the ones we can.",
  sell_cta: "Sell your harvest →",
  sell_cta_sub: "Four questions. Get your documents checklist and shipping options.",
  also_here: "Also here",
  sell_title: "Sell your harvest abroad",
  sell_sub: "Answer four simple questions. We'll show you exactly which papers you need and make the ones we can.",
  q_product: "What do you grow?",
  q_product_free: "Or describe it in your own words",
  q_origin: "Where do you farm?",
  q_market: "Where do you want to sell?",
  q_details: "How much, and how is it sold?",
  qty_label: "Roughly how many kilograms?",
  organic_label: "I sell this as certified organic",
  show_btn: "Show me what I need",
  back: "← Back",
  start_over: "Start over",
  summary:
    "To sell {product} from {origin} to the {dest}, you need {total} documents — {self} you can make here, {auth} you request from an authority.",
  group_self: "You can create these now",
  group_authority: "Request these from an authority",
  tag_self: "you make it",
  tag_platform: "we make it",
  tag_authority: "an authority issues it",
  create_it: "Create it",
  prepare_draft: "Prepare draft",
  mark_done: "Mark as done",
  status_ready: "Done",
  status_in_progress: "In progress",
  status_not_started: "Not started",
  progress: "{ready} of {total} documents ready",
  shipping_title: "Shipping options",
  why: "Why:",
  how: "How:",
  basis: "Basis:",
  disclaimer:
    "This is guidance from a curated, sourced list — always confirm the exact requirements with the destination's authority before you ship. Rules change.",
  docs_in_english: "The documents themselves are generated in English — the language customs authorities expect.",
};

const si: Dict = {
  app_tagline:
    "ඔබේ අස්වැන්න නීත්‍යානුකූලව විදේශයට විකුණන්න — ලාභය ඔබ ළඟම තබාගන්න. EU, UK සහ US වෙත සෘජුවම අපනයනය කිරීමට අවශ්‍ය සහතික සහ රේගු ලේඛන මොනවාදැයි අපි නිවැරදිව කියමු, සෑදිය හැකි ඒවා අපි සාදමු.",
  sell_cta: "ඔබේ අස්වැන්න විකුණන්න →",
  sell_cta_sub: "ප්‍රශ්න හතරයි. ඔබට අවශ්‍ය ලේඛන ලැයිස්තුව සහ නැව්ගත කිරීමේ විකල්ප ලබාගන්න.",
  also_here: "තවත් මෙහි ඇත",
  sell_title: "ඔබේ අස්වැන්න විදේශයට විකුණන්න",
  sell_sub: "සරල ප්‍රශ්න හතරකට පිළිතුරු දෙන්න. ඔබට අවශ්‍ය ලේඛන මොනවාදැයි පෙන්වා, සෑදිය හැකි ඒවා අපි සාදමු.",
  q_product: "ඔබ වගා කරන්නේ මොනවාද?",
  q_product_free: "නැතහොත් ඔබේම වචනවලින් විස්තර කරන්න",
  q_origin: "ඔබ ගොවිතැන් කරන්නේ කොහේද?",
  q_market: "ඔබට විකුණන්න අවශ්‍ය කොහේද?",
  q_details: "කොපමණද, විකුණන්නේ කෙසේද?",
  qty_label: "දළ වශයෙන් කිලෝග්‍රෑම් කීයද?",
  organic_label: "මම මෙය සහතික කළ කාබනික ලෙස විකුණමි",
  show_btn: "මට අවශ්‍ය දේ පෙන්වන්න",
  back: "← ආපසු",
  start_over: "නැවත අරඹන්න",
  summary:
    "{origin} සිට {dest} වෙත {product} විකිණීමට ලේඛන {total} ක් අවශ්‍යයි — {self} ක් මෙහිදී සෑදිය හැක, {auth} ක් බලධාරියෙකුගෙන් ඉල්ලිය යුතුයි.",
  group_self: "මේවා ඔබට දැන් සෑදිය හැක",
  group_authority: "මේවා බලධාරියෙකුගෙන් ඉල්ලන්න",
  tag_self: "ඔබ සාදයි",
  tag_platform: "අපි සාදමු",
  tag_authority: "බලධාරියෙක් නිකුත් කරයි",
  create_it: "සාදන්න",
  prepare_draft: "කෙටුම්පත සාදන්න",
  mark_done: "අවසන් යැයි සලකුණු කරන්න",
  status_ready: "අවසන්",
  status_in_progress: "කරමින් පවතී",
  status_not_started: "ආරම්භ කර නැත",
  progress: "ලේඛන {total} න් {ready} ක් සූදානම්",
  shipping_title: "නැව්ගත කිරීමේ විකල්ප",
  why: "ඇයි:",
  how: "කෙසේද:",
  basis: "පදනම:",
  disclaimer:
    "මෙය මූලාශ්‍ර සහිත ලැයිස්තුවකින් ලබාදෙන මඟපෙන්වීමකි — නැව්ගත කිරීමට පෙර නිශ්චිත අවශ්‍යතා ගමනාන්තයේ බලධාරියාගෙන් සැමවිටම තහවුරු කරගන්න. නීති වෙනස් වේ.",
  docs_in_english: "ලේඛන ඉංග්‍රීසියෙන් සෑදේ — රේගු බලධාරීන් බලාපොරොත්තු වන භාෂාව එයයි.",
};

const ta: Dict = {
  app_tagline:
    "உங்கள் அறுவடையை சட்டப்படி வெளிநாட்டில் விற்கவும் — லாபத்தை நீங்களே வைத்திருங்கள். EU, UK, US சந்தைகளுக்கு நேரடியாக ஏற்றுமதி செய்யத் தேவையான சான்றிதழ்களும் சுங்க ஆவணங்களும் எவை என்று சரியாகச் சொல்கிறோம்; உருவாக்கக்கூடியவற்றை நாங்களே உருவாக்குகிறோம்.",
  sell_cta: "உங்கள் அறுவடையை விற்கவும் →",
  sell_cta_sub: "நான்கு கேள்விகள். உங்கள் ஆவணப் பட்டியலும் அனுப்புதல் வழிகளும் பெறுங்கள்.",
  also_here: "மேலும் இங்கே",
  sell_title: "உங்கள் அறுவடையை வெளிநாட்டில் விற்கவும்",
  sell_sub: "நான்கு எளிய கேள்விகளுக்கு பதிலளியுங்கள். உங்களுக்குத் தேவையான ஆவணங்களைக் காட்டி, முடிந்தவற்றை உருவாக்குகிறோம்.",
  q_product: "நீங்கள் என்ன பயிரிடுகிறீர்கள்?",
  q_product_free: "அல்லது உங்கள் சொந்த வார்த்தைகளில் விவரிக்கவும்",
  q_origin: "நீங்கள் எங்கு விவசாயம் செய்கிறீர்கள்?",
  q_market: "நீங்கள் எங்கு விற்க விரும்புகிறீர்கள்?",
  q_details: "எவ்வளவு, எப்படி விற்கப்படுகிறது?",
  qty_label: "தோராயமாக எத்தனை கிலோகிராம்?",
  organic_label: "இதை சான்றளிக்கப்பட்ட இயற்கை விளைபொருளாக விற்கிறேன்",
  show_btn: "எனக்கு என்ன தேவை என்று காட்டுங்கள்",
  back: "← பின்செல்",
  start_over: "மீண்டும் தொடங்கு",
  summary:
    "{origin} இலிருந்து {dest} க்கு {product} விற்க {total} ஆவணங்கள் தேவை — {self} இங்கே உருவாக்கலாம், {auth} அதிகாரியிடம் கோர வேண்டும்.",
  group_self: "இவற்றை நீங்கள் இப்போதே உருவாக்கலாம்",
  group_authority: "இவற்றை அதிகாரியிடம் கோருங்கள்",
  tag_self: "நீங்கள் உருவாக்குவது",
  tag_platform: "நாங்கள் உருவாக்குவது",
  tag_authority: "அதிகாரி வழங்குவது",
  create_it: "உருவாக்கு",
  prepare_draft: "வரைவு தயாரிக்க",
  mark_done: "முடிந்ததாகக் குறி",
  status_ready: "முடிந்தது",
  status_in_progress: "நடைபெறுகிறது",
  status_not_started: "தொடங்கவில்லை",
  progress: "{total} ஆவணங்களில் {ready} தயார்",
  shipping_title: "அனுப்புதல் வழிகள்",
  why: "ஏன்:",
  how: "எப்படி:",
  basis: "ஆதாரம்:",
  disclaimer:
    "இது மூலங்களுடன் தொகுக்கப்பட்ட பட்டியலின் வழிகாட்டுதல் — அனுப்பும் முன் சரியான தேவைகளை சேருமிட அதிகாரியிடம் எப்போதும் உறுதிப்படுத்துங்கள். விதிகள் மாறும்.",
  docs_in_english: "ஆவணங்கள் ஆங்கிலத்தில் உருவாக்கப்படும் — சுங்க அதிகாரிகள் எதிர்பார்க்கும் மொழி அதுவே.",
};

const DICTS: Record<Lang, Dict> = { en, si, ta };

/** Translate a key, falling back to English, with {slot} interpolation. */
export function t(lang: Lang, key: string, slots?: Record<string, string | number>): string {
  let s = DICTS[lang][key] ?? en[key] ?? key;
  if (slots) {
    for (const [k, v] of Object.entries(slots)) s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}
