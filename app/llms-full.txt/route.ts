import { llmsSource, llmsResponse, llmsFullTxt } from "@/lib/llms";

export const revalidate = 3600;

export async function GET() {
  const { content, posts } = await llmsSource();
  return llmsResponse(llmsFullTxt(content, posts));
}
