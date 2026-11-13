import { networkInterfaces } from "node:os";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PREFERRED = /^(wi-?fi|wlan|ethernet|en\d|eth\d)/i;
const VIRTUAL = /(virtual|vmware|vbox|hyper-v|loopback|tailscale|zerotier|docker|wsl|tap|tun|vpn)/i;

function lanAddresses() {
  const found: { name: string; address: string; score: number }[] = [];

  for (const [name, entries] of Object.entries(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      let score = 0;
      if (PREFERRED.test(name)) score += 2;
      if (VIRTUAL.test(name)) score -= 3;
      found.push({ name, address: entry.address, score });
    }
  }

  return found.sort((a, b) => b.score - a.score);
}

export function GET(request: Request) {
  const port = new URL(request.url).port || "3000";
  const addresses = lanAddresses();

  return NextResponse.json({
    port,
    best: addresses[0]?.address ?? null,
    addresses: addresses.map((a) => ({ name: a.name, address: a.address })),
  });
}
