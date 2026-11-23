// Add your GA4 Measurement ID (format: G-XXXXXXXXXX). Analytics stays off until configured and accepted.
const MEASUREMENT_ID = "G-XXXXXXXXXX";
const CHOICE_KEY = "jalebi-jams-analytics-consent";
const consentPanel = document.querySelector("#analytics-consent");
const hasMeasurementId = /^G-[A-Z0-9]+$/.test(MEASUREMENT_ID) && MEASUREMENT_ID !== "G-XXXXXXXXXX";

if (hasMeasurementId && consentPanel) {
  const settingsButton = document.querySelector("#privacy-settings");
  const acceptButton = document.querySelector("#analytics-accept");
  const rejectButton = document.querySelector("#analytics-reject");
  let analyticsLoaded = false;

  function setConsentChoice(choice) {
    try { localStorage.setItem(CHOICE_KEY, choice); } catch { /* Analytics remains disabled if storage is unavailable. */ }
  }

  function startAnalytics() {
    if (analyticsLoaded || !hasMeasurementId) return;
    analyticsLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    });
    window.gtag("consent", "update", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    });
    window.gtag("js", new Date());
    window.gtag("config", MEASUREMENT_ID);

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
    document.head.append(script);
  }

  function withdrawAnalytics() {
    window[`ga-disable-${MEASUREMENT_ID}`] = true;
    if (typeof window.gtag === "function") {
      window.gtag("consent", "update", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied"
      });
    }
    document.cookie.split(";").forEach((cookie) => {
      const name = cookie.split("=")[0].trim();
      if (name.startsWith("_ga")) document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
    });
  }

  function showChoices() { consentPanel.hidden = false; }
  function hideChoices() { consentPanel.hidden = true; }

  acceptButton?.addEventListener("click", () => {
    setConsentChoice("accepted");
    window[`ga-disable-${MEASUREMENT_ID}`] = false;
    startAnalytics();
    hideChoices();
  });
  rejectButton?.addEventListener("click", () => {
    setConsentChoice("rejected");
    withdrawAnalytics();
    hideChoices();
  });
  settingsButton?.addEventListener("click", showChoices);

  let savedChoice = "";
  try { savedChoice = localStorage.getItem(CHOICE_KEY) || ""; } catch { /* No stored choice means analytics remains disabled. */ }
  if (savedChoice === "accepted") {
    window[`ga-disable-${MEASUREMENT_ID}`] = false;
    startAnalytics();
  } else if (!savedChoice) {
    showChoices();
  }
}
