import { Resend } from "resend";

// Server-only: never import this from a Client Component or expose
// RESEND_API_KEY to the browser.
export function createResendClient() {
  return new Resend(process.env.RESEND_API_KEY!);
}
