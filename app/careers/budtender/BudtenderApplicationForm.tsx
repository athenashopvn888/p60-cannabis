"use client";

import { FormEvent, useState } from "react";
import styles from "./budtender.module.css";

const availabilityOptions = [
  "Weekdays",
  "Weeknights",
  "Weekends",
  "Opening shifts",
  "Closing shifts",
  "Flexible",
];

const productOptions = [
  "Flower",
  "Pre-rolls",
  "Vapes",
  "Edibles",
  "Concentrates",
  "Accessories",
  "Still learning",
];

type SubmitState = "idle" | "sending" | "success" | "error";
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const allowedPhotoTypes = ["image/jpeg", "image/png", "image/webp"];

const requiredFields = [
  { name: "ApplicantName", label: "Full legal name" },
  { name: "Email", label: "Email" },
  { name: "Phone", label: "Phone" },
  { name: "Role", label: "Applying for" },
  { name: "EmploymentType", label: "Role type" },
  { name: "EarliestStartDate", label: "Earliest start date" },
  { name: "LateShiftAvailability", label: "Late-shift availability" },
  { name: "RetailExperience", label: "Retail, customer service, or sales experience" },
  { name: "Motivation", label: "What motivates you" },
  { name: "Determination", label: "Determination example" },
  { name: "CustomerFitScenario", label: "How you would help a guest" },
  { name: "TeamworkScenario", label: "Team energy answer" },
  { name: "WhyQLC", label: "Why you want to work at P60 Cannabis" },
  { name: "TransportationReliability", label: "Transportation reliability" },
  { name: "ConsentToContact", label: "Consent to be contacted" },
  { name: "PrivacyConsent", label: "Hiring response consent" },
];

function collectChecked(formData: FormData, name: string) {
  return formData.getAll(name).map(String).filter(Boolean).join(", ");
}

function valueFrom(formData: FormData, name: string) {
  return String(formData.get(name) || "").trim();
}

function inputFrom(form: HTMLFormElement, name: string) {
  const item = form.elements.namedItem(name);
  return item instanceof HTMLInputElement || item instanceof HTMLTextAreaElement || item instanceof HTMLSelectElement
    ? item
    : null;
}

function missingApplicationItems(form: HTMLFormElement, formData: FormData, availability: string, photo: FormDataEntryValue | null) {
  const missing = requiredFields
    .filter((field) => !valueFrom(formData, field.name))
    .map((field) => field.label);

  if (!availability) missing.push("At least one availability option");
  if (!(photo instanceof File) || photo.size <= 0) missing.push("Clear selfie photo");

  const email = inputFrom(form, "Email");
  if (valueFrom(formData, "Email") && email?.validity.typeMismatch) {
    missing.push("A valid email address");
  }

  const resume = inputFrom(form, "ResumeUrl");
  if (valueFrom(formData, "ResumeUrl") && resume?.validity.typeMismatch) {
    missing.push("A valid resume link");
  }

  const profile = inputFrom(form, "PortfolioUrl");
  if (valueFrom(formData, "PortfolioUrl") && profile?.validity.typeMismatch) {
    missing.push("A valid LinkedIn, portfolio, or social profile link");
  }

  return [...new Set(missing)];
}

function readPhoto(file: File) {
  return new Promise<{ PhotoDataBase64: string; PhotoFileName: string; PhotoMimeType: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",")[1] : "";
      if (!base64) {
        reject(new Error("Photo could not be read."));
        return;
      }
      resolve({
        PhotoDataBase64: base64,
        PhotoFileName: file.name,
        PhotoMimeType: file.type || "image/jpeg",
      });
    };
    reader.onerror = () => reject(new Error("Photo could not be read."));
    reader.readAsDataURL(file);
  });
}

