import type { Metadata } from "next";
import AcceptInvite from "@/components/AcceptInvite";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set up your account",
  // An invitation link is a credential. Nothing about it belongs in an index.
  robots: { index: false, follow: false },
};

export default function InvitePage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  return <AcceptInvite token={searchParams.token ?? ""} />;
}
