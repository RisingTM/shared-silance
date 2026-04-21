import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/set-password")({
  component: () => <Navigate to="/today" replace />,
});
