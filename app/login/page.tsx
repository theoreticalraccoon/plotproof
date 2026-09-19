"use client";

/** Sign in, for people who already have an account. */
import AuthShell from "@/components/auth/AuthShell";
import AuthForm from "@/components/auth/AuthForm";

export default function LoginPage() {
  return (
    <AuthShell titleKey="auth_title" subtitleKey="auth_subtitle">
      <AuthForm mode="signin" />
    </AuthShell>
  );
}
