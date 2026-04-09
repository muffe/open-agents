import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountsSection, AccountsSectionSkeleton } from "../accounts-section";
import { ProfileSection } from "../profile-section";
import { UsageSection, UsageSectionSkeleton } from "../usage-section";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your profile, connected accounts, and usage.",
};

export default function ProfilePage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Profile</h1>
      <ProfileSection />
      <Suspense fallback={<AccountsSectionSkeleton />}>
        <AccountsSection />
      </Suspense>
      <Suspense fallback={<UsageSectionSkeleton />}>
        <UsageSection />
      </Suspense>
    </>
  );
}
