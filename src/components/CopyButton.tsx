"use client";

import { useState } from "react";

export function CopyButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={`permalink-copy-btn${copied ? " copied" : ""}`}
      onClick={() => {
        const url = `${window.location.origin}${path}`;
        navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}
