import type { InsertTransaction } from "@shared/schema";

// ─────────────────────────────────────────────────────────────────────────────
// Category Inference
// ─────────────────────────────────────────────────────────────────────────────

// Categories are checked in ORDER — first match wins.
// High-priority financial categories come first to prevent generic keywords
// like "transfer" or "payment" from matching in the wrong bucket.
const CATEGORY_KEYWORDS: Array<{ category: string; keywords: string[] }> = [
  // === HIGH-PRIORITY: Financial transaction types (must match first) ===
  {
    category: "Income",
    keywords: [
      "public partn-osv", "public partnerships", "payroll", "direct deposit",
      "salary", "wages", "paycheck", "cashreward", "cashback", "cash reward",
      "bankamerideals", "new checking",
    ],
  },
  {
    category: "Loan Repayment",
    keywords: [
      "cybrid-crobo", "cybrid", "crobo.mon", "remitly", "rmtly", "western union",
    ],
  },
  {
    category: "Payment",
    keywords: [
      "payment to crd", "payment to chase card", "applecard gsbank",
      "apple card", "online banking payment to crd",
      "mobile banking payment to crd", "online scheduled payment to crd",
      "loan_pmt", "payment thank you", "payment thank",
    ],
  },
  {
    category: "Investment",
    keywords: [
      "robinhood", "apple gs savings", "dub technologies", "dub partners",
    ],
  },
  {
    category: "Transfer",
    keywords: [
      "self transfer", "self account transfer", "self tranfer",
      "online banking transfer to sav", "agent assisted transfer from sav",
      "transfer to sav", "transfer from sav",
      "monthly service charge refund",
    ],
  },
  {
    category: "Taxes",
    keywords: [
      "irs", "usataxpymt", "tax payment", "state tax", "federal tax",
      "tax pymt", "treas tax", "us treas", "ftb", "eftps",
    ],
  },
  {
    category: "Bank Fees",
    keywords: [
      "monthly maintenance fee", "service charge", "overdraft fee",
      "atm fee", "wire fee", "account fee", "service fee",
    ],
  },
  {
    category: "Peer Payment",
    keywords: [
      "zelle payment", "zelle", "venmo", "paypal", "cash app", "quickpay",
    ],
  },
  {
    category: "Refund/Return",
    keywords: [
      "(return)", "dispute credit", "(dispute credit)",
      "annual hotel credit", "annual membership credit",
    ],
  },

  // === STANDARD: Spending categories ===
  {
    category: "Food & Dining",
    keywords: [
      "restaurant", "cafe", "coffee", "starbucks", "dunkin", "mcdonald", "burger",
      "pizza", "sushi", "taco", "chipotle", "subway", "wendy", "chick-fil", "kfc",
      "popeyes", "domino", "panera", "diner", "bistro", "grill", "kitchen",
      "doordash", "ubereats", "grubhub", "postmates", "seamless", "eatery",
      "boba", "smoothie", "juice bar", "bagel", "deli", "myflavorfiesta",
      "ullavacharu", "maylapore", "mylapore", "jamba", "tst*", "tst ",
      "samosa", "chaat", "cuisine", "ice cream", "bites*", "dhaba",
      "ramen", "pho", "noodle", "sushi bar", "izakaya", "dim sum",
    ],
  },
  {
    category: "Groceries",
    keywords: [
      "grocery", "groceries", "whole foods", "trader joe", "safeway", "kroger",
      "publix", "albertsons", "wegmans", "aldi", "costco", "sam's club", "bj's",
      "market", "supermarket", "food mart", "stop & shop", "giant", "meijer",
      "heb", "sprouts", "fresh market", "natural grocers", "apni mandi", "india bazar",
      "patel brothers", "desi brothers", "h mart", "99 ranch", "mitsuwa",
      "ralphs", "ambala", "indian gro", "five spice", "cash & carry",
    ],
  },
  {
    category: "Shopping",
    keywords: [
      "amazon", "walmart", "target", "best buy", "apple store", "nike", "adidas",
      "gap", "h&m", "zara", "nordstrom", "macy's", "kohls", "tj maxx", "marshalls",
      "ross", "old navy", "forever 21", "urban outfitters", "anthropologie",
      "pottery barn", "ikea", "wayfair", "etsy", "ebay", "shopify", "retail",
      "clothing", "apparel", "fashion", "shoes", "electronics", "ysi*ca",
      "uniqlo", "sennheiser", "soundcore", "bose", "sony store", "samsung store",
      "columbia sportswear", "patagonia", "rei ", "north face", "under armour",
    ],
  },
  {
    category: "Transportation",
    keywords: [
      "uber", "lyft", "taxi", "cab", "metro", "subway transit", "bus", "train",
      "amtrak", "mta", "bart", "transit", "parking", "toll", "expressway",
      "zipcar", "hertz", "enterprise", "avis", "budget rent", "car rental",
    ],
  },
  {
    category: "Gas & Fuel",
    keywords: [
      "shell", "chevron", "exxon", "mobil", "bp", "sunoco", "citgo", "marathon",
      "speedway", "wawa", "gas station", "fuel", "gasoline", "petrol", "76 gas",
      "circle k gas", "casey's", "arco", "valero", "love's", "pilot travel",
      "electrify america", "evgo", "chargepoint", "blink charging",
    ],
  },
  {
    category: "Entertainment",
    keywords: [
      "netflix", "hulu", "disney", "hbo", "spotify", "apple music", "youtube",
      "twitch", "steam", "playstation", "xbox", "nintendo", "movie", "theater",
      "cinema", "concert", "ticketmaster", "stub hub", "amc", "regal", "cinemark",
      "bowling", "arcade", "amusement", "museum", "zoo", "aquarium", "event",
      "hinge", "tinder", "bumble", "perplexity", "claude.ai", "openai", "anthropic",
      "phipps", "conservatory", "botanical", "planetarium", "pacific park",
    ],
  },
  {
    category: "Health & Fitness",
    keywords: [
      "gym", "planet fitness", "equinox", "24 hour fitness", "anytime fitness",
      "yoga", "pilates", "crossfit", "peloton", "doctor", "dentist", "pharmacy",
      "cvs", "walgreens", "rite aid", "hospital", "clinic", "urgent care",
      "medical", "health", "fitness", "wellness", "therapy", "prescription",
    ],
  },
  {
    category: "Travel",
    keywords: [
      "airline", "delta", "united", "american airlines", "southwest", "jetblue",
      "spirit", "frontier", "alaska airlines", "hotel", "marriott", "hilton",
      "hyatt", "sheraton", "holiday inn", "airbnb", "vrbo", "booking.com",
      "expedia", "kayak", "priceline", "travelocity", "flight", "airport",
      "rim village", "lodge", "resort", "inn ", "motel",
    ],
  },
  {
    category: "Bills & Utilities",
    keywords: [
      "electric", "electricity", "gas bill", "water bill", "internet", "cable",
      "comcast", "xfinity", "att", "t-mobile", "verizon", "sprint", "phone bill",
      "utility", "utilities", "pg&e", "con ed", "duke energy", "subscription",
      "insurance", "rent", "mortgage", "lease",
      "apple.com/bill", "apartment", "rps*",
    ],
  },
  {
    category: "Education",
    keywords: [
      "university", "college", "school", "tuition", "coursera", "udemy", "skillshare",
      "lynda", "pluralsight", "khan academy", "textbook", "bookstore", "library",
      "student", "education", "learning", "course", "class",
      "musesacademy", "muses academy", "ad*muses", "duolingo", "masterclass",
      "parchment", "transcript", "credential",
    ],
  },
  {
    category: "Personal Care",
    keywords: [
      "salon", "barber", "haircut", "spa", "nail", "beauty", "sephora", "ulta",
      "bath & body", "lush", "skincare", "cosmetics", "grooming",
    ],
  },
  {
    category: "Home",
    keywords: [
      "home depot", "lowe's", "ace hardware", "hardware", "furniture", "appliance",
      "plumber", "electrician", "contractor", "repairs", "cleaning",
      "lawn", "garden", "nursery",
    ],
  },
  {
    category: "Gifts & Donations",
    keywords: [
      "gift", "donation", "charity", "nonprofit", "goodwill", "red cross",
      "flowers", "temple", "templ ", "venkateswara", "tirupati", "mandir",
      "masjid", "mosque", "church", "synagogue", "gurdwara",
      "shirdi", "darbar", "dargah", "ashram", "wiwaha", "puja",
    ],
  },
  {
    category: "Business",
    keywords: [
      "office", "staples", "office depot", "fedex", "ups", "usps", "shipping",
      "postage", "software", "saas", "aws", "google cloud", "azure", "digital ocean",
      "github", "linkedin", "slack", "zoom", "dropbox", "adobe",
      "notary", "tag agency", "dmv", "secretary of state",
    ],
  },
];

