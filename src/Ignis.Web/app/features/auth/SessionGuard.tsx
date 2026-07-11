/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { useEffect, useState } from "react";
import { SessionWarning } from "@eventuras/ratio-ui/blocks/SessionWarning";

import { m } from "#app/i18n/paraglide/messages";

import { SessionStatus } from "./session-status";

interface SessionGuardProps {
  status: SessionStatus;
  /** ISO 8601 access-token expiry, or null when unknown. */
  expiresAt: string | null;
}

/**
 * Shows a full-screen overlay once the session has expired, on a client timer
 * so an idle tab still surfaces it. UI from ratio-ui.
 */
export function SessionGuard({ status, expiresAt }: SessionGuardProps) {
  const [expired, setExpired] = useState(false);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === SessionStatus.Anonymous) {
      setExpired(false);
      return;
    }
    if (status === SessionStatus.Expired) {
      setExpired(true);
      return;
    }
    // VALID — flip to expired at the real expiry time, since the loader won't
    // revalidate on its own while the tab sits idle.
    setExpired(false);
    if (expiresAt === null) return;
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) {
      setExpired(true);
      return;
    }
    const timer = setTimeout(() => {
      setExpired(true);
    }, ms);
    return () => {
      clearTimeout(timer);
    };
  }, [status, expiresAt]);

  // Dismissal scoped to the token lifetime: a fresh session can warn again.
  const dismissKey = expiresAt ?? "expired";

  return (
    <SessionWarning
      isOpen={expired && dismissedFor !== dismissKey}
      isLoading={loading}
      onLoginNow={() => {
        setLoading(true);
        window.location.assign("/auth/login");
      }}
      onDismiss={() => {
        setDismissedFor(dismissKey);
      }}
      messages={{
        title: m.session_expired_title(),
        description: m.session_expired_description(),
        tip: m.session_warning_tip(),
        loginButton: m.session_login_button(),
        dismissButton: m.session_dismiss_button(),
      }}
    />
  );
}
