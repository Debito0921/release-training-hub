import { NextResponse } from "next/server";
import { listPeople } from "@/lib/people";
import { ALL_DEPARTMENTS, getModule, getSessionByCode } from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const session = getSessionByCode(code);
  if (!session) {
    return NextResponse.json(
      { error: "That code does not match any session. Check the screen and try again." },
      { status: 404 },
    );
  }
  const module = await getModule(session.moduleId);

  return NextResponse.json({
    session: {
      id: session.id,
      code: session.code,
      status: session.status,
    },
    module: { title: module?.title ?? "Release quiz" },
    // Every department, even ones the release is not aimed at: anyone in the
    // room must be able to say where they are really from. The ones the
    // release targets come first, so the usual answer is at the top.
    departments: [...ALL_DEPARTMENTS].sort((a, b) => {
      const aimed = (d: string) => (module?.departments.includes(d) ? 0 : 1);
      return aimed(a) - aimed(b);
    }),
    takenNames: session.players.map((p) => p.name),
    // Used to offer "is this you?" while they type, so one person's scores
    // stay joined up from one release to the next.
    people: (await listPeople()).map((p) => ({
      id: p.id,
      name: p.name,
      department: p.department,
    })),
  });
}
