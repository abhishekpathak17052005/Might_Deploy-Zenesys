import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/finance")({
  beforeLoad: ({ location }) => {
    if (location.pathname !== "/finance") return;
    throw redirect({ to: "/finance/dashboard" });
  },
});
