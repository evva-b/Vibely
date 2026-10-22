import type { Metadata } from "next";
import LoginForm from "@/features/auth/components/LoginForm/LoginForm";

export const metadata: Metadata = {
  title: "Вход",
};

export default function LoginPage() {
  return <LoginForm />;
}
