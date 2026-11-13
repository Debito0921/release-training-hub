"use client";

import { useState } from "react";
import { Check, Copy, Download, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PROMPT = `Rewrite our release notes into the Release Training Hub format below, so I can upload the file and it builds a quiz.

This quiz is only so staff know what is coming and what improved. It is not an exam, so keep it simple and general.

Rules:
- One "##" heading per feature, named the way staff would say it.
- Only these six lines per feature, in this order. No other lines.
- "Who it helps:" names the person who is better off and what they stop having to do. Most of the room will never open the screen, so this is the line that matters most to them. Never write something vague like "improves efficiency".
- Add the "Steps:" line for any feature where somebody has to do something, not just notice it. Separate the steps with ">", 3 to 5 steps, about 5 words each, and end with what the end user or the next person sees. Leave the line out for a feature that only changes what people see.
- Keep every line under 15 words. The answers are read on a phone.
- Be concrete where my notes are concrete: numbers, where it appears on screen, and whether the system does it automatically. Those are what make real questions.
- Keep our own wording and do not invent anything that is not in my notes. If a line is not in my notes, leave it out.
- Save it as one .md file.

Format:

# Month Year — Release name

Go-live: <date>
Departments: Sales, Support, Finance, HR
Pass mark: 70

## <feature name>

What's new: <one short sentence on what is different now>
You'll see: <what they will notice on screen, and where>
Who it helps: <who is better off, and what they stop having to do>
Steps: <first step> > <next step> > <next step> > <what the end user sees>
Instead of: <the old way>
Remember: <the one thing they must not get wrong>

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
