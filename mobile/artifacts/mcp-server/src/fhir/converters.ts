import type {
  DiseaseStatus,
  DistrictStatus,
  StatusResponse,
} from "../client/api.js";
import type {
  FhirBundle,
  FhirDiagnosticReport,
  FhirLocation,
  FhirObservation,
} from "./types.js";

const SURVEY_CAT = {
  coding: [
    {
      system: "http://terminology.hl7.org/CodeSystem/observation-category",
      code: "survey",
      display: "Survey",
    },
  ],
};

const DISTRICT_META: Record<string, { name: string; city: string; en: string }> = {
  nerima: { name: "練馬区", city: "Nerima-ku", en: "Nerima" },
  suginami: { name: "杉並区", city: "Suginami-ku", en: "Suginami" },
  musashino: { name: "武蔵野市", city: "Musashino-shi", en: "Musashino" },
};

const DISEASE_META: Record<string, { display: string; snomedCode?: string }> = {
  "flu-a": { display: "Influenza", snomedCode: "6142004" },
  covid: { display: "COVID-19", snomedCode: "840539006" },
  rsv: { display: "RSV infection", snomedCode: "55735004" },
  "hand-foot": { display: "Hand, foot and mouth disease", snomedCode: "403101005" },
  herpangina: { display: "Herpangina", snomedCode: "60698007" },
  gastro: { display: "Infectious gastroenteritis", snomedCode: "87628006" },
  measles: { display: "Measles", snomedCode: "14189004" },
  rubella: { display: "Rubella", snomedCode: "36653000" },
  chickenpox: { display: "Varicella", snomedCode: "38907003" },
  adeno: { display: "Pharyngoconjunctival fever", snomedCode: "6142004" },
  mycoplasma: { display: "Mycoplasma pneumonia", snomedCode: "233719004" },
  pertussis: { display: "Pertussis", snomedCode: "27836007" },
  strep: { display: "Streptococcal infection", snomedCode: "43878008" },
  mumps: { display: "Mumps", snomedCode: "36989005" },
};

function diseaseCode(id: string) {
  const meta = DISEASE_META[id];
  const codings = meta?.snomedCode
    ? [{ system: "http://snomed.info/sct", code: meta.snomedCode, display: meta.display }]
    : [{ system: "https://gakkyu-alert.example.com/disease", code: id }];
  return { coding: codings, text: meta?.display ?? id };
}

// ── Districts → FHIR Location Bundle ────────────────────────────────────────

export function districtsToLocationBundle(
  districts: DistrictStatus[]
): FhirBundle<FhirLocation> {
  const entries = districts.map((d) => {
    const meta = DISTRICT_META[d.id];
    const location: FhirLocation = {
      resourceType: "Location",
      id: d.id,
      name: meta?.name ?? d.id,
      alias: meta ? [meta.city] : [],
      address: { country: "JP", state: "Tokyo", city: meta?.city, text: meta?.name },
      extension: [
        {
          url: "https://gakkyu-alert.example.com/fhir/StructureDefinition/outbreak-level",
          valueInteger: d.level,
        },
        {
          url: "https://gakkyu-alert.example.com/fhir/StructureDefinition/ai-summary",
          valueString: d.aiSummary,
        },
      ],
    };
    return { fullUrl: `urn:uuid:location-${d.id}`, resource: location };
  });

  return { resourceType: "Bundle", type: "searchset", total: entries.length, entry: entries };
}

// ── Disease → FHIR Observation Bundle ───────────────────────────────────────

