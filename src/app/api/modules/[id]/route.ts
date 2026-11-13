import { NextResponse } from "next/server";
import { getAccount } from "@/lib/account";
import {
  addDbQuestion,
  setDbModuleStatus,
  updateDbQuestion,
} from "@/lib/library";
import { deleteModule, getModule, setQuestionIncluded } from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const module = await getModule(id);
  if (!module) {
    return NextResponse.json({ error: "Module not found." }, { status: 404 });
  }
  return NextResponse.json({ module });
}

/** A host changes their own releases; an admin can fix anybody's. */
async function openForEditing(id: string) {
  const account = await getAccount();
  if (!account) {
    return {
      refusal: NextResponse.json(
        { error: "Please sign in first." },
        { status: 401 },
      ),
    };
  }
  const module = await getModule(id);
  if (!module) {
    return {
      refusal: NextResponse.json({ error: "Module not found." }, { status: 404 }),
    };
  }
  if (module.ownerId !== account.id && account.role !== "admin") {
    return {
      refusal: NextResponse.json(
        { error: "This release belongs to somebody else." },
        { status: 403 },
      ),
    };
  }
  return { module };
}

/** Adds one question a host typed in. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gate = await openForEditing(id);
  if ("refusal" in gate) return gate.refusal;
  if (!gate.module.ownerId) {
    return NextResponse.json(
      { error: "This is sample data, so it cannot be changed." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  if (
    typeof body?.topic !== "string" ||
    typeof body.stem !== "string" ||
    !Array.isArray(body.options) ||
    !body.options.every((o: unknown) => typeof o === "string") ||
    typeof body.correctIndex !== "number"
  ) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const { problem } = await addDbQuestion(id, body.topic, {
    stem: body.stem,
    options: body.options,
    correctIndex: body.correctIndex,
  });
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }
  const updated = await getModule(id);
  return NextResponse.json({ module: updated });
}

/** Throws away a release the host does not want in the library. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gate = await openForEditing(id);
  if ("refusal" in gate) return gate.refusal;

  const { problem } = await deleteModule(id);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gate = await openForEditing(id);
  if ("refusal" in gate) return gate.refusal;
  const module = gate.module;

  const body = await request.json().catch(() => null);

  if (body?.status === "ready") {
    await setDbModuleStatus(id, "ready");
    return NextResponse.json({ ok: true });
  }

  const questionId = body?.questionId;
  if (typeof questionId !== "string") {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  if (!module.questions.some((q) => q.id === questionId)) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }

  if (typeof body.included === "boolean") {
    await setQuestionIncluded(id, questionId, body.included);
    return NextResponse.json({ ok: true });
  }

  if (
    typeof body.stem === "string" &&
    Array.isArray(body.options) &&
    body.options.every((o: unknown) => typeof o === "string") &&
    typeof body.correctIndex === "number"
  ) {
    const problem = await updateDbQuestion(id, questionId, {
      stem: body.stem,
      options: body.options,
      correctIndex: body.correctIndex,
    });
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 400 });
    }
    const updated = await getModule(id);
    return NextResponse.json({
      question: updated?.questions.find((q) => q.id === questionId),
    });
  }

  return NextResponse.json({ error: "Bad request." }, { status: 400 });
}
