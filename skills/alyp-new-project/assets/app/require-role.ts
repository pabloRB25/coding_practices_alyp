import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type Role = "owner" | "admin" | "member" | "viewer";

export async function requireRole(orgId: string, allowedRoles: Role[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .single();

  if (!membership || !allowedRoles.includes(membership.role as Role)) {
    redirect("/dashboard?error=forbidden");
  }
  return { user, role: membership.role as Role };
}
