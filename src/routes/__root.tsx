import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center parchment-card rounded-2xl p-10">
        <h1 className="font-display text-6xl text-primary">404</h1>
        <h2 className="mt-4 font-display text-xl">Page not found</h2>
        <p className="mt-2 text-base text-muted-foreground">This page does not exist.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "OUR JOURNEY" },
      { name: "description", content: "I MISS YOUUUUUUUUUUUUUUUUUUUUUUUUUUUUUU." },
      { name: "author", content: "Our Journey" },
      { property: "og:title", content: "OUR JOURNEY" },
      { property: "og:description", content: "I MISS YOUUUUUUUUUUUUUUUUUUUUUUUUUUUUUU." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "OUR JOURNEY" },
      { name: "twitter:description", content: "I MISS YOUUUUUUUUUUUUUUUUUUUUUUUUUUUUUU." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b231afa3-6508-4878-afb6-82bbce771b0b/id-preview-f0ec22ab--3c2f1794-56fe-4f98-9603-326eec6e2283.lovable.app-1776711128448.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b231afa3-6508-4878-afb6-82bbce771b0b/id-preview-f0ec22ab--3c2f1794-56fe-4f98-9603-326eec6e2283.lovable.app-1776711128448.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  return (
    <>
      <Outlet />
      <Toaster richColors position="top-center" />
    </>
  );
}
