export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
export const AUTH_TOKEN = process.env.NEXT_PUBLIC_AUTH_TOKEN || "";

export const RUN_PHASES = [
  "STARTED",
  "OPEN_PORTAL",
  "IDENTITY",
  "CAPTCHA_REQUIRED",
  "CAPTCHA_SOLVED",
  "OTP_REQUIRED",
  "WAITING_FOR_OTP",
  "OTP_VERIFIED",
  "PASSWORD_GENERATED",
  "COMPLETED",
] as const;
