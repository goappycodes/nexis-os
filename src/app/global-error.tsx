"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary, for errors thrown in the root layout itself.
 *
 * This replaces the whole document, so it has to bring its own html/body and
 * cannot rely on the app's stylesheet loading — hence the inline styles.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[nexis-os:global]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f7f8",
          color: "#111111",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          {/* Plain img, not next/image: this boundary renders when the app
              itself has failed, so it must not depend on the framework. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/mark.png"
            alt="NEXIS"
            width={44}
            height={44}
            style={{ display: "block", margin: "0 auto 1.25rem" }}
          />

          <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 0.5rem" }}>
            Nexis OS hit a problem
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#6b6b70", margin: 0 }}>
            The app failed to start on this screen. Nothing has been lost — reloading
            usually clears it.
          </p>

          {error.digest && (
            <p style={{ fontSize: 11, color: "#9a9aa1", marginTop: "0.75rem" }}>
              Reference: {error.digest}
            </p>
          )}

          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              background: "#ef3a5d",
              color: "#fff",
              border: 0,
              borderRadius: 12,
              padding: "0.75rem 1.5rem",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
