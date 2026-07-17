import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getUser(). A stray
  // return here can drop the refreshed session cookie silently.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/auth");

  if (user && !isAuthRoute) {
    // Kicking bans the auth user (blocks new logins/refreshes), but a
    // currently-valid access token keeps working until it expires. This
    // check tears down an existing session immediately on a kicked
    // member's next request instead of waiting out that window. Guarded by
    // !isAuthRoute so this doesn't fire on the /login redirect below and
    // loop.
    const { data: profile } = await supabase
      .from("profiles")
      .select("kicked")
      .eq("id", user.id)
      .single();

    if (profile?.kicked) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "You've been kicked from the chapter.");
      const redirectResponse = NextResponse.redirect(url);
      // Carry over the Set-Cookie headers signOut() queued on
      // supabaseResponse — a fresh NextResponse here wouldn't include them,
      // and the session wouldn't actually clear client-side.
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie);
      });
      return redirectResponse;
    }
  }

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
