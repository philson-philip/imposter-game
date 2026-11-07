import { Suspense } from "react";
import { Screen } from "@/components/shell";
import { RoomClient } from "./room-client";

export default function RoomPage() {
  return (
    <Suspense fallback={<Screen aria-busy="true" />}>
      <RoomClient />
    </Suspense>
  );
}
