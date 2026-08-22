/**
 * Keyword mappings for deterministic invoice categorization.
 * Used by CategorizationService for rule-based classification.
 */

export const CATEGORIZATION_KEYWORDS: Record<
  string,
  {
    primary: string[];
    secondary: string[];
    tertiary: string[];
    negative: string[];
  }
> = {
  "IT Equipment": {
    primary: [
      "laptop",
      "desktop",
      "server",
      "monitor",
      "keyboard",
      "mouse",
      "printer",
      "scanner",
      "webcam",
      "microphone",
      "headphones",
      "router",
      "switch",
      "firewall",
      "nas",
      "storage",
      "it equipment"
    ],
    secondary: [
      "computer",
      "workstation",
      "screen",
      "display",
      "peripheral",
      "hardware",
      "device",
      "equipment"
    ],
    tertiary: ["tech", "it", "compute", "network", "infrastructure"],
    negative: ["software", "license", "subscription", "cloud", "service"]
  },

  "Software / SaaS": {
    primary: [
      "software",
      "saas",
      "license",
      "subscription",
      "cloud",
      "api",
      "application",
      "tool",
      "platform",
      "service",
      "account",
      "azure",
      "aws",
      "gcp",
      "slack",
      "microsoft 365",
      "office 365",
      "salesforce",
      "jira",
      "confluence",
      "github"
    ],
    secondary: [
      "app",
      "program",
      "solution",
      "system",
      "management",
      "automation",
      "integration"
    ],
    tertiary: ["digital", "online", "virtual", "computing"],
    negative: ["hardware", "equipment", "device", "physical"]
  },

  "Office Supplies": {
    primary: [
      "stationery",
      "paper",
      "ink",
      "cartridge",
      "toner",
      "pen",
      "pencil",
      "notebook",
      "folder",
      "file",
      "desk",
      "chair",
      "cabinet",
      "office supplies",
      "supplies"
    ],
    secondary: [
      "writing",
      "printing",
      "document",
      "storage",
      "furniture",
      "workspace"
    ],
    tertiary: ["material", "item", "product", "goods"],
    negative: ["software", "technology", "equipment", "service"]
  },

  "Travel": {
    primary: [
      "travel",
      "hotel",
      "flight",
      "airline",
      "accommodation",
      "cab",
      "taxi",
      "uber",
      "train",
      "bus",
      "rental",
      "car rental",
      "airport",
      "airbnb",
      "booking.com"
    ],
    secondary: [
      "transportation",
      "lodging",
      "booking",
      "reservation",
      "journey",
      "trip"
    ],
    tertiary: ["transit", "mobility", "logistics"],
    negative: ["software", "subscription", "office", "equipment"]
  },

  "Professional Services": {
    primary: [
      "consulting",
      "consultant",
      "agency",
      "professional",
      "services",
      "legal",
      "accounting",
      "audit",
      "advisory",
      "training",
      "coaching",
      "contractor",
      "freelance",
      "developer",
      "designer"
    ],
    secondary: [
      "expert",
      "specialist",
      "service provider",
      "firm",
      "consultancy"
    ],
    tertiary: ["support", "assistance", "expertise"],
    negative: ["product", "goods", "equipment", "supplies"]
  },

  "Utilities": {
    primary: [
      "utility",
      "electricity",
      "power",
      "water",
      "gas",
      "internet",
      "broadband",
      "phone",
      "mobile",
      "telecom",
      "utility bill",
      "electricity bill",
      "water bill",
      "power bill"
    ],
    secondary: [
      "utility services",
      "service provider",
      "subscription",
      "monthly charge"
    ],
    tertiary: ["recurring", "essential", "basic"],
    negative: ["equipment", "software", "supplies", "professional"]
  },

  "Maintenance": {
    primary: [
      "maintenance",
      "repair",
      "service",
      "cleaning",
      "maintenance service",
      "repairs",
      "upkeep",
      "preventive",
      "amc",
      "annual maintenance"
    ],
    secondary: [
      "technician",
      "mechanic",
      "servicing",
      "inspection",
      "fix"
    ],
    tertiary: ["support", "assistance", "care"],
    negative: ["equipment", "supplies", "software", "purchase"]
  },

  "Marketing": {
    primary: [
      "marketing",
      "advertisement",
      "ad",
      "campaign",
      "branding",
      "social media",
      "facebook",
      "instagram",
      "google ads",
      "seo",
      "content",
      "promotional",
      "promotion",
      "sponsorship",
      "event"
    ],
    secondary: [
      "advertising",
      "creative",
      "design",
      "digital marketing",
      "communications"
    ],
    tertiary: ["brand", "visibility", "engagement"],
    negative: ["software", "equipment", "office", "professional"]
  },

  "Other": {
    primary: [],
    secondary: [],
    tertiary: [],
    negative: []
  }
};

/**
 * GL Account mapping for each category (for ERP integration).
 */
export const CATEGORY_GL_MAPPING: Record<string, string> = {
  "IT Equipment": "6050",
  "Software / SaaS": "6060",
  "Office Supplies": "6010",
  "Travel": "6020",
  "Professional Services": "6070",
  "Utilities": "6030",
  "Maintenance": "6040",
  "Marketing": "6080",
  "Other": "6090"
};
