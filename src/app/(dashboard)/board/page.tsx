import type { Metadata } from "next";
import Board from "@/features/posts/components/Board/Board";

export const metadata: Metadata = {
  title: "Доска идей",
};

export default function BoardPage() {
  return <Board />;
}
