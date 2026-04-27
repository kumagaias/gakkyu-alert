export interface FhirCoding {
  system?: string;
  code: string;
  display?: string;
}

export interface FhirCodeableConcept {
  coding: FhirCoding[];
  text?: string;
}

export interface FhirReference {
  reference: string;
  display?: string;
}

export interface FhirQuantity {
  value: number;
  unit: string;
  system?: string;
  code?: string;
}

export interface FhirObservationComponent {
  code: FhirCodeableConcept;
  valueQuantity?: FhirQuantity;
  valueInteger?: number;
}

export interface FhirObservation {
  resourceType: "Observation";
  id: string;
  status: "final" | "preliminary";
  category: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject?: FhirReference;
  effectiveDateTime?: string;
  valueInteger?: number;
  valueQuantity?: FhirQuantity;
  note?: Array<{ text: string }>;
  component?: FhirObservationComponent[];
}

export interface FhirLocation {
  resourceType: "Location";
  id: string;
  name: string;
  description?: string;
  alias?: string[];
  address?: {
    country: string;
    state?: string;
    city?: string;
    text?: string;
  };
  extension?: Array<{
    url: string;
    valueInteger?: number;
    valueString?: string;
  }>;
}

export interface FhirDiagnosticReport {
  resourceType: "DiagnosticReport";
  id: string;
  status: "final" | "preliminary";
  category: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject?: FhirReference;
  effectiveDateTime: string;
  conclusion: string;
  result?: FhirReference[];
  contained?: FhirObservation[];
}

export interface FhirBundleEntry<T> {
  fullUrl?: string;
  resource: T;
}

export interface FhirBundle<T> {
  resourceType: "Bundle";
  type: "collection" | "searchset";
  total: number;
  entry: FhirBundleEntry<T>[];
}
