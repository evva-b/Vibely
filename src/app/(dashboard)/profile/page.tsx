import type { Metadata } from "next";
import CompanyProfile from "@/features/brands/components/CompanyProfile";

export const metadata: Metadata = {
  title: "Профиль компании",
};

export default function ProfilePage() {
  return <CompanyProfile />;
}
