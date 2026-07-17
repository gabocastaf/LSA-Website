"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Remaining = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function getRemaining(targetIso: string): Remaining {
  const diff = Math.max(0, new Date(targetIso).getTime() - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

export function EventCountdown({
  nextEvent,
}: {
  nextEvent: { title: string; eventDate: string } | null;
}) {
  // Computed in an effect, not during render: the server has no correct "now"
  // to render against, so the first client paint must match the server's
  // static placeholder to avoid a hydration mismatch.
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    if (!nextEvent) return;

    const tick = () => setRemaining(getRemaining(nextEvent.eventDate));
    // Prime the first tick off the synchronous effect body (setState here
    // directly would trigger the react-hooks/set-state-in-effect rule) —
    // the interval alone would otherwise leave the placeholder showing for
    // a full second after mount.
    const primeTimeout = setTimeout(tick, 0);
    const interval = setInterval(tick, 1000);

    return () => {
      clearTimeout(primeTimeout);
      clearInterval(interval);
    };
  }, [nextEvent]);

  if (!nextEvent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Next Event</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          No events on the horizon. Log off.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Countdown to {nextEvent.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {remaining ? (
          <div className="flex gap-4 text-2xl font-semibold tabular-nums">
            <span>{remaining.days}d</span>
            <span>{remaining.hours}h</span>
            <span>{remaining.minutes}m</span>
            <span>{remaining.seconds}s</span>
          </div>
        ) : (
          <div className="flex gap-4 text-2xl font-semibold tabular-nums text-muted-foreground">
            <span>—d</span>
            <span>—h</span>
            <span>—m</span>
            <span>—s</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
