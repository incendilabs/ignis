import { Card } from "@eventuras/ratio-ui/core/Card";
import { Container } from "@eventuras/ratio-ui/layout/Container";
import { Heading } from "@eventuras/ratio-ui/core/Heading";
import { Link } from "@eventuras/ratio-ui/core/Link";
import { Panel } from "@eventuras/ratio-ui/core/Panel";
import { Section } from "@eventuras/ratio-ui/layout/Section";
import { Text } from "@eventuras/ratio-ui/core/Text";

export function meta() {
  return [
    { title: "Ignis - FHIR Experimentation Platform" },
    { name: "description", content: "Exploring and experimenting with FHIR (Fast Healthcare Interoperability Resources) standards and implementations" },
  ];
}

export default function Home() {
  return (
    <main className="py-16">
      <Container className="max-w-3xl">
        <header className="mb-12">
          <Heading className="mb-3">Ignis</Heading>
          <Text size="lg">FHIR experiments and prototyping</Text>
        </header>

        <Panel variant="callout" status="info" className="mb-12">
          <Text>
            Ignis is a platform for experimenting with FHIR (Fast Healthcare Interoperability Resources).
            This project builds on{" "}
            <Link
              href="https://github.com/firelyteam/spark"
              componentProps={{ target: "_blank", rel: "noopener noreferrer" }}
            >
              Firely Spark
            </Link>
            , an open-source FHIR server implementation.
          </Text>
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
    name: "Firely Spark",
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