export default function BudtenderApplicationForm() {
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const [missingItems, setMissingItems] = useState<string[]>([]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const availability = collectChecked(formData, "Availability");
    const productComfort = collectChecked(formData, "ProductComfort");
    const photo = formData.get("PhotoFile");

    const missing = missingApplicationItems(form, formData, availability, photo);
    if (missing.length) {
      setSubmitState("error");
      setMissingItems(missing);
      setMessage(`Please complete ${missing.length === 1 ? "this item" : "these items"} and try again.`);
      return;
    }

    if (photo instanceof File && photo.size > 0) {
      if (!allowedPhotoTypes.includes(photo.type)) {
        setSubmitState("error");
        setMissingItems(["Use a JPG, PNG, or WebP selfie photo."]);
        setMessage("Please fix the selfie photo and try again.");
        return;
      }
      if (photo.size > MAX_PHOTO_BYTES) {
        setSubmitState("error");
        setMissingItems(["Selfie photo must be under 4 MB."]);
        setMessage("Please fix the selfie photo and try again.");
        return;
      }
    }

    const payload = Object.fromEntries(formData.entries()) as Record<string, FormDataEntryValue>;
    delete payload.PhotoFile;
    payload.Availability = availability;
    payload.ProductComfort = productComfort;

    setSubmitState("sending");
    setMessage("Sending your application...");
    setMissingItems([]);

    try {
      if (photo instanceof File && photo.size > 0) {
        Object.assign(payload, await readPhoto(photo));
      }

      const response = await fetch("/api/careers/budtender", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Application could not be submitted.");
      }

      form.reset();
      setSubmitState("success");
      setMissingItems([]);
      setMessage(
        result.preview
          ? `Preview received. Reference: ${result.applicationId}. No sheet row was created.`
          : `Application received. Reference: ${result.applicationId}`,
      );
    } catch (error) {
      setSubmitState("error");
      setMissingItems([]);
      setMessage(error instanceof Error ? error.message : "Application could not be submitted.");
    }
  }

  return (
    <form className={styles.applicationForm} onSubmit={handleSubmit} noValidate>
      <input type="hidden" name="StoreKey" value="PNY01" />
      <input type="hidden" name="StoreName" value="P60 Cannabis" />
      <input type="hidden" name="SourcePage" value="/careers/budtender" />

      <div className={styles.formSection}>
        <h3>Contact</h3>
        <div className={styles.twoColumn}>
          <label className={styles.field}>
            <span>Full legal name</span>
            <input name="ApplicantName" autoComplete="name" required />
          </label>
          <label className={styles.field}>
            <span>Preferred name</span>
            <input name="PreferredName" autoComplete="nickname" />
          </label>
          <label className={styles.field}>
            <span>Email</span>
            <input name="Email" type="email" autoComplete="email" required />
          </label>
          <label className={styles.field}>
            <span>Phone</span>
            <input name="Phone" type="tel" autoComplete="tel" required />
          </label>
        </div>
        <label className={styles.field}>
          <span>City or area you live in</span>
          <input name="CityArea" autoComplete="address-level2" />
        </label>
        <label className={styles.field}>
          <span>Selfie photo required</span>
          <input name="PhotoFile" type="file" accept="image/jpeg,image/png,image/webp" capture="user" required />
          <small className={styles.fieldHint}>Use a clear selfie. JPG, PNG, or WebP under 4 MB.</small>
        </label>
      </div>

      <div className={styles.formSection}>
        <h3>Availability</h3>
        <div className={styles.twoColumn}>
          <label className={styles.field}>
            <span>Applying for</span>
            <select name="Role" required defaultValue="">
              <option value="" disabled>Select one</option>
              <option>Budtender</option>
              <option>Manager</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>What type of role are you looking for?</span>
            <select name="EmploymentType" required defaultValue="">
              <option value="" disabled>Select one</option>
              <option>Full-time</option>
              <option>Part-time</option>
              <option>Either</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>Earliest start date</span>
            <input name="EarliestStartDate" type="date" required />
          </label>
        </div>
        <fieldset className={styles.checkboxGroup}>
          <legend>Which shifts can you usually work?</legend>
          {availabilityOptions.map((option) => (
            <label key={option}>
              <input type="checkbox" name="Availability" value={option} />
              {option}
            </label>
          ))}
        </fieldset>
        <fieldset className={styles.choiceGroup}>
          <legend>Can you work late shifts when scheduled?</legend>
          <label><input type="radio" name="LateShiftAvailability" value="Yes" required /> Yes</label>
          <label><input type="radio" name="LateShiftAvailability" value="No" /> No</label>
          <label><input type="radio" name="LateShiftAvailability" value="Sometimes" /> Sometimes</label>
        </fieldset>
      </div>

      <div className={styles.formSection}>
        <h3>Experience</h3>
        <label className={styles.field}>
          <span>Tell us about your retail, customer service, or sales experience.</span>
          <textarea name="RetailExperience" rows={4} required />
        </label>
        <label className={styles.field}>
          <span>What interests you about cannabis retail or learning the menu?</span>
          <textarea name="CannabisInterest" rows={4} />
        </label>
        <label className={styles.field}>
          <span>Tell us about POS, cash, inventory, or opening/closing experience.</span>
          <textarea name="CashHandlingExperience" rows={4} />
        </label>
        <fieldset className={styles.checkboxGroup}>
          <legend>Which product categories are you comfortable discussing?</legend>
          {productOptions.map((option) => (
            <label key={option}>
              <input type="checkbox" name="ProductComfort" value={option} />
              {option}
            </label>
          ))}
        </fieldset>
      </div>

      <div className={styles.formSection}>
        <h3>Motivation And Fit</h3>
        <label className={styles.field}>
          <span>What motivates you to work hard and keep improving?</span>
          <textarea name="Motivation" rows={4} required />
        </label>
        <label className={styles.field}>
          <span>Tell us about a time you stayed determined when something was tough.</span>
          <textarea name="Determination" rows={4} required />
        </label>
        <label className={styles.field}>
          <span>A guest is not sure what to buy. How would you help?</span>
          <textarea name="CustomerFitScenario" rows={4} required />
        </label>
        <label className={styles.field}>
          <span>How would you keep good energy with the team during a busy shift?</span>
          <textarea name="TeamworkScenario" rows={4} required />
        </label>
        <label className={styles.field}>
          <span>Why do you want to work at P60 Cannabis?</span>
          <textarea name="WhyQLC" rows={4} required />
        </label>
      </div>

      <div className={styles.formSection}>
        <h3>Links And Consent</h3>
        <fieldset className={styles.choiceGroup}>
          <legend>Can you reliably get to the store for scheduled shifts?</legend>
          <label><input type="radio" name="TransportationReliability" value="Yes" required /> Yes</label>
          <label><input type="radio" name="TransportationReliability" value="No" /> No</label>
          <label><input type="radio" name="TransportationReliability" value="Sometimes" /> Sometimes</label>
        </fieldset>
        <div className={styles.twoColumn}>
          <label className={styles.field}>
            <span>Resume link</span>
            <input name="ResumeUrl" type="url" placeholder="https://" />
          </label>
          <label className={styles.field}>
            <span>LinkedIn, portfolio, or relevant social profile</span>
            <input name="PortfolioUrl" type="url" placeholder="https://" />
          </label>
        </div>
        <label className={styles.consentLine}>
          <input type="checkbox" name="ConsentToContact" value="I agree" required />
          <span>I consent to be contacted about this application.</span>
        </label>
        <label className={styles.consentLine}>
          <input type="checkbox" name="PrivacyConsent" value="I agree" required />
          <span>I understand my response will be stored for hiring review.</span>
        </label>
      </div>

      {message && (
        <div className={`${styles.formMessage} ${styles[submitState]}`} role={submitState === "error" ? "alert" : "status"} aria-live="polite">
          <p>{message}</p>
          {missingItems.length > 0 && (
            <ul className={styles.missingList}>
              {missingItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button className={styles.submitButton} type="submit" disabled={submitState === "sending"}>
        {submitState === "sending" ? "Sending..." : "Submit Application"}
      </button>
    </form>
  );
}
