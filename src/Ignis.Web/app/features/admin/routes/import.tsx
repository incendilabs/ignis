/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Button } from "@eventuras/ratio-ui/core/Button";
import { Card } from "@eventuras/ratio-ui/core/Card";
import { Heading } from "@eventuras/ratio-ui/core/Heading";
import { Link } from "@eventuras/ratio-ui/core/Link";
import { Panel } from "@eventuras/ratio-ui/core/Panel";
import { Text } from "@eventuras/ratio-ui/core/Text";
import { Unauthorized } from "@eventuras/ratio-ui/blocks/Unauthorized";
import {
  FileUpload,
  type FileUploadItem,
  type FileUploadRejection,
  type FileUploadStatus,
} from "@eventuras/ratio-ui/forms/FileUpload";
import { Container } from "@eventuras/ratio-ui/layout/Container";
import { Stack } from "@eventuras/ratio-ui/layout/Stack";
import { useState } from "react";
import { redirect, useFetcher } from "react-router";

import { getSessionFromRequest, requireSession } from "#app/features/auth/session.server";
import { OperationsConsole } from "#app/features/operations/components/OperationsConsole";
import { useOperationsStream } from "#app/features/operations/use-operations-stream";
import { m } from "#app/i18n/paraglide/messages";

import type { Route } from "./+types/import";
import { OperationResultPanel } from "../components/OperationResultPanel";
import { isEnabled } from "../config.server";
import { requireScopedSession } from "../fhir-api.server";
import { getArchiveImportMaxUploadBytes, runArchiveImport } from "../import.server";
import {
  archiveImportAcceptedTypes,
  archiveImportFileField,
  archiveImportMaxUploadBytesFallback,
  archiveImportScope,
  formatMegabytes,
} from "../import.shared";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isEnabled()) return redirect("/");
  const session = await requireSession(request);
  const grantedScopes = session.scopes ?? [];
  const isAuthorized = grantedScopes.includes(archiveImportScope);

  const accessToken = session.tokens?.accessToken;
  const maxUploadBytes = isAuthorized && accessToken
    ? await getArchiveImportMaxUploadBytes(request, accessToken)
    : archiveImportMaxUploadBytesFallback;

  return { isAuthorized, maxUploadBytes };
}

export async function action({ request }: Route.ActionArgs) {
  if (!isEnabled()) {
    return { ok: false, message: "Admin UI is disabled." };
  }

  const session = await getSessionFromRequest(request);
  const blocked = requireScopedSession(session, archiveImportScope);
  if (blocked) return blocked;

  const accessToken = session?.tokens?.accessToken;
  if (!accessToken) {
    return {
      ok: false,
      message: "No access token was found in the current session.",
    };
  }

  // Only consume the (potentially large) multipart body once authorized.
  const formData = await request.formData();
  const file = formData.get(archiveImportFileField);
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Select a ZIP archive to import." };
  }

  return runArchiveImport(request, file, accessToken);
}

export default function AdminImport({ loaderData }: Route.ComponentProps) {
  if (!loaderData.isAuthorized) {
    return <Unauthorized />;
  }

  return (
    <Container as="main">
      <Stack direction="vertical" gap="lg">
        <Stack direction="vertical" gap="sm">
          <Heading as="h1">{m.import_title()}</Heading>
          <Text>{m.import_description()}</Text>
        </Stack>

        <Card className="p-6">
          <ArchiveImportForm maxUploadBytes={loaderData.maxUploadBytes} />
        </Card>
      </Stack>
    </Container>
  );
}

function ArchiveImportForm({ maxUploadBytes }: { maxUploadBytes: number; }) {
  const fetcher = useFetcher<typeof action>();
  // Connect on page load so the relay is live before the import starts —
  // hub events are not replayed, so a late connection would miss them.
  const stream = useOperationsStream();
  const result = fetcher.data;
  const isSubmitting = fetcher.state !== "idle";

  const [item, setItem] = useState<FileUploadItem | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);

  const handleSelect = (files: File[]) => {
    const file = files.at(0);
    if (file === undefined) return;
    setRejection(null);
    setItem({ id: crypto.randomUUID(), file, status: "pending" });
  };

  const handleRemove = () => {
    setItem(null);
  };

  const handleError = (rejections: FileUploadRejection[]) => {
    const reason = rejections[0]?.reason;
    setRejection(
      reason === "size"
        ? m.import_reject_size({ size: formatMegabytes(maxUploadBytes) })
        : reason === "type"
          ? m.import_reject_type()
          : m.import_reject_generic(),
    );
  };

  const handleSubmit = () => {
    if (item === null) return;
    const body = new FormData();
    body.append(archiveImportFileField, item.file, item.file.name);
    void fetcher.submit(body, {
      method: "post",
      encType: "multipart/form-data",
    });
  };

  // The component is controlled; reflect submit state and the action result
  // back onto the tracked item so the user sees uploading/success/error.
  const status: FileUploadStatus = isSubmitting
    ? "uploading"
    : result
      ? result.ok
        ? "success"
        : "error"
      : (item?.status ?? "pending");

  const displayItems: FileUploadItem[] = item
    ? [
      {
        ...item,
        status,
        error: result && !result.ok ? result.message : undefined,
      },
    ]
    : [];

  return (
    <Stack direction="vertical" gap="md">
      <FileUpload
        items={displayItems}
        accept={archiveImportAcceptedTypes}
        maxSize={maxUploadBytes}
        isDisabled={isSubmitting}
        onSelect={handleSelect}
        onRemove={handleRemove}
        onError={handleError}
        label={m.import_dropzone_label()}
        description={m.import_dropzone_description({ size: formatMegabytes(maxUploadBytes) })}
      />

      {rejection ? (
        <Panel variant="alert" status="error">
          <Text>{rejection}</Text>
        </Panel>
      ) : null}

      <div>
        <Button
          type="button"
          variant="primary"
          loading={isSubmitting}
          isDisabled={item === null || isSubmitting}
          onPress={handleSubmit}
        >
          {m.import_submit()}
        </Button>
      </div>

      {result ? <OperationResultPanel result={result} /> : null}

      <Stack direction="vertical" gap="sm">
        <OperationsConsole
          events={stream.events}
          status={stream.status}
          // Scope to nothing until an import returns its id, so the console
          // shows its waiting state and then this import's events only.
          filterOperationId={result?.operationId ?? ""}
        />
        <Link href="/admin/operations" variant="button-text">
          {m.operations_view_all()}
        </Link>
      </Stack>
    </Stack>
  );
}
