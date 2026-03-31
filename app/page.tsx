import { Suspense } from "react";
import { getContent } from "@/lib/content";
import HomePage from "@/components/HomePage";

export const revalidate = 60;

export default async function Home() {
  const content = await getContent();
  return (
    <Suspense>
      <HomePage content={content} />
    </Suspense>
  );
}
