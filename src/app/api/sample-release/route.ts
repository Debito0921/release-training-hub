import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  const file = path.join(process.cwd(), "data", "sample-release.md");
  const markdown = await readFile(file, "utf8");
  return NextResponse.json({ markdown });
}
