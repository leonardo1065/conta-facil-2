import { createFileRoute } from "@tanstack/react-router";

// No head() here: the home route inherits title/description/og/twitter from
// __root.tsx, and ships no og:image so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  component: Index,
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-2xl text-center space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Agenda Fácil</h1>
        <p className="text-lg text-muted-foreground">
          vou passar um projeto pronto preciso arrumar o proque nao esta enviando avisos por email
        </p>
      </div>
    </div>
  );
}
