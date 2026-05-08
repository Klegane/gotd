"use client";

import { signIn, signOut } from "next-auth/react";

type AuthButtonProps = {
  userName?: string;
  idPrefix?: string;
};

export function AuthButton({ userName, idPrefix = "auth" }: AuthButtonProps) {
  if (userName) {
    return (
      <div id={`${idPrefix}-status`} className="auth-strip">
        <span id={`${idPrefix}-user-name`}>{userName}</span>
        <button
          id={`${idPrefix}-sign-out-button`}
          type="button"
          className="button secondary"
          onClick={() => signOut()}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      id={`${idPrefix}-sign-in-button`}
      type="button"
      className="button primary"
      onClick={() => signIn("google")}
    >
      Sign in with Google
    </button>
  );
}
