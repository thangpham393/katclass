"use client";

import { useParams } from "next/navigation";
import { SessionPrepare } from "@/components/session-prepare";

export default function PrepareSessionPage() {
  const params = useParams<{ id: string }>();
  return <SessionPrepare sessionId={params.id} />;
}
