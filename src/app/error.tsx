"use client";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 560 }}>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>Something went wrong</h1>
      <p style={{ color: "#555", marginBottom: "1.25rem" }}>
        This usually means the database isn&apos;t connected yet. Check that:
      </p>
      <ol style={{ lineHeight: 1.8, color: "#333" }}>
        <li>
          <strong>NEXT_PUBLIC_SUPABASE_URL</strong> and{" "}
          <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY</strong> are set in Vercel
          (Settings → Environment Variables) and the project has been redeployed
        </li>
        <li>
          <code>supabase/schema.sql</code> has been run in the Supabase SQL editor
        </li>
      </ol>
      <button
        onClick={reset}
        style={{ marginTop: "1.5rem", padding: "0.5rem 1rem", cursor: "pointer" }}
      >
        Try again
      </button>
    </div>
  );
}
