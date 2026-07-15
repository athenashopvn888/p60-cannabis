export const runtime = "nodejs";

const APPLICATION_HEADERS = [
  "ApplicationId",
  "SubmittedAt",
  "StoreKey",
  "StoreName",
  "Role",
  "SourcePage",
  "Status",
  "Reviewer",
  "ReviewedAt",
  "ApplicantName",
  "PreferredName",
  "Email",
  "Phone",
  "CityArea",
  "PhotoUrl",
  "PhotoFileName",
  "EmploymentType",
  "Availability",
  "LateShiftAvailability",
  "EarliestStartDate",
  "RetailExperience",
  "CannabisInterest",
  "CashHandlingExperience",
  "ProductComfort",
  "Motivation",
  "Determination",
  "CustomerFitScenario",
  "TeamworkScenario",
  "WhyQLC",
  "TransportationReliability",
  "ResumeUrl",
  "PortfolioUrl",
  "ConsentToContact",
  "PrivacyConsent",
  "Notes",
] as const;

const REQUIRED_FIELDS = [
  "ApplicantName",
  "Email",
  "Phone",
  "Role",
  "EmploymentType",
  "Availability",
  "LateShiftAvailability",
  "EarliestStartDate",
  "RetailExperience",
  "Motivation",
  "Determination",
  "CustomerFitScenario",
  "TeamworkScenario",
  "WhyQLC",
  "TransportationReliability",
  "ConsentToContact",
  "PrivacyConsent",
];

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const ALLOWED_PHOTO_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function clean(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(clean).filter(Boolean).join(", ");
  }
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function cleanPhotoPayload(body: Record<string, unknown>) {
  const photoDataBase64 = clean(body.PhotoDataBase64);
  const photoFileName = clean(body.PhotoFileName);
  const photoMimeType = clean(body.PhotoMimeType);

  if (!photoDataBase64) return { error: "A clear selfie photo is required before submitting." };

  const normalizedMimeType = photoMimeType || "image/jpeg";
  if (!ALLOWED_PHOTO_MIME_TYPES.has(normalizedMimeType)) {
    return { error: "Photo must be a JPG, PNG, or WebP image." };
  }

  const padding = photoDataBase64.endsWith("==") ? 2 : photoDataBase64.endsWith("=") ? 1 : 0;
  const byteLength = Math.floor((photoDataBase64.length * 3) / 4) - padding;
  if (byteLength > MAX_PHOTO_BYTES) {
    return { error: "Photo must be under 4 MB." };
  }

  return {
    data: {
      PhotoDataBase64: photoDataBase64,
      PhotoFileName: photoFileName || "application-photo.jpg",
      PhotoMimeType: normalizedMimeType,
    },
  };
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

function makeApplicationId(storeKey: string) {
  const prefix = clean(storeKey) || "STORE";
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function normalizeApplication(body: Record<string, unknown>) {
  const normalized: Record<string, string> = {};
  for (const header of APPLICATION_HEADERS) {
    normalized[header] = clean(body[header]);
  }

  normalized.StoreKey = "PNY01";
  normalized.StoreName = "P60 Cannabis";
  normalized.Role = normalized.Role || "Budtender";
  normalized.SourcePage = normalized.SourcePage || "/careers/budtender";
  normalized.ApplicationId = normalized.ApplicationId || makeApplicationId(normalized.StoreKey);
  normalized.SubmittedAt = normalized.SubmittedAt || new Date().toISOString();
  normalized.Status = normalized.Status || "New";

  return normalized;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    const parsed = await request.json();
    body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return jsonResponse({ ok: false, error: "Invalid application payload." }, 400);
  }

  const missing = REQUIRED_FIELDS.filter((field) => !clean(body[field]));
  if (missing.length) {
    return jsonResponse(
      { ok: false, error: `Missing required fields: ${missing.join(", ")}` },
      400,
    );
  }

  if (clean(body.ConsentToContact) !== "I agree" || clean(body.PrivacyConsent) !== "I agree") {
    return jsonResponse({ ok: false, error: "Consent is required before submitting." }, 400);
  }

  const photoPayload = cleanPhotoPayload(body);
  if ("error" in photoPayload) {
    return jsonResponse({ ok: false, error: photoPayload.error }, 400);
  }

  const normalized = normalizeApplication(body);
  Object.assign(normalized, photoPayload.data);

  if (process.env.BUDTENDER_APPLICATION_DEMO === "true") {
    return jsonResponse({
      ok: true,
      preview: true,
      applicationId: normalized.ApplicationId,
    });
  }

  const endpoint =
    process.env.ATHENA_HIRING_SUBMIT_ENDPOINT ||
    process.env.NEXT_PUBLIC_ATHENA_HIRING_SUBMIT_ENDPOINT ||
    process.env.ATHENA_APPLICATION_ENDPOINT ||
    process.env.BUDTENDER_APPLICATION_ENDPOINT ||
    process.env.NEXT_PUBLIC_ATHENA_APPLICATION_ENDPOINT ||
    process.env.NEXT_PUBLIC_BUDTENDER_APPLICATION_ENDPOINT;

  if (!endpoint) {
    return jsonResponse(
      { ok: false, error: "Application endpoint is not configured yet." },
      503,
    );
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(normalized),
      cache: "no-store",
    });

    const text = await response.text();
    let endpointResult: { ok?: boolean; error?: string } = {};
    try {
      endpointResult = text ? JSON.parse(text) : {};
    } catch {
      endpointResult = {};
    }

    if (!response.ok || endpointResult.ok === false) {
      const detail = endpointResult.error || text || `Status ${response.status}`;
      return jsonResponse({ ok: false, error: `Application storage failed: ${detail}` }, 502);
    }

    return jsonResponse({ ok: true, applicationId: normalized.ApplicationId });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Application storage failed.",
      },
      502,
    );
  }
}
