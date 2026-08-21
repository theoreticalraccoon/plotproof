"use client";

/**
 * Create an account — its own route, so "create your first account" is a place
 * you can be sent to, linked to, and land on, rather than a mode you have to
 * find inside the sign-in card.
 */
import AuthShell from "@/components/auth/AuthShell";
import AuthForm from "@/components/auth/AuthForm";

export default function SignupPage() {
  return (
    <AuthShell titleKey="auth_title_signup" subtitleKey="auth_subtitle_signup">
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