/**
 * Infer the transaction category from description and merchant text.
 *
 * Special handling for Zelle self-transfers:  the description alone
 * doesn't always contain "self transfer" but we can detect transfers
 * between own accounts by checking for known name patterns.
 */
export function inferCategory(description: string, merchant?: string | null): string {
  const text = `${description} ${merchant ?? ""}`.toLowerCase();

  // --- Special Zelle self-transfer detection ---
  // Zelle transfers to/from the account holder's own name at another bank
  // Chase→BofA pattern: "Zelle payment to MITESH CHHATBAR JPM..."
  // BofA→Chase pattern: "Zelle payment from MITESH CHHATBAR BAC..."
  // These have type CHASE_TO_PARTNERFI / PARTNERFI_TO_CHASE which is also checked
  if (text.includes("zelle")) {
    // Check for "self transfer" annotation in the Zelle memo
    if (text.includes("self transfer") || text.includes("self account transfer") || text.includes("self tranfer")) {
      return "Transfer";
    }
    // Detect by account holder name — Zelle to/from own name at another bank
    // Covers: "Zelle payment to MITESH CHHATBAR ...", "Zelle payment from MITESH M CHHATBAR ..."
    if (text.includes("mitesh chhatbar") || text.includes("mitesh m chhatbar")) {
      return "Transfer";
    }
  }

  // --- Refund/Return detection ---
  // Descriptions with '(return)' suffix or 'dispute credit' → Refund/Return
  if (text.includes("(return)") || text.includes("dispute credit")) {
    return "Refund/Return";
  }

  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }

  return "Other";
}

