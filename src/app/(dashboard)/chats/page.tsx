import type { Metadata } from "next";
import Chat from "@/features/ai/components/Chat/Chat";

export const metadata: Metadata = {
  title: "Чаты",
};

export default function ChatsPage() {
  return <Chat />;
}
