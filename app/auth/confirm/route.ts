import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  const supabase = await createClient();

  // PKCE flow (the default for @supabase/ssr's browser client): the email
  // link carries a `code` instead of a token_hash, exchanged here for a
  // session.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const redirectTo = request.nextUrl.clone();
      redirectTo.pathname = next;
      redirectTo.searchParams.delete("code");
      return NextResponse.redirect(redirectTo);
    }
  }

  // Fallback: token_hash + type, in case a template ever sends this instead.
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      const redirectTo = request.nextUrl.clone();
      redirectTo.pathname = next;
      redirectTo.searchParams.delete("token_hash");
      redirectTo.searchParams.delete("type");
      return NextResponse.redirect(redirectTo);
    }
  }

  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = "/login";
  redirectTo.searchParams.set("error", "Could not verify email link");
  return NextResponse.redirect(redirectTo);
}
