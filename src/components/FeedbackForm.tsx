"use client";

import { useState } from "react";

export function FeedbackForm({ featureId }: { featureId: string }) {
  const [state, setState] = useState<"idle" | "submitting" | "sent" | "error">("idle");

  async function onSubmit(formData: FormData) {
    setState("submitting");

    const response = await fetch(`/api/features/${featureId}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        support: formData.get("support") === "yes",
        comment: formData.get("comment"),
        name: formData.get("name") || undefined,
        email: formData.get("email") || undefined,
      }),
    });

    setState(response.ok ? "sent" : "error");
  }

  return (
    <form action={onSubmit} className="feedback-form">
      <fieldset>
        <legend>Do you support this project?</legend>
        <label>
          <input defaultChecked name="support" type="radio" value="yes" />
          Yes
        </label>
        <label>
          <input name="support" type="radio" value="no" />
          No
        </label>
      </fieldset>

      <label>
        Comment
        <textarea maxLength={1200} minLength={3} name="comment" required rows={5} />
      </label>

      <div className="form-grid">
        <label>
          Name
          <input name="name" type="text" />
        </label>
        <label>
          Email
          <input name="email" type="email" />
        </label>
      </div>

      <button disabled={state === "submitting"} type="submit">
        {state === "submitting" ? "Sending..." : "Send feedback"}
      </button>
      {state === "sent" ? <p className="form-note">Thanks. Your feedback was recorded.</p> : null}
      {state === "error" ? <p className="form-note error">Something went wrong. Try again in a moment.</p> : null}
    </form>
  );
}
