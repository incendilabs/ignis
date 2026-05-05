/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Card } from "@eventuras/ratio-ui/core/Card";
import { Container } from "@eventuras/ratio-ui/layout/Container";
import { Heading } from "@eventuras/ratio-ui/core/Heading";
import { Link } from "@eventuras/ratio-ui/core/Link";
import { Panel } from "@eventuras/ratio-ui/core/Panel";
import { Section } from "@eventuras/ratio-ui/layout/Section";
import { Text } from "@eventuras/ratio-ui/core/Text";

import { m } from "@/i18n/paraglide/messages";

export function meta() {
  return [
    { title: "Ignis - FHIR Experimentation Platform" },
    { name: "description", content: "Exploring and experimenting with FHIR (Fast Healthcare Interoperability Resources) standards and implementations" },
  ];
}

export default function Home() {
  return (
    <main className="py-16">
      <Container size="md" paddingX="sm">
        <header className="mb-12">
          <Heading className="mb-3">{m.home_title()}</Heading>
          <Text size="lg">{m.home_subtitle()}</Text>
        </header>

        <Panel variant="callout" status="info" className="mb-12">
          <Text>{m.home_about()}</Text>
        </Panel>

        <Section>
          <Heading as="h2" className="mb-4">
            Resources
          </Heading>
          <div className="space-y-3">
            {resources.map((resource) => (
              <Card key={resource.name} hoverEffect>
                <Link href={resource.url} linkOverlay componentProps={{ target: "_blank", rel: "noopener noreferrer" }}>
                  <span className="font-medium">{resource.name}</span>
                </Link>
                {resource.description && (
                  <Text size="sm" variant="muted">{resource.description}</Text>
                )}
              </Card>
            ))}
          </div>
        </Section>
      </Container>
    </main>
  );
}

const resources = [
  {
    name: "Spark FHIR server",
    description: "Open-source FHIR server - the foundation of Ignis",
    url: "https://github.com/firelyteam/spark",
  },
  {
    name: "FHIR Specification",
    description: "Official HL7 FHIR documentation",
    url: "https://hl7.org/fhir/",
  },
  {
    name: "Firely .NET SDK",
    description: ".NET SDK for working with FHIR",
    url: "https://fire.ly/products/firely-net-sdk/",
  },
];