export function diseasesToObservationBundle(
  diseases: DiseaseStatus[],
  asOf: string,
  districtId?: string
): FhirBundle<FhirObservation> {
  const subject = districtId
    ? { reference: `Location/${districtId}`, display: DISTRICT_META[districtId]?.name }
    : undefined;

  const entries = diseases.map((d) => {
    const obs: FhirObservation = {
      resourceType: "Observation",
      id: `disease-${d.id}-${asOf.slice(0, 10)}`,
      status: "final",
      category: [SURVEY_CAT],
      code: diseaseCode(d.id),
      ...(subject && { subject }),
      effectiveDateTime: asOf,
      valueInteger: d.currentCount,
      note: d.aiComment ? [{ text: d.aiComment }] : [],
      component: d.weeklyHistory.map((count, i) => ({
        code: {
          coding: [
            {
              system: "https://gakkyu-alert.example.com/fhir/CodeSystem/weekly-history",
              code: `week-minus-${d.weeklyHistory.length - 1 - i}`,
              display: `Week -${d.weeklyHistory.length - 1 - i}`,
            },
          ],
        },
        valueInteger: count,
      })),
    };
    return { fullUrl: `urn:uuid:disease-${d.id}`, resource: obs };
  });

  return { resourceType: "Bundle", type: "searchset", total: entries.length, entry: entries };
}

// ── School closures → FHIR Observation Bundle ───────────────────────────────

export function schoolClosuresToObservationBundle(
  status: StatusResponse,
  districtId?: string
): FhirBundle<FhirObservation> {
  const { schoolClosures } = status;
  const subject = districtId
    ? { reference: `Location/${districtId}`, display: DISTRICT_META[districtId]?.name }
    : undefined;

  const closureCat = {
    coding: [
      {
        system: "https://gakkyu-alert.example.com/fhir/CodeSystem/observation-category",
        code: "school-closure",
        display: "School Closure",
      },
    ],
  };

  const entries = schoolClosures.entries.map((e) => {
    const obs: FhirObservation = {
      resourceType: "Observation",
      id: `closure-${e.diseaseId}-${schoolClosures.lastUpdated}`,
      status: "final",
      category: [closureCat],
      code: {
        coding: [{ system: "https://gakkyu-alert.example.com/disease", code: e.diseaseId }],
        text: e.diseaseName,
      },
      ...(subject && { subject }),
      effectiveDateTime: schoolClosures.lastUpdated,
      valueInteger: e.closedClasses,
      component: e.weeklyHistory.map((count, i) => ({
        code: {
          coding: [
            {
              system: "https://gakkyu-alert.example.com/fhir/CodeSystem/weekly-history",
              code: `week-minus-${e.weeklyHistory.length - 1 - i}`,
            },
          ],
        },
        valueInteger: count,
      })),
    };
    return { fullUrl: `urn:uuid:closure-${e.diseaseId}`, resource: obs };
  });

  return { resourceType: "Bundle", type: "searchset", total: entries.length, entry: entries };
}

// ── District + diseases → FHIR DiagnosticReport ─────────────────────────────

export function toDiagnosticReport(
  status: StatusResponse,
  districtId: string
): FhirDiagnosticReport {
  const district = status.districts.find((d) => d.id === districtId);
  const diseases = status.diseases;
  const meta = DISTRICT_META[districtId];

  const contained: FhirObservation[] = diseases.map((d) => ({
    resourceType: "Observation",
    id: `obs-${d.id}`,
    status: "final",
    category: [SURVEY_CAT],
    code: diseaseCode(d.id),
    effectiveDateTime: status.asOf,
    valueInteger: d.currentCount,
  }));

  const conclusion = district
    ? `[${meta?.name ?? districtId}] ${district.aiSummary}`
    : diseases
        .map((d) => `${DISEASE_META[d.id]?.display ?? d.id}: level ${d.currentLevel}`)
        .join("; ");

  return {
    resourceType: "DiagnosticReport",
    id: `report-${districtId}-${status.asOf.slice(0, 10)}`,
    status: "final",
    category: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v2-0074",
            code: "PH",
            display: "Public Health",
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: "https://gakkyu-alert.example.com/fhir/CodeSystem/report-type",
          code: "school-outbreak-surveillance",
          display: "School Outbreak Surveillance Weekly Report",
        },
      ],
    },
    subject: { reference: `Location/${districtId}`, display: meta?.name },
    effectiveDateTime: status.asOf,
    conclusion,
    result: contained.map((o) => ({ reference: `#${o.id}` })),
    contained,
  };
}
