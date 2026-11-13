"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Role } from "@/lib/account";
import type { Person } from "./page";

const ROLES: { value: Role; label: string }[] = [
  { value: "player", label: "Player" },
  { value: "host", label: "Host" },
  { value: "admin", label: "Admin" },
];

export function PeopleTable({ people, meId }: { people: Person[]; meId: string }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setRole(id: string, role: Role) {
    setBusyId(id);
    setError(null);

    const res = await fetch("/api/people", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, role }),
    });

    setBusyId(null);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not save that change.");
      return;
    }

    router.refresh();
  }

  if (!people.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nobody has registered yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Card className="py-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Name</TableHead>
                <TableHead className="hidden sm:table-cell">Department</TableHead>
                <TableHead className="pr-4 text-right">Can do</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((person) => (
                <TableRow key={person.id}>
                  <TableCell className="pl-4 font-medium">
                    {person.fullName}
                    {person.id === meId ? (
                      <Badge variant="secondary" className="ml-2">
                        You
                      </Badge>
                    ) : null}
                    {/* The column is hidden on a phone, so the department
                        goes under the name instead. */}
                    <span className="block text-xs font-normal text-muted-foreground sm:hidden">
                      {person.department}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {person.department}
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex items-center justify-end gap-1">
                      {busyId === person.id ? (
                        <Loader2 className="mr-1 size-4 animate-spin text-muted-foreground" />
                      ) : null}
                      {ROLES.map((role) => (
                        <button
                          key={role.value}
                          type="button"
                          disabled={busyId !== null || person.role === role.value}
                          onClick={() => setRole(person.id, role.value)}
                          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                            person.role === role.value
                              ? "border-primary bg-primary text-primary-foreground"
                              : "hover:bg-secondary disabled:opacity-50"
                          }`}
                        >
                          {role.label}
                        </button>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
