import type { Metadata } from "next";
import Chat from "@/features/ai/components/Chat/Chat";

export const metadata: Metadata = {
  title: "Чат публикации",
};

export default async function PostChatPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  return <Chat postId={postId} />;
}
