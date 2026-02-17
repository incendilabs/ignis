import { Container } from "@/ui/container";
import { Header } from "@/ui/header";
import { Heading } from "@/ui/heading";
import { LinkCard } from "@/ui/link-card";
import { Main } from "@/ui/main";
import { Section } from "@/ui/section";
import { Text } from "@/ui/text";

export function meta() {
  return [
    { title: "Ignis - FHIR Experimentation Platform" },
    { name: "description", content: "Exploring and experimenting with FHIR (Fast Healthcare Interoperability Resources) standards and implementations" },
  ];
}

export default function Home() {
  return (
    <Main>
      <Container maxWidth="3xl">
        {/* Hero Section */}
        <Header className="mb-12">
          <Heading className="mb-3">Ignis</Heading>
          <Text variant="lead">FHIR experiments and prototyping</Text>
        </Header>

        {/* About */}
        <Container maxWidth="3xl" className="mb-12">
          <Text>
            Ignis is a platform for experimenting with FHIR (Fast Healthcare Interoperability Resources).
            This project builds on{" "}
            <a
              href="https://github.com/firelyteam/spark"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Firely Spark
            </a>
            , an open-source FHIR server implementation.
          </Text>
        </Container>

        {/* Resources */}
        <Section>
          <Heading as="h2" className="mb-4">
            Resources
          </Heading>
          <div className="space-y-3">
            {resources.map((resource) => (
              <LinkCard
                key={resource.name}
                href={resource.url}
                title={resource.name}
                description={resource.description}
                external
              />
            ))}
          </div>
        </Section>
      </Container>
    </Main>
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
