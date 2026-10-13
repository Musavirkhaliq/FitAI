import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/AppShell";
import { CoachProvider } from "@/components/coach/CoachProvider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <CoachProvider>
      <AppShell>{children}</AppShell>
    </CoachProvider>
  );
}
