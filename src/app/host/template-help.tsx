"use client";

import { useState } from "react";
import { Check, Copy, Download, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PROMPT = `Rewrite our release notes into the Release Training Hub format below, so I can upload the file and it builds a quiz.

Rules:
- One "## Feature:" heading per feature.
- Keep our own wording. Do not invent anything that is not in my notes.
- Write 2 to 3 Misconception lines per feature, in the form "wrong belief || what is actually true". These must be mistakes Sales, Support, Finance or HR would really make after the workshop, not obvious ones.
- Every line must start with one of the labels. Anything without a label is dropped.
- Save it as one .md file.

Format:

# Month Year — Release name

Go-live: <date>
Departments: Sales, Support, Finance, HR
Pass mark: 70

## Feature: <feature name>

What changed: <one sentence>
Why: <the problem it solves>
Before: <the old way>
After: <the new way>
Steps:
- <step>
- <step>
Misconception: <wrong belief> || <what is actually true>
Misconception: <wrong belief> || <what is actually true>
Limit: <what it still cannot do>
Must-know: <the one line they must remember>

Here are our release notes:
`;

export function TemplateHelp() {
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    // navigator.clipboard does not exist on plain http, which is how this runs
    // on the office network, so fall back to the old textarea trick.
    try {
      await navigator.clipboard.writeText(PROMPT);
    } catch {
      const area = document.createElement("textarea");
      area.value = PROMPT;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wand2 className="size-4 text-primary" />
          Do not have a file yet?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <p>
          Take the template and fill it in yourself, or give the prompt to an AI
          assistant together with your existing release notes and let it write
          the file for you. Either way, read it before you upload.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="secondary"
            size="sm"
            nativeButton={false}
            render={<a href="/release-template.md" download="release-template.md" />}
          >
            <Download className="size-4" />
            Download the template
          </Button>
          <Button variant="secondary" size="sm" onClick={copyPrompt}>
            {copied ? (
              <Check className="size-4 text-[var(--success)]" />
            ) : (
              <Copy className="size-4" />
            )}
            {copied ? "Prompt copied" : "Copy the AI prompt"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
