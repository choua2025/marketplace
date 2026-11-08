import { notFound } from "next/navigation";

// Any URL that matches no page: show the app's own translated 404
// (not-found.tsx) inside the normal layout, instead of Next's default one.
export default function CatchAllPage() {
  notFound();
}
