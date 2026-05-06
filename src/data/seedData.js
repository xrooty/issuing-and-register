import { createId, normalizeReferencePattern, normalizeTemplate, normalizeTemplateDesign } from "../utils/lettering";

function normalizeCompany(company = {}) {
  return {
    ...company,
    letterNoPattern: normalizeReferencePattern(company.letterNoPattern),
  };
}

function normalizeDepartment(department = {}) {
  return {
    ...department,
    letterNoPattern: normalizeReferencePattern(department.letterNoPattern),
  };
}

export function createSeedData() {
  const crescent = {
    id: createId(),
    name: "Crescent Textile Group",
    shortCode: "CTG",
    address: "Plot 11, Industrial Estate, Lahore",
    phone: "+92 42 00000000",
    email: "info@crescenttextile.com",
    footerText: "This letter is system generated and valid without signature unless stated otherwise.",
    letterNoPattern: "{{company_code}}/{{department_code}}/{{template_code}}/{{year}}-{{month}}/{{sequence3}}",
  };

  const northwind = {
    id: createId(),
    name: "Northwind Services",
    shortCode: "NWS",
    address: "Blue Area, Islamabad",
    phone: "+92 51 00000000",
    email: "contact@northwindservices.com",
    footerText: "Confidential communication intended for the named recipient only.",
    letterNoPattern: "{{company_code}}/{{department_code}}/{{template_code}}/{{year}}-{{month}}/{{sequence3}}",
  };

  const departments = [
    {
      id: createId(),
      companyId: crescent.id,
      name: "Human Resources",
      code: "HR",
      letterNoPattern: "{{company_code}}/{{department_code}}/{{template_code}}/{{year}}-{{month}}/{{sequence3}}",
    },
    { id: createId(), companyId: crescent.id, name: "Finance", code: "FIN", letterNoPattern: "" },
    { id: createId(), companyId: northwind.id, name: "Administration", code: "ADM", letterNoPattern: "" },
  ];

  const templates = [
    normalizeTemplate({
      id: createId(),
      companyId: crescent.id,
      departmentId: departments[0].id,
      name: "Employment Confirmation",
      type: "Certificate",
      refCode: "CERT",
      defaultSubject: "Employment Confirmation",
      bodyTemplate:
        "This is to certify that {{recipient_name}} is employed with {{company_name}} under the {{department_name}} department.\n\nThis letter is issued on {{issue_date}} for official record purposes.\n\n{{body_notes}}",
      design: normalizeTemplateDesign({
        layout: "classic",
        accentColor: "#0c6b58",
        secondaryColor: "#c96a3d",
      }),
    }),
    normalizeTemplate({
      id: createId(),
      companyId: crescent.id,
      departmentId: departments[1].id,
      name: "Salary Certificate",
      type: "Certificate",
      refCode: "SAL",
      defaultSubject: "Salary Certificate",
      bodyTemplate:
        "This letter confirms that {{recipient_name}} is associated with {{company_name}}.\n\nThe requested certification is being issued by {{department_name}} on {{issue_date}}.\n\n{{body_notes}}",
      design: normalizeTemplateDesign({
        layout: "ribbon",
        accentColor: "#1d4ed8",
        secondaryColor: "#38bdf8",
        titleText: "Salary Certificate",
        canvas: {
          elements: [
            {
              id: createId(),
              type: "rect",
              x: 0,
              y: 0,
              width: 36,
              height: 10,
              backgroundColor: "#1d4ed8",
              borderColor: "#1d4ed8",
              borderWidth: 0,
              opacity: 92,
            },
            {
              id: createId(),
              type: "rect",
              x: 10,
              y: 4,
              width: 32,
              height: 6,
              backgroundColor: "#38bdf8",
              borderColor: "#38bdf8",
              borderWidth: 0,
              opacity: 90,
            },
          ],
        },
      }),
    }),
    normalizeTemplate({
      id: createId(),
      companyId: northwind.id,
      departmentId: departments[2].id,
      name: "Employee Undertaking",
      type: "Declaration",
      refCode: "UND",
      defaultSubject: "Employee Undertaking & Declaration",
      bodyTemplate:
        "This employee undertaking and declaration is executed on {{issue_date}}.\n\nEmployee: {{recipient_name}}\nCompany: {{company_name}}\nDepartment: {{department_name}}\n\n{{body_notes}}",
      design: normalizeTemplateDesign({
        layout: "declaration",
        accentColor: "#2d3fbb",
        secondaryColor: "#40c7f2",
        titleText: "Employee Undertaking & Declaration",
        canvas: {
          elements: [
            {
              id: createId(),
              type: "line",
              x: 8,
              y: 22,
              width: 84,
              height: 1,
              color: "#2d3fbb",
              borderColor: "#2d3fbb",
              borderWidth: 0,
              opacity: 90,
            },
            {
              id: createId(),
              type: "text",
              x: 8,
              y: 24,
              width: 44,
              height: 6,
              text: "Employee Name: _____________________",
              color: "#1e2321",
              fontSize: 15,
              fontWeight: "700",
              opacity: 100,
            },
            {
              id: createId(),
              type: "text",
              x: 8,
              y: 29,
              width: 44,
              height: 6,
              text: "CNIC: _____________________________",
              color: "#1e2321",
              fontSize: 15,
              fontWeight: "700",
              opacity: 100,
            },
          ],
        },
      }),
    }),
  ];

  return {
    companies: [crescent, northwind].map(normalizeCompany),
    departments: departments.map(normalizeDepartment),
    templates,
    letters: [],
    sequences: [],
  };
}

export function normalizeData(data) {
  return {
    companies: Array.isArray(data?.companies) ? data.companies.map(normalizeCompany) : [],
    departments: Array.isArray(data?.departments) ? data.departments.map(normalizeDepartment) : [],
    templates: Array.isArray(data?.templates) ? data.templates.map(normalizeTemplate) : [],
    letters: Array.isArray(data?.letters)
      ? data.letters.map((letter) => ({
          ...letter,
          letterNoFormatOverride: normalizeReferencePattern(letter?.letterNoFormatOverride),
          letterNoPatternUsed: normalizeReferencePattern(letter?.letterNoPatternUsed),
          templateSnapshot: letter.templateSnapshot ? normalizeTemplate(letter.templateSnapshot) : letter.templateSnapshot,
        }))
      : [],
    sequences: Array.isArray(data?.sequences) ? data.sequences : [],
  };
}




