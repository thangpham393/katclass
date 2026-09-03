// TẠM THỜI — nhận kết quả đo tràn ngang từ /dev-probe và ghi ra file để đọc bằng CLI.
import { NextResponse } from "next/server";
import { appendFileSync } from "node:fs";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }
  const body = await req.text();
  appendFileSync("/tmp/kat-probe.log", body + "\n");
  return NextResponse.json({ ok: true });
}
