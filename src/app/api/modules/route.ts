import { NextResponse } from "next/server";
import { getAccount } from "@/lib/account";
import { createBlankModule } from "@/lib/library";
import { createModule, listModules } from "@/lib/store";

export async function GET() {
  const modules = (await listModules()).map((m) => ({
    id: m.id,
    title: m.title,
    goLive: m.goLive,
    departments: m.departments,
    passMark: m.passMark,
    featureCount: m.features.length,
    questionCount: m.questions.filter((q) => q.included).length,
    createdAt: m.createdAt,
  }));
  return NextResponse.json({ modules });
}

export async function POST(request: Request) {
  // The release is stored under the host who uploaded it.
  const account = await getAccount();
  if (!account) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  let markdown = "";
  let title = "";
  try {
    const body = await request.json();
    markdown = typeof body?.markdown === "string" ? body.markdown : "";
    title = typeof body?.title === "string" ? body.title : "";
  } catch {
    return NextResponse.json({ error: "We could not read that file." }, { status: 400 });
  }

  // No file: start an empty release and type the questions in by hand.
  if (!markdown.trim() && title.trim()) {
    try {
      const module = await createBlankModule(title, account.id);
      return NextResponse.json({ module });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not create the release. Please try again.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (!markdown.trim()) {
    return NextResponse.json({ error: "That file looks empty." }, { status: 400 });
  }

  try {
    const module = await createModule(markdown, account.id);
    return NextResponse.json({ module });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "We could not read that file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
