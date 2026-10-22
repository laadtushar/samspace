import { llmsSource, llmsResponse, llmsTxt } from "@/lib/llms";

export const revalidate = 3600;

export async function GET() {
  const { content, posts } = await llmsSource();
  return llmsResponse(llmsTxt(content, posts));
}
