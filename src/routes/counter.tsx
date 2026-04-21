import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/counter")({
  component: () => <Navigate to="/today" replace />,
});