// ─────────────────────────────────────────────────────────────────────────────
// Date Parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses various date formats and returns YYYY-MM-DD.
 * Handles: MM/DD/YYYY, MM/DD/YY, YYYY-MM-DD, M/D/YYYY
 */
export function parseDate(raw: string): string {
  const trimmed = raw.trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // MM/DD/YYYY or M/D/YYYY
  const slashFull = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashFull) {
    const [, m, d, y] = slashFull;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // MM/DD/YY
  const slashShort = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (slashShort) {
    const [, m, d, y] = slashShort;
    const fullYear = parseInt(y, 10) >= 50 ? `19${y}` : `20${y}`;
    return `${fullYear}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Fallback: return as-is and hope for the best
  return trimmed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Amount Parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strips $, commas, and whitespace; returns a float.
 */
export function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[$,\s]/g, "").trim();
  return parseFloat(cleaned) || 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV Line Parser (handles quoted fields with commas)
// ─────────────────────────────────────────────────────────────────────────────

export function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote inside quoted field
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current.trim());
  return fields;
}

// ─────────────────────────────────────────────────────────────────────────────
// Apple Card CSV Parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apple Card CSV columns:
 * Transaction Date, Clearing Date, Description, Merchant, Category, Type, Amount (USD)
 *
 * Type "Purchase" → negative (expense)
 * Type "Payment" or "Credit" → positive (income/credit)
 */
export function parseAppleCardCSV(
  csvContent: string,
  accountId: string
): InsertTransaction[] {
  const lines = csvContent.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
  const dateIdx = header.findIndex((h) => h.includes("transaction date"));
  const descIdx = header.findIndex((h) => h === "description");
  const merchantIdx = header.findIndex((h) => h === "merchant");
  const categoryIdx = header.findIndex((h) => h === "category");
  const typeIdx = header.findIndex((h) => h === "type");
  const amountIdx = header.findIndex((h) => h.includes("amount"));

  const transactions: InsertTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 4) continue;

    const rawDate = cols[dateIdx] ?? "";
    const description = cols[descIdx] ?? "";
    const merchant = cols[merchantIdx] ?? "";
    const csvCategory = cols[categoryIdx] ?? "";
    const type = cols[typeIdx] ?? "";
    const rawAmount = cols[amountIdx] ?? "0";

    if (!rawDate || !description) continue;

    const date = parseDate(rawDate);
    const absAmount = parseAmount(rawAmount);
    const lowerType = type.toLowerCase();

    // Determine sign: purchase = negative, payment/credit/debit = positive
    // "Debit" in Apple Card = Daily Cash Adjustment (cashback) = money coming to you
    let amount: number;
    if (lowerType === "payment" || lowerType === "credit" || lowerType === "debit") {
      amount = Math.abs(absAmount);
    } else {
      // Purchase or any other type
      amount = -Math.abs(absAmount);
    }

    // Normalize Apple Card's raw CSV categories → app standard categories
    // Apple uses different names ("Grocery", "Restaurants", "Insurance", etc.)
    const APPLE_CATEGORY_MAP: Record<string, string> = {
      "grocery": "Groceries",
      "groceries": "Groceries",
      "restaurants": "Food & Dining",
      "food & drink": "Food & Dining",
      "insurance": "Bills & Utilities",
      "medical": "Health & Fitness",
      "car-rentals": "Transportation",
      "transportation": "Transportation",
      "gas": "Gas & Fuel",
      "govt-services-parking": "Transportation",
      "shopping": "Shopping",
      "entertainment": "Entertainment",
      "education": "Education",
      "personal": "Personal Care",
      "business": "Business",
      "travel": "Travel",
      "payment": "Payment",
      "credit": "Refund/Return", // dispute credits cancel out original charges
      "debit": "Income",    // Daily Cash Adjustment (Apple cashback)
    };

    let category: string;
    const lowerCsvCat = csvCategory.toLowerCase();
    if (APPLE_CATEGORY_MAP[lowerCsvCat]) {
      category = APPLE_CATEGORY_MAP[lowerCsvCat];
    } else if (csvCategory && csvCategory !== "Other") {
      // Unknown Apple category — try keyword inference on description
      category = inferCategory(description, merchant);
    } else {
      category = inferCategory(description, merchant);
    }

    transactions.push({
      accountId,
      date,
      description,
      merchant: merchant || null,
      category,
      amount,
      type: lowerType === "payment" || lowerType === "credit" ? "credit" : "debit",
      originalDescription: description,
    });
  }

  return transactions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chase CSV Parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chase credit card columns:
 *   Transaction Date, Post Date, Description, Category, Type, Amount, Memo
 *
 * Chase checking columns:
 *   Details, Posting Date, Description, Amount, Type, Balance
 */
export function parseChaseCSV(
  csvContent: string,
  accountId: string
): InsertTransaction[] {
  const lines = csvContent.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());

  // Detect credit vs checking by header shape
  const isCreditCard = header.includes("transaction date") || header.includes("post date");
  const isChecking = header.includes("details") && header.includes("posting date");

  const transactions: InsertTransaction[] = [];

  if (isCreditCard) {
    const dateIdx = header.findIndex((h) => h.includes("transaction date"));
    const descIdx = header.findIndex((h) => h === "description");
    const categoryIdx = header.findIndex((h) => h === "category");
    const typeIdx = header.findIndex((h) => h === "type");
    const amountIdx = header.findIndex((h) => h === "amount");

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 4) continue;

      const rawDate = cols[dateIdx] ?? "";
      const description = cols[descIdx] ?? "";
      const csvCategory = cols[categoryIdx] ?? "";
      const type = cols[typeIdx] ?? "";
      const rawAmount = cols[amountIdx] ?? "0";

      if (!rawDate || !description) continue;

      const date = parseDate(rawDate);
      // Chase credit card: negative amounts are charges, positive are payments/returns
      const amount = parseAmount(rawAmount);
      const lowerType = type.toLowerCase();

      // Map Chase's native category names to app-standard names
      const CHASE_CC_CATEGORY_MAP: Record<string, string> = {
        "food & drink": "Food & Dining",
        "gas": "Gas & Fuel",
        "health & wellness": "Health & Fitness",
        "professional services": "Business",
        "personal": "Personal Care",
        "fees & adjustments": "Bank Fees",
        "automotive": "Transportation",
        "travel": "Travel",
        "shopping": "Shopping",
        "entertainment": "Entertainment",
        "education": "Education",
        "bills & utilities": "Bills & Utilities",
        "groceries": "Groceries",
        "home": "Home",
      };

      // Explicit return/adjustment detection — Chase labels these with Type=Return
      let category: string;
      if (lowerType === "return" || (lowerType === "adjustment" && amount > 0)) {
        category = "Refund/Return";
      } else {
        const mappedCategory = CHASE_CC_CATEGORY_MAP[csvCategory.toLowerCase()];
        category = mappedCategory ?? (csvCategory || inferCategory(description + " " + type));
      }

      transactions.push({
        accountId,
        date,
        description,
        merchant: null,
        category,
        amount,
        type: amount >= 0 ? "credit" : "debit",
        originalDescription: `${description} [${type}]`,
      });
    }
  } else if (isChecking) {
    const detailsIdx = header.findIndex((h) => h === "details");
    const dateIdx = header.findIndex((h) => h.includes("posting date"));
    const descIdx = header.findIndex((h) => h === "description");
    const amountIdx = header.findIndex((h) => h === "amount");
    const typeIdx = header.findIndex((h) => h === "type");

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 3) continue;

      const rawDate = cols[dateIdx] ?? "";
      const description = cols[descIdx] ?? "";
      const rawAmount = cols[amountIdx] ?? "0";
      const details = cols[detailsIdx] ?? "";
      const chaseType = cols[typeIdx] ?? "";

      if (!rawDate || !description) continue;

      const date = parseDate(rawDate);
      const amount = parseAmount(rawAmount);
      // Pass the Chase type (CHASE_TO_PARTNERFI, LOAN_PMT, etc.) into
      // categorization so self-transfers and card payments are detected.
      const category = inferCategory(description + " " + chaseType);

      transactions.push({
        accountId,
        date,
        description,
        merchant: null,
        category,
        amount,
        type: amount >= 0 ? "credit" : "debit",
        originalDescription: `${description} [${chaseType}]`,
      });
    }
  }

  return transactions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bank of America CSV Parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BofA standard columns:
 *   Date, Description, Amount, Running Bal.
 *
 * BofA payee format columns:
 *   Date, Reference Number, Payee, Address, Amount
 */
export function parseBankOfAmericaCSV(
  csvContent: string,
  accountId: string
): InsertTransaction[] {
  const lines = csvContent.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // BofA CSVs often have a summary section at the top before the actual
  // transaction header. Scan for the real header row that contains
  // the columns we need (Date, Description, Amount).
  let headerLineIdx = -1;
  let header: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const parsed = parseCSVLine(lines[i]).map((h) => h.toLowerCase().trim());
    // Look for a row that has "date" AND ("description" or "payee") AND "amount"
    const hasDate = parsed.some((h) => h === "date");
    const hasDesc = parsed.some((h) => h === "description" || h === "payee");
    const hasAmount = parsed.some((h) => h === "amount");
    if (hasDate && hasDesc && hasAmount) {
      headerLineIdx = i;
      header = parsed;
      break;
    }
  }

  // If we didn't find a proper header, fall back to line 0
  if (headerLineIdx === -1) {
    headerLineIdx = 0;
    header = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
  }

  const transactions: InsertTransaction[] = [];

  const hasPayee = header.includes("payee");
  const hasReference = header.includes("reference number");

  if (hasPayee && hasReference) {
    // Payee format: Date, Reference Number, Payee, Address, Amount
    const dateIdx = header.findIndex((h) => h === "date");
    const payeeIdx = header.findIndex((h) => h === "payee");
    const amountIdx = header.findIndex((h) => h === "amount");

    for (let i = headerLineIdx + 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 3) continue;

      const rawDate = cols[dateIdx] ?? "";
      const payee = cols[payeeIdx] ?? "";
      const rawAmount = cols[amountIdx] ?? "0";

      if (!rawDate || !payee) continue;

      const date = parseDate(rawDate);
      const amount = parseAmount(rawAmount);
      const category = inferCategory(payee);

      transactions.push({
        accountId,
        date,
        description: payee,
        merchant: payee || null,
        category,
        amount,
        type: amount >= 0 ? "credit" : "debit",
        originalDescription: payee,
      });
    }
  } else {
    // Standard format: Date, Description, Amount, Running Bal.
    const dateIdx = header.findIndex((h) => h === "date");
    const descIdx = header.findIndex((h) => h === "description");
    const amountIdx = header.findIndex((h) => h === "amount");

    for (let i = headerLineIdx + 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 3) continue;

      const rawDate = cols[dateIdx] ?? "";
      const description = cols[descIdx] ?? "";
      const rawAmount = cols[amountIdx] ?? "0";

      if (!rawDate || !description) continue;

      // Skip summary rows that don't have a valid date (e.g. "Beginning balance...")
      if (!/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(rawDate.trim())) continue;

      // Skip balance-annotation rows — they carry a date but are not transactions
      const descLow = description.toLowerCase();
      if (descLow.startsWith("beginning balance") || descLow.startsWith("ending balance")) continue;

      const date = parseDate(rawDate);
      const amount = parseAmount(rawAmount);
      const category = inferCategory(description);

      transactions.push({
        accountId,
        date,
        description,
        merchant: null,
        category,
        amount,
        type: amount >= 0 ? "credit" : "debit",
        originalDescription: description,
      });
    }
  }

  return transactions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Institution Auto-Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inspects the first two lines of a CSV to determine the issuing institution.
 */
export function detectInstitution(csvContent: string): string {
  // Scan a wider range of lines to handle BofA files that have
  // a multi-row summary section before the actual header row.
  const firstLines = csvContent.split("\n").slice(0, 10).join(" ").toLowerCase();

  if (
    firstLines.includes("transaction date") &&
    firstLines.includes("clearing date") &&
    firstLines.includes("merchant")
  ) {
    return "apple_card";
  }

  if (
    firstLines.includes("transaction date") &&
    firstLines.includes("post date") &&
    firstLines.includes("category")
  ) {
    return "chase";
  }

  if (
    firstLines.includes("details") &&
    firstLines.includes("posting date") &&
    firstLines.includes("balance")
  ) {
    return "chase";
  }

  if (firstLines.includes("reference number") && firstLines.includes("payee")) {
    return "bank_of_america_cc";
  }

  if (firstLines.includes("running bal")) {
    return "bank_of_america";
  }

  return "unknown";
}

// ─────────────────────────────────────────────────────────────────────────────
// Universal CSV Parser
// ─────────────────────────────────────────────────────────────────────────────

export function parseCSV(
  csvContent: string,
  accountId: string,
  institution?: string
): InsertTransaction[] {
  const inst = institution || detectInstitution(csvContent);

  switch (inst) {
    case "apple_card":
      return parseAppleCardCSV(csvContent, accountId);
    case "chase":
      return parseChaseCSV(csvContent, accountId);
    case "bank_of_america":
      return parseBankOfAmericaCSV(csvContent, accountId);
    case "bank_of_america_cc":
      return parseBofACreditCardCSV(csvContent, accountId);
    default: {
      // Try each parser in order and return whichever yields results
      const appleResult = parseAppleCardCSV(csvContent, accountId);
      if (appleResult.length > 0) return appleResult;

      const chaseResult = parseChaseCSV(csvContent, accountId);
      if (chaseResult.length > 0) return chaseResult;

      const boaResult = parseBankOfAmericaCSV(csvContent, accountId);
      if (boaResult.length > 0) return boaResult;

      const bofaCCResult = parseBofACreditCardCSV(csvContent, accountId);
      if (bofaCCResult.length > 0) return bofaCCResult;

      return [];
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BofA Credit Card CSV Parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses Bank of America Credit Card CSV exports.
 *
 * CSV columns:
 *   Posted Date, Reference Number, Payee, Address, Amount
 *
 * Amount sign convention:
 *   Positive = payments/credits (from checking → CC bill pay)
 *   Negative = purchases/charges
 *
 * "PAYMENT FROM CHK..." → Payment (excluded from income/expense)
 * "CASH REWARDS STATEMENT CREDIT" → Income (cashback)
 * Everything else negative → real expense
 */
function parseBofACreditCardCSV(
  csvContent: string,
  accountId: string
): InsertTransaction[] {
  const lines = csvContent.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
  const dateIdx = header.findIndex((h) => h.includes("posted date"));
  const payeeIdx = header.findIndex((h) => h === "payee");
  const addressIdx = header.findIndex((h) => h === "address");
  const amountIdx = header.findIndex((h) => h === "amount");

  if (dateIdx === -1 || payeeIdx === -1 || amountIdx === -1) return [];

  const transactions: InsertTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 3) continue;

    const rawDate = cols[dateIdx] ?? "";
    const payee = cols[payeeIdx] ?? "";
    const address = addressIdx >= 0 ? (cols[addressIdx] ?? "").trim() : "";
    const rawAmount = cols[amountIdx] ?? "0";

    if (!rawDate || !payee) continue;
    // Skip rows without a valid date
    if (!/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(rawDate.trim())) continue;

    const date = parseDate(rawDate);
    const amount = parseAmount(rawAmount);
    const lowerPayee = payee.toLowerCase();

    // Categorize
    let category: string;
    if (lowerPayee.includes("payment from chk") || lowerPayee.includes("payment from sav")) {
      // Bill payments from checking/savings → excluded
      category = "Payment";
    } else if (lowerPayee.includes("cash rewards") || lowerPayee.includes("statement credit")) {
      // Cashback statement credits reduce what you owe — not real income
      category = "Refund/Return";
    } else if (amount > 0) {
      // Any other positive amount on a CC = merchant refund/return
      category = "Refund/Return";
    } else {
      // Normal purchase — use keyword inference
      const fullText = address ? `${payee} ${address}` : payee;
      category = inferCategory(fullText);
    }

    // Build description: "PAYEE — CITY STATE" or just "PAYEE"
    const description = address ? `${payee} — ${address}`.trim() : payee;

    transactions.push({
      accountId,
      date,
      description,
      merchant: payee || null,
      category,
      amount,
      type: amount >= 0 ? "credit" : "debit",
      originalDescription: payee,
    });
  }

  return transactions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Apple Card PDF Parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses Apple Card PDF text.
 *
 * The PDF has two sections: "Payments" and "Transactions".
 * In the extracted text, transaction entries can span multiple lines:
 *   - A line starting with MM/DD/YYYY begins a new entry
 *   - Continuation lines (no date prefix) are appended to the current entry
 * The LAST dollar amount in the joined entry is the transaction amount.
 * Amounts prefixed with "-$" are negative.
 * Lines in "Payments" section → positive (credit).
 * Lines in "Transactions" section → negative (debit).
 * "(DISPUTE CREDIT)" entries → positive (credit/refund).
 */
function parseAppleCardPDF(text: string, accountId: string): InsertTransaction[] {
  const transactions: InsertTransaction[] = [];
  const lines = text.split("\n");

  let section: "payments" | "transactions" | null = null;

  // Date pattern that starts a new transaction line
  const datePrefix = /^(\d{2}\/\d{2}\/\d{4})\s+/;

  // First pass: detect sections and join multi-line entries
  // Each entry object holds the raw date, section, and the full joined text
  const entries: Array<{ rawDate: string; section: "payments" | "transactions"; text: string }> = [];

  // Lines to skip (summary/header/footer lines and non-transaction continuations)
  const skipPatterns = [
    /^total\s/i,
    /^date\s+description/i,
    /^if you/i,
    /^page\s+\d/i,
    /^apple card/i,
    /^statement$/i,
    /^--\s*\d+\s+of\s+\d+\s*--$/i,
    /daily cash at\s/i,
    /^interest\s/i,
    /^legal$/i,
    /^how\s/i,
    /^see\s+your/i,
    /^billing/i,
    /^what\s/i,
    /^goldman sachs/i,
    /^lockbox/i,
    /^p\.o\./i,
    /^in your letter/i,
    /^you must/i,
    /^while we/i,
    /^we cannot/i,
    /^the charge/i,
    /^your rights/i,
    /^to use this/i,
    /^\d+\.\s+/,
    /^contact\s+us/i,
    /^we may\s/i,
    /^we credit/i,
    /^variable\s+apr/i,
    /^the\s+"prime/i,
    /^you may\s/i,
    /^when will/i,
    /^do you\s/i,
    /^previous\s/i,
    /^account\s+information/i,
    /^new york/i,
    /^minimum$/i,
    /^payment$/i,
    /^due by$/i,
    /^as of\s/i,
    /^please\s/i,
    /^annual\s/i,
    /^balance\s+subject/i,
    /^daily cash$/i,
    /\w+@\w+\.\w+/,
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d/i,
    /^\w+\s+\w+,\s+\w+@/,
  ];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Detect section headers
    const lower = line.toLowerCase();
    if (lower === "payments" || lower.startsWith("payments\n") || (lower === "payments" || /^payments$/i.test(line))) {
      section = "payments";
      continue;
    }
    if (lower === "transactions" || /^transactions$/i.test(line)) {
      section = "transactions";
      continue;
    }

    // Also detect section headers with trailing content like "Date Description ..."
    if (lower.startsWith("payments") && lower.includes("date")) {
      section = "payments";
      continue;
    }
    if (lower.startsWith("transactions") && lower.includes("date")) {
      section = "transactions";
      continue;
    }

    if (!section) continue;

    // Terminate transaction collection at known non-transaction sections
    if (
      /^interest\s+charged/i.test(line) ||
      /^interest\s+charges/i.test(line) ||
      /^interest\s+charge\s+calculation/i.test(line) ||
      lower === "legal" ||
      lower === "daily cash" ||
      /^daily cash$/i.test(line) ||
      /^billing rights/i.test(line) ||
      /^your \w+ balance/i.test(line)
    ) {
      section = null;
      continue;
    }

    // Skip summary/header/footer lines
    if (skipPatterns.some((p) => p.test(line))) continue;

    // Check if this line starts a new transaction (begins with a date)
    const dateMatch = line.match(datePrefix);
    if (dateMatch) {
      const rawDate = dateMatch[1];
      const rest = line.slice(dateMatch[0].length);
      entries.push({ rawDate, section, text: rest });
    } else if (entries.length > 0) {
      // Continuation line — append to the previous entry
      // Skip lines that are purely "Daily Cash at ..." sub-lines (percentage lines)
      const lastEntry = entries[entries.length - 1];
      lastEntry.text += " " + line;
    }
  }

  // Second pass: parse each joined entry
  for (const entry of entries) {
    const date = parseDate(entry.rawDate);
    const fullText = entry.text;

    // Extract all dollar amounts (with optional negative sign)
    const amountRegex = /-?\$[\d,]+\.\d{2}/g;
    const amounts: { value: number; raw: string }[] = [];
    let amtMatch: RegExpExecArray | null;
    while ((amtMatch = amountRegex.exec(fullText)) !== null) {
      const raw = amtMatch[0];
      const isNeg = raw.startsWith("-");
      const numStr = raw.replace(/[-$,]/g, "");
      const val = parseFloat(numStr) * (isNeg ? -1 : 1);
      amounts.push({ value: val, raw });
    }

    // If no amounts with $, try without $ sign
    if (amounts.length === 0) {
      const fallbackRegex = /-?[\d,]+\.\d{2}/g;
      while ((amtMatch = fallbackRegex.exec(fullText)) !== null) {
        const raw = amtMatch[0];
        const isNeg = raw.startsWith("-");
        const numStr = raw.replace(/[-,]/g, "");
        const val = parseFloat(numStr) * (isNeg ? -1 : 1);
        amounts.push({ value: val, raw });
      }
    }

    if (amounts.length === 0) continue;

    // The LAST dollar amount is the transaction amount
    const txAmount = amounts[amounts.length - 1].value;

    // Strip ALL dollar amounts and percentage indicators from the description
    let description = fullText
      .replace(/-?\$[\d,]+\.\d{2}/g, "")  // remove dollar amounts
      .replace(/\d+%/g, "")                // remove percentage indicators
      .replace(/\s+/g, " ")               // collapse whitespace
      .trim();

    // Remove "Daily Cash at ..." appended sub-text
    description = description.replace(/\s*Daily Cash at\s+\w+.*/i, "").trim();

    if (!description) continue;

    // Determine the sign of the transaction
    const isDisputeCredit = description.toLowerCase().includes("dispute credit");
    const isDailyCash = description.toLowerCase().includes("daily cash");

    let amount: number;
    if (entry.section === "payments") {
      // Payments are credits (positive); they often appear as -$5.00 in the PDF
      // but represent money paid toward the balance (credit to account)
      amount = Math.abs(txAmount);
    } else if (isDisputeCredit) {
      // Dispute credits are refunds → positive
      amount = Math.abs(txAmount);
    } else if (isDailyCash) {
      // Daily Cash adjustments are credits
      amount = Math.abs(txAmount);
    } else {
      // Regular transactions are charges → negative
      amount = -Math.abs(txAmount);
    }

    const category = isDailyCash
      ? "Other"
      : entry.section === "payments"
        ? "Payment"
        : inferCategory(description);

    transactions.push({
      accountId,
      date,
      description,
      merchant: null,
      category,
      amount,
      type: amount >= 0 ? "credit" : "debit",
      originalDescription: `${entry.rawDate} ${fullText}`,
    });
  }

  return transactions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic PDF Parser (Chase / Bank of America)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generic PDF parser for Chase and BofA.
 * Matches lines that start with a date pattern and end with a dollar amount.
 */
function parseGenericPDF(text: string, accountId: string): InsertTransaction[] {
  const transactions: InsertTransaction[] = [];
  const lines = text.split("\n");

  // Match lines starting with MM/DD or MM/DD/YYYY and ending with an amount
  const lineRegex = /^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})$/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(lineRegex);
    if (!match) continue;

    const [, rawDate, description, rawAmount] = match;

    const date = parseDate(rawDate);
    const amount = parseAmount(rawAmount);
    const category = inferCategory(description);

    if (!description) continue;

    transactions.push({
      accountId,
      date,
      description: description.trim(),
      merchant: null,
      category,
      amount,
      type: amount >= 0 ? "credit" : "debit",
      originalDescription: line,
    });
  }

  return transactions;
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF Text Router
// ─────────────────────────────────────────────────────────────────────────────

export function parsePDFText(
  text: string,
  accountId: string,
  institution: string
): InsertTransaction[] {
  if (institution === "apple_card") {
    return parseAppleCardPDF(text, accountId);
  }

  // For Chase, BofA, or unknown: use Apple Card parser if it looks like Apple Card
  const lowerText = text.toLowerCase();
  if (
    lowerText.includes("apple card") ||
    (lowerText.includes("payments") && lowerText.includes("daily cash"))
  ) {
    return parseAppleCardPDF(text, accountId);
  }

  // Fall back to generic parser for Chase / BofA
  return parseGenericPDF(text, accountId);
}
