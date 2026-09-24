import { createClient } from "@/lib/supabase/server";
import DashboardHeader from "./DashboardHeader";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
    : { data: null };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <DashboardHeader displayName={user ? (profile?.full_name ?? user.email ?? "") : null} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
