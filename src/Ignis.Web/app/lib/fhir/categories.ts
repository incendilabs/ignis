/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

export type ResourceCategory =
  | "clinical"
  | "care"
  | "medications"
  | "diagnostics"
  | "administrative"
  | "foundation"
  | "financial";

/** Groups common FHIR resource types the way the spec's resource index does. */
const CATEGORY_TYPES: Record<ResourceCategory, string[]> = {
  clinical: [
    "AdverseEvent", "AllergyIntolerance", "ClinicalImpression", "Condition",
    "DetectedIssue", "FamilyMemberHistory", "Flag", "Immunization",
    "ImmunizationEvaluation", "ImmunizationRecommendation", "Procedure",
    "RiskAssessment",
  ],
  care: [
    "ActivityDefinition", "Appointment", "AppointmentResponse", "CarePlan",
    "CareTeam", "DeviceRequest", "Encounter", "EpisodeOfCare", "Goal",
    "NutritionOrder", "PlanDefinition", "RequestGroup", "Schedule",
    "ServiceRequest", "Slot", "Task", "VisionPrescription",
  ],
  medications: [
    "Medication", "MedicationAdministration", "MedicationDispense",
    "MedicationKnowledge", "MedicationRequest", "MedicationStatement",
  ],
  diagnostics: [
    "BodyStructure", "DiagnosticReport", "ImagingStudy", "Media",
    "MolecularSequence", "Observation", "Specimen",
  ],
  administrative: [
    "Device", "Endpoint", "Group", "HealthcareService", "Location",
    "Organization", "OrganizationAffiliation", "Patient", "Person",
    "Practitioner", "PractitionerRole", "RelatedPerson",
  ],
  foundation: [
    "AuditEvent", "Basic", "Binary", "Bundle", "CapabilityStatement",
    "CodeSystem", "Composition", "ConceptMap", "DocumentReference", "Library",
    "List", "MessageHeader", "NamingSystem", "OperationDefinition",
    "OperationOutcome", "Parameters", "Provenance", "Questionnaire",
    "QuestionnaireResponse", "SearchParameter", "StructureDefinition",
    "StructureMap", "Subscription", "ValueSet",
  ],
  financial: [
    "Account", "ChargeItem", "Claim", "ClaimResponse", "Coverage",
    "CoverageEligibilityRequest", "CoverageEligibilityResponse",
    "ExplanationOfBenefit", "Invoice", "PaymentNotice", "PaymentReconciliation",
  ],
};

const TYPE_TO_CATEGORY = new Map<string, ResourceCategory>(
  Object.entries(CATEGORY_TYPES).flatMap(([category, types]) =>
    types.map((type) => [type, category as ResourceCategory]),
  ),
);

/** Category for a resource type, or null for types we haven't classified. */
export function resourceCategory(type: string): ResourceCategory | null {
  return TYPE_TO_CATEGORY.get(type) ?? null;
}
