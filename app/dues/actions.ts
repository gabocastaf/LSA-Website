"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

export async function logDuesPayment(formData: FormData) {
  const description = formData.get("description")?.toString().trim();
  const amountRaw = formData.get("amount")?.toString();
  const amount = amountRaw ? Number.parseFloat(amountRaw) : NaN;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!description || Number.isNaN(amount) || amount <= 0) {
    redirect("/dues?error=Description+and+a+positive+amount+are+required");
  }

  const { error } = await supabase.from("dues").insert({
    description,
    amount,
    paid_by: user.id,
  });

  if (error) {
    redirect(`/dues?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dues");
  redirect("/dues");
}
