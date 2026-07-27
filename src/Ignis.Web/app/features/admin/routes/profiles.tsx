/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Badge } from "@eventuras/ratio-ui/core/Badge";
import { Card } from "@eventuras/ratio-ui/core/Card";
import { Heading } from "@eventuras/ratio-ui/core/Heading";
import { Panel } from "@eventuras/ratio-ui/core/Panel";
import { Table } from "@eventuras/ratio-ui/core/Table";
import { Tabs } from "@eventuras/ratio-ui/core/Tabs";
import { Text } from "@eventuras/ratio-ui/core/Text";
import { Container } from "@eventuras/ratio-ui/layout/Container";
import { Stack } from "@eventuras/ratio-ui/layout/Stack";
import { redirect } from "react-router";

import { requireSession } from "#app/features/auth/session.server";
import { m } from "#app/i18n/paraglide/messages";

import type { Route } from "./+types/profiles";
import { isEnabled } from "../config.server";
import {
  fetchPackages,
  fetchSupportedProfiles,
  type PackageInfo,
  type ProfileInfo,
} from "../profiles.server";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isEnabled()) return redirect("/");
  const session = await requireSession(request);
  const accessToken = session.tokens?.accessToken;
  const [profiles, packages] = await Promise.all([
    fetchSupportedProfiles(request, accessToken),
    fetchPackages(request, accessToken),
  ]);
  return { profiles, packages };
}

export default function AdminProfiles({ loaderData }: Route.ComponentProps) {
  const { profiles, packages } = loaderData;

  return (
    <Container as="main">
      <Stack direction="vertical" gap="lg">
        <Heading as="h1">{m.profiles_title()}</Heading>
        <Tabs defaultSelectedKey="profiles">
          <Tabs.Item id="profiles" title={m.profiles_tab_profiles()}>
            <ProfilesTab profiles={profiles} />
          </Tabs.Item>
          <Tabs.Item id="packages" title={m.profiles_tab_packages()}>
            <PackagesTab packages={packages} />
          </Tabs.Item>
        </Tabs>
      </Stack>
    </Container>
  );
}

/** Profiles the server can validate against, grouped by the type they constrain. */
function ProfilesTab({ profiles }: { profiles: ProfileInfo[] | null }) {
  return (
    <Stack direction="vertical" gap="md">
      <Text>{m.profiles_description()}</Text>
      {profiles === null ? (
        <Panel variant="alert" status="error">
          <Text>{m.profiles_error()}</Text>
        </Panel>
      ) : profiles.length === 0 ? (
        <Panel variant="notice" status="info">
          <Text>{m.profiles_empty()}</Text>
        </Panel>
      ) : (
        <Stack direction="vertical" gap="md">
          {groupByType(profiles).map(([type, list]) => (
            <ProfileTypeCard key={type} type={type} profiles={list} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

/** The FHIR packages installed on the server. */
function PackagesTab({ packages }: { packages: PackageInfo[] | null }) {
  return (
    <Stack direction="vertical" gap="md">
      <Text>{m.profiles_packages_description()}</Text>
      {packages === null ? (
        <Panel variant="alert" status="error">
          <Text>{m.profiles_packages_error()}</Text>
        </Panel>
      ) : packages.length === 0 ? (
        <Panel variant="notice" status="info">
          <Text>{m.profiles_packages_empty()}</Text>
        </Panel>
      ) : (
        <Card>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeadCell>{m.profiles_package_column_id()}</Table.HeadCell>
                <Table.HeadCell>{m.profiles_column_version()}</Table.HeadCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {packages.map((pkg) => (
                <Table.Row key={pkg.id}>
                  <Table.Cell>{pkg.id}</Table.Cell>
                  <Table.Cell>{pkg.version ?? "—"}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Card>
      )}
    </Stack>
  );
}

/** One resource type and the profiles that constrain it. */
function ProfileTypeCard({ type, profiles }: { type: string; profiles: ProfileInfo[] }) {
  return (
    <Card>
      <Stack direction="vertical" gap="sm">
        <Stack direction="horizontal" gap="sm" align="end" wrap>
          <Heading as="h2">{type}</Heading>
          <Text as="span" variant="subtle">
            {String(profiles.length)}
          </Text>
        </Stack>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeadCell>{m.profiles_column_profile()}</Table.HeadCell>
              <Table.HeadCell>{m.profiles_column_version()}</Table.HeadCell>
              <Table.HeadCell>{m.profiles_column_status()}</Table.HeadCell>
              <Table.HeadCell>{m.profiles_column_canonical()}</Table.HeadCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {profiles.map((profile) => (
              <Table.Row key={profile.canonical}>
                <Table.Cell>{profile.title ?? profile.name ?? "—"}</Table.Cell>
                <Table.Cell>{profile.version ?? "—"}</Table.Cell>
                <Table.Cell>
                  {profile.status ? <Badge variant="subtle">{profile.status}</Badge> : "—"}
                </Table.Cell>
                <Table.Cell>
                  <Text as="span" variant="subtle">
                    {profile.canonical}
                  </Text>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Stack>
    </Card>
  );
}

/** Groups profiles by constrained type, types sorted alphabetically. */
function groupByType(profiles: ProfileInfo[]): [string, ProfileInfo[]][] {
  const byType = new Map<string, ProfileInfo[]>();
  for (const profile of profiles) {
    const type = profile.type ?? m.profiles_type_other();
    const list = byType.get(type) ?? [];
    list.push(profile);
    byType.set(type, list);
  }
  return [...byType.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
