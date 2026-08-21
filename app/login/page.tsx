"use client";

/**
 * Sign in — for people who already have an account. Creating one lives at
 * /signup, deliberately separate: they are different intentions with different
 * stakes, and a shared form that silently changes mode makes it possible to
 * press "continue" without knowing which of the two just happened.
 */
import AuthShell from "@/components/auth/AuthShell";
import AuthForm from "@/components/auth/AuthForm";

export default function LoginPage() {
  return (
    <AuthShell titleKey="auth_title" subtitleKey="auth_subtitle">
      <AuthForm mode="signin" />
    </AuthShell>
  );
}
