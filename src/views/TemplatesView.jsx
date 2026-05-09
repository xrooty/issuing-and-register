import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import EmptyState from "../components/EmptyState";
import {
  DEFAULT_REFERENCE_PATTERN,
  ISSUE_LETTER_TYPE_OPTIONS,
  LETTER_FIELD_OPTIONS,
  createId,
  getTemplateDynamicTokenFields,
  normalizeCustomFieldKey,
  normalizeReferencePattern,
  normalizeTemplateCustomFields,
  normalizeTemplateDesign,
  normalizeTemplateDesignForIssueType,
  templateMatchesIssueLetterType,
} from "../utils/lettering";

const DESIGN_LAYOUTS = [
  { value: "classic", label: "Classic Letterhead" },
  { value: "ribbon", label: "Ribbon Corporate" },
  { value: "declaration", label: "Declaration Form" },
];

const RENDER_MODES = [
  { value: "standard", label: "Structured Layout" },
  { value: "background", label: "Background + Canvas Mapping" },
];

const BACKGROUND_FITS = [
  { value: "cover", label: "Cover" },
  { value: "contain", label: "Contain" },
  { value: "fill", label: "Fill" },
];

const ELEMENT_TYPES = [
  { value: "text", label: "Text" },
  { value: "rect", label: "Box" },
  { value: "line", label: "Line" },
  { value: "field", label: "Field" },
];

const DEFAULT_TEMPLATE_TYPE_OPTIONS = [
  { code: "LETTER", name: "Letter" },
  { code: "AG", name: "AG" },
];

const CUSTOM_FIELD_TYPES = [
  { value: "text", label: "Single line" },
  { value: "textarea", label: "Multi-line" },
];

const FONT_FAMILY_OPTIONS = [
  { value: "inherit", label: "Default" },
  { value: "'Poppins', 'Segoe UI', sans-serif", label: "Poppins" },
  { value: "'Montserrat', 'Segoe UI', sans-serif", label: "Montserrat" },
  { value: "'Inter', 'Segoe UI', sans-serif", label: "Inter" },
  { value: "'Roboto', 'Segoe UI', sans-serif", label: "Roboto" },
  { value: "'Open Sans', 'Segoe UI', sans-serif", label: "Open Sans" },
  { value: "'Lato', 'Segoe UI', sans-serif", label: "Lato" },
  { value: "'Nunito', 'Segoe UI', sans-serif", label: "Nunito" },
  { value: "'Oswald', 'Segoe UI', sans-serif", label: "Oswald" },
  { value: "'Playfair Display', Georgia, serif", label: "Playfair Display" },
  { value: "'Merriweather', Georgia, serif", label: "Merriweather" },
  { value: "'Segoe UI', Tahoma, sans-serif", label: "System Sans" },
  { value: "Georgia, 'Times New Roman', serif", label: "System Serif" },
  { value: "'Courier New', monospace", label: "Monospace" },
];

const REFERENCE_FORMAT_TOKENS = [
  "{{company_code}}",
  "{{department_code}}",
  "{{template_code}}",
  "{{year}}",
  "{{yy}}",
  "{{month}}",
  "{{day}}",
  "{{sequence}}",
  "{{sequence2}}",
  "{{sequence3}}",
  "{{sequence4}}",
  "____",
];

const INLINE_MARKDOWN_PATTERN = /(\+\+[^+\n]+?\+\+|\*\*[^*\n]+?\*\*|__[^_\n]+?__|\*[^*\n]+?\*|_[^_\n]+?_)/g;

const A4_CANVAS_WIDTH = 794;
const A4_CANVAS_HEIGHT = 1123;
const LEGAL_CANVAS_WIDTH = 816;
const LEGAL_CANVAS_HEIGHT = 1344;
const MINI_PREVIEW_SCALE = 0.34;
const MAX_CANVAS_HISTORY = 200;
const SNAP_THRESHOLD_PERCENT = 0.9;
const DRAG_ACTIVATION_DISTANCE_PX = 4;

const BACKGROUND_TEXT_PRESET = [
  {
    text: "Letter No: {{letter_no}}\nDate: {{issue_date}}\nDept: {{department_name}}",
    x: 64,
    y: 8,
    width: 28,
    height: 12,
    fontSize: 11,
    fontWeight: "700",
    align: "right",
  },
  {
    text: "To: {{recipient_name}}",
    x: 8,
    y: 34,
    width: 84,
    height: 5,
    fontSize: 13,
    fontWeight: "700",
    align: "left",
  },
  {
    text: "Company: {{recipient_company}}",
    x: 8,
    y: 39,
    width: 84,
    height: 5,
    fontSize: 12,
    fontWeight: "400",
    align: "left",
  },
  {
    text: "{{body_text}}",
    x: 8,
    y: 45,
    width: 84,
    height: 32,
    fontSize: 12,
    fontWeight: "400",
    align: "left",
  },
  {
    text: "Prepared By\n{{prepared_by}}",
    x: 8,
    y: 82,
    width: 36,
    height: 8,
    fontSize: 12,
    fontWeight: "700",
    align: "left",
  },
  {
    text: "Approved By\n{{approved_by}}",
    x: 56,
    y: 82,
    width: 36,
    height: 8,
    fontSize: 12,
    fontWeight: "700",
    align: "left",
  },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getLineStrokeWidth(element) {
  const explicitWidth = Number(element?.borderWidth);
  if (Number.isFinite(explicitWidth) && explicitWidth > 0) {
    return explicitWidth;
  }

  const fromHeight = Number(element?.height);
  if (Number.isFinite(fromHeight) && fromHeight > 0) {
    return clamp(Math.round(fromHeight), 1, 24);
  }

  return 2;
}

function uniqueNumeric(values = []) {
  return Array.from(
    new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
        .map((value) => Number(value.toFixed(3))),
    ),
  );
}

function normalizeTemplateTypeKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function createDuplicatedElement(sourceElement, zIndex) {
  const width = clamp(Number(sourceElement?.width || 20), 1, 100);
  const height = clamp(Number(sourceElement?.height || 8), 0.8, 100);
  const x = clamp(Number(sourceElement?.x || 0) + 1.8, 0, 100 - width);
  const y = clamp(Number(sourceElement?.y || 0) + 1.8, 0, 100 - height);

  return {
    ...sourceElement,
    id: createId(),
    x,
    y,
    pageIndex: Math.max(0, Number(sourceElement?.pageIndex || 0)),
    zIndex,
  };
}

function collectAxisTargets(elements, activeElementId, axis) {
  const targets = [0, 50, 100];

  elements.forEach((element) => {
    if (!element || element.id === activeElementId) {
      return;
    }

    if (axis === "x") {
      const left = Number(element.x || 0);
      const width = Number(element.width || 0);
      targets.push(left, left + width / 2, left + width);
      return;
    }

    const top = Number(element.y || 0);
    const height = Number(element.height || 0);
    targets.push(top, top + height / 2, top + height);
  });

  return uniqueNumeric(targets);
}

function findAxisSnap(start, size, targets) {
  const anchors = [
    { value: start, shift: 0 },
    { value: start + size / 2, shift: -(size / 2) },
    { value: start + size, shift: -size },
  ];

  let best = null;

  targets.forEach((target) => {
    anchors.forEach((anchor) => {
      const candidateStart = target + anchor.shift;
      const delta = candidateStart - start;
      const absDelta = Math.abs(delta);

      if (absDelta > SNAP_THRESHOLD_PERCENT) {
        return;
      }

      if (!best || absDelta < best.absDelta) {
        best = { delta, target, absDelta };
      }
    });
  });

  if (!best) {
    return { value: start, guide: null };
  }

  return {
    value: start + best.delta,
    guide: best.target,
  };
}

function cloneCanvasElements(elements = []) {
  return elements.map((element) => ({ ...element }));
}

function canvasSnapshotSignature(elements = []) {
  return JSON.stringify(elements);
}

function parseInlineToken(match) {
  const token = String(match || "");

  if (token.startsWith("++") && token.endsWith("++")) {
    return { kind: "underline", openLength: 2, closeLength: 2 };
  }

  if ((token.startsWith("**") && token.endsWith("**")) || (token.startsWith("__") && token.endsWith("__"))) {
    return { kind: "bold", openLength: 2, closeLength: 2 };
  }

  return { kind: "italic", openLength: 1, closeLength: 1 };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function markdownToEditableHtml(sourceText) {
  const escaped = escapeHtml(sourceText);
  const withUnderline = escaped.replace(/\+\+([^+\n]+?)\+\+/g, "<u>$1</u>");
  const withBold = withUnderline
    .replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+?)__/g, "<strong>$1</strong>");
  const withItalic = withBold
    .replace(/\*([^*\n]+?)\*/g, "<em>$1</em>")
    .replace(/_([^_\n]+?)_/g, "<em>$1</em>");
  return withItalic.replace(/\n/g, "<br>");
}

function serializeEditableNode(node) {
  if (!node) {
    return "";
  }

  const nodeType = Number(node.nodeType || 0);

  if (nodeType === 3) {
    return String(node.nodeValue || "");
  }

  if (nodeType !== 1) {
    return "";
  }

  const tag = String(node.nodeName || "").toLowerCase();
  if (tag === "br") {
    return "\n";
  }

  const children = Array.from(node.childNodes || []).map((child) => serializeEditableNode(child)).join("");

  if (tag === "strong" || tag === "b") {
    return `**${children}**`;
  }

  if (tag === "u") {
    return `++${children}++`;
  }

  if (tag === "em" || tag === "i") {
    return `_${children}_`;
  }

  if (tag === "div" || tag === "p") {
    return `${children}\n`;
  }

  if (tag === "span") {
    const style = String(node.getAttribute?.("style") || "");
    let value = children;

    if (/font-weight\s*:\s*(bold|[6-9]00)/i.test(style)) {
      value = `**${value}**`;
    }
    if (/text-decoration[^;]*underline/i.test(style)) {
      value = `++${value}++`;
    }
    if (/font-style\s*:\s*italic/i.test(style)) {
      value = `_${value}_`;
    }

    return value;
  }

  return children;
}

function editableHtmlToMarkdown(html) {
  if (!html) {
    return "";
  }

  if (typeof document === "undefined") {
    return String(html || "");
  }

  const container = document.createElement("div");
  container.innerHTML = String(html);
  let text = Array.from(container.childNodes || []).map((node) => serializeEditableNode(node)).join("");
  text = text.replace(/\u00a0/g, " ");
  text = text.replace(/\r/g, "");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.replace(/^\n+/, "").replace(/\n+$/, "");
  return text;
}

function getInlineVisibleLength(text, depth = 0) {
  const source = String(text || "");
  if (!source) {
    return 0;
  }

  if (depth >= 5) {
    return source.length;
  }

  let visible = 0;
  let cursor = 0;
  const regex = new RegExp(INLINE_MARKDOWN_PATTERN.source, "g");
  let match = regex.exec(source);

  while (match) {
    const offset = Number(match.index || 0);
    if (offset > cursor) {
      visible += offset - cursor;
    }

    const token = match[0];
    const { openLength, closeLength } = parseInlineToken(token);
    const inner = token.slice(openLength, token.length - closeLength);
    visible += getInlineVisibleLength(inner, depth + 1);

    cursor = offset + token.length;
    match = regex.exec(source);
  }

  if (cursor < source.length) {
    visible += source.length - cursor;
  }

  return visible;
}

function mapDisplayIndexToSource(sourceText, displayIndex) {
  const source = String(sourceText || "");
  let safeIndex = Number(displayIndex);
  if (!Number.isFinite(safeIndex)) {
    safeIndex = 0;
  }
  safeIndex = Math.max(0, safeIndex);

  let sourceCursor = 0;
  let displayCursor = 0;

  const regex = new RegExp(INLINE_MARKDOWN_PATTERN.source, "g");
  let match = regex.exec(source);

  while (match) {
    const offset = Number(match.index || 0);
    const token = match[0];

    if (offset > sourceCursor) {
      const plainLength = offset - sourceCursor;
      if (safeIndex <= displayCursor + plainLength) {
        return clamp(sourceCursor + (safeIndex - displayCursor), 0, source.length);
      }

      displayCursor += plainLength;
      sourceCursor = offset;
    }

    const { openLength, closeLength } = parseInlineToken(token);
    const inner = token.slice(openLength, token.length - closeLength);
    const visibleLength = getInlineVisibleLength(inner, 1);

    if (safeIndex <= displayCursor + visibleLength) {
      const mappedInnerIndex = mapDisplayIndexToSource(inner, safeIndex - displayCursor);
      return clamp(sourceCursor + openLength + mappedInnerIndex, 0, source.length);
    }

    displayCursor += visibleLength;
    sourceCursor = offset + token.length;
    match = regex.exec(source);
  }

  const tailLength = source.length - sourceCursor;
  if (safeIndex <= displayCursor + tailLength) {
    return clamp(sourceCursor + (safeIndex - displayCursor), 0, source.length);
  }

  return source.length;
}

function renderEditorInlineMarkdown(text, keyPrefix, depth = 0) {
  const source = String(text ?? "");
  if (!source) {
    return "";
  }

  const nodes = [];
  let lastIndex = 0;
  let partIndex = 0;

  source.replace(INLINE_MARKDOWN_PATTERN, (match, _group, offset) => {
    if (offset > lastIndex) {
      nodes.push(source.slice(lastIndex, offset));
    }

    const { kind, openLength, closeLength } = parseInlineToken(match);
    const content = match.slice(openLength, match.length - closeLength);

    if (content) {
      const renderedContent =
        depth >= 5
          ? content
          : renderEditorInlineMarkdown(content, `${keyPrefix}-n-${partIndex}`, depth + 1);

      if (kind === "bold") {
        nodes.push(
          <strong key={`${keyPrefix}-b-${partIndex}`}>
            {renderedContent}
          </strong>,
        );
      } else if (kind === "underline") {
        nodes.push(
          <u key={`${keyPrefix}-u-${partIndex}`}>
            {renderedContent}
          </u>,
        );
      } else {
        nodes.push(
          <em key={`${keyPrefix}-i-${partIndex}`}>
            {renderedContent}
          </em>,
        );
      }
      partIndex += 1;
    } else {
      nodes.push(match);
    }

    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < source.length) {
    nodes.push(source.slice(lastIndex));
  }

  return nodes.length ? nodes : source;
}

function renderEditorMarkdownBlocks(text, keyPrefix) {
  const lines = String(text ?? "").split("\n");

  return lines.map((line, index) => (
    <Fragment key={`${keyPrefix}-${index}`}>
      {renderEditorInlineMarkdown(line, `${keyPrefix}-line-${index}`)}
      {index < lines.length - 1 ? <br /> : null}
    </Fragment>
  ));
}

function getInitialForm(overrides = {}) {
  const { design, ...restOverrides } = overrides;

  return {
    companyId: "",
    departmentId: "",
    name: "",
    type: "",
    defaultSubject: "",
    refCode: "",
    letterNoPattern: "",
    bodyTemplate: "",
    ...restOverrides,
    design: normalizeTemplateDesign(design),
  };
}

function createCanvasElement(type) {
  if (type === "line") {
    return {
      id: createId(),
      pageIndex: 0,
      type,
      x: 10,
      y: 12,
      width: 36,
      height: 1.4,
      zIndex: 0,
      text: "",
      color: "#1e2321",
      backgroundColor: "transparent",
      borderColor: "#1e2321",
      borderWidth: 2,
      fontSize: 16,
      fontFamily: "inherit",
      fontWeight: "400",
      textDecoration: "none",
      align: "left",
      opacity: 100,
      paddingX: 0,
      paddingY: 0,
      lineHeight: 1.35,
      letterSpacing: 0,
    };
  }

  if (type === "rect") {
    return {
      id: createId(),
      pageIndex: 0,
      type,
      x: 10,
      y: 10,
      width: 20,
      height: 12,
      zIndex: 0,
      text: "",
      color: "#1e2321",
      backgroundColor: "#dbeafe",
      borderColor: "#1e2321",
      borderWidth: 1,
      fontSize: 16,
      fontFamily: "inherit",
      fontWeight: "400",
      textDecoration: "none",
      align: "left",
      opacity: 90,
      paddingX: 0,
      paddingY: 0,
      lineHeight: 1.35,
      letterSpacing: 0,
    };
  }

  if (type === "field") {
    return {
      id: createId(),
      pageIndex: 0,
      type: "field",
      x: 10,
      y: 10,
      width: 38,
      height: 5,
      zIndex: 0,
      text: "Field Label",
      fieldKey: "recipient_name",
      color: "#1e2321",
      backgroundColor: "transparent",
      borderColor: "transparent",
      borderWidth: 0,
      fontSize: 14,
      fontFamily: "inherit",
      fontWeight: "700",
      textDecoration: "none",
      align: "left",
      opacity: 100,
      paddingX: 6,
      paddingY: 4,
      lineHeight: 1.35,
      letterSpacing: 0,
    };
  }

  return {
    id: createId(),
    pageIndex: 0,
    type: "text",
    x: 10,
    y: 10,
    width: 34,
    height: 8,
    zIndex: 0,
    text: "Editable heading",
    color: "#1e2321",
    backgroundColor: "transparent",
    borderColor: "transparent",
    borderWidth: 0,
    fontSize: 18,
    fontFamily: "inherit",
    fontWeight: "700",
    textDecoration: "none",
    align: "left",
    opacity: 100,
    paddingX: 6,
    paddingY: 4,
    lineHeight: 1.35,
    letterSpacing: 0,
  };
}

function createBackgroundTextElements() {
  return BACKGROUND_TEXT_PRESET.map((item, index) => ({
    id: createId(),
    pageIndex: 0,
    type: "text",
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    zIndex: index,
    text: item.text,
    color: "#1e2321",
    backgroundColor: "transparent",
    borderColor: "transparent",
    borderWidth: 0,
    fontSize: item.fontSize,
    fontFamily: "inherit",
    fontWeight: item.fontWeight,
    textDecoration: "none",
    align: item.align,
    opacity: 100,
    paddingX: 6,
    paddingY: 4,
    lineHeight: 1.35,
    letterSpacing: 0,
  }));
}

function createCustomFieldDraft() {
  return {
    label: "",
    key: "",
    placeholder: "",
    defaultValue: "",
    type: "text",
    required: false,
  };
}

function getElementLabel(element, index) {
  const order = index + 1;

  if (element.type === "text") {
    const firstLine = (element.text || "")
      .split("\n")
      .map((item) => item.trim())
      .find(Boolean);

    return firstLine ? `${order}. ${firstLine}` : `${order}. Text`;
  }

  if (element.type === "rect") {
    return `${order}. Box`;
  }

  if (element.type === "field") {
    return `${order}. Field: ${element.fieldKey || "value"}`;
  }

  return `${order}. Line`;
}

export default function TemplatesView({
  companies,
  departments,
  templateTypes = [],
  templates,
  onAddTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onDuplicateTemplate,
  onBulkDeleteTemplates,
  onAddTemplateType,
  onDeleteTemplateType,
  editTemplateId,
  onConsumeEditTarget,
}) {
  const [form, setForm] = useState(() => getInitialForm());
  const [newTemplateTypeName, setNewTemplateTypeName] = useState("");
  const [selectedElementId, setSelectedElementId] = useState("");
  const [selectedElementIds, setSelectedElementIds] = useState([]);
  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [selectedTemplateIds, setSelectedTemplateIds] = useState([]);
  const [templateListTypeFilter, setTemplateListTypeFilter] = useState("ALL");
  const [templateListCompanyFilter, setTemplateListCompanyFilter] = useState("ALL");
  const [templateListDepartmentFilter, setTemplateListDepartmentFilter] = useState("ALL");
  const [isFullscreenEditorOpen, setIsFullscreenEditorOpen] = useState(false);
  const [activeEditorPageIndex, setActiveEditorPageIndex] = useState(0);
  const [isEditorSidebarCollapsed, setIsEditorSidebarCollapsed] = useState(false);
  const [activeEditorSidebarSection, setActiveEditorSidebarSection] = useState("pages");
  const [isEditorInspectorOpen, setIsEditorInspectorOpen] = useState(true);
  const [inlineTextEditElementId, setInlineTextEditElementId] = useState("");
  const [editorZoomPercent, setEditorZoomPercent] = useState(100);
  const [canvasHistory, setCanvasHistory] = useState({ past: [], future: [] });
  const [showAdvancedBuilder, setShowAdvancedBuilder] = useState(false);
  const [copiedCanvasElement, setCopiedCanvasElement] = useState(null);
  const [alignmentGuides, setAlignmentGuides] = useState({ vertical: null, horizontal: null });
  const [customFieldDraft, setCustomFieldDraft] = useState(() => createCustomFieldDraft());
  const inlineCanvasRef = useRef(null);
  const fullscreenCanvasRef = useRef(null);
  const fullscreenViewportRef = useRef(null);
  const canvasTextNodeRefs = useRef(new Map());
  const textEditorRef = useRef(null);
  const textSelectionRef = useRef({ start: 0, end: 0, source: "raw", elementId: "" });
  const pendingInlineCaretRef = useRef(null);
  const interactionRef = useRef(null);
  const canvasElementsRef = useRef(form.design.canvas.elements || []);

  const templateTypeOptions = [...DEFAULT_TEMPLATE_TYPE_OPTIONS, ...templateTypes].reduce((options, type) => {
    const name = String(type?.name || "").trim();
    if (!name) {
      return options;
    }

    const key = normalizeTemplateTypeKey(type?.code || name);
    if (!key || options.some((option) => normalizeTemplateTypeKey(option.code || option.name) === key)) {
      return options;
    }

    return [
      ...options,
      {
        id: type?.id || "",
        code: type?.code || key,
        name,
      },
    ];
  }, []);
  const selectedTemplateType = templateTypeOptions.find((type) => type.name === form.type) || null;
  const templateListDepartmentOptions = useMemo(
    () =>
      templateListCompanyFilter === "ALL"
        ? departments
        : departments.filter((department) => department.companyId === templateListCompanyFilter),
    [departments, templateListCompanyFilter],
  );
  const filteredTemplates = useMemo(
    () =>
      templates.filter((template) => {
        if (templateListTypeFilter !== "ALL" && !templateMatchesIssueLetterType(template, templateListTypeFilter)) {
          return false;
        }

        if (templateListCompanyFilter !== "ALL" && template.companyId !== templateListCompanyFilter) {
          return false;
        }

        if (templateListDepartmentFilter !== "ALL" && template.departmentId !== templateListDepartmentFilter) {
          return false;
        }

        return true;
      }),
    [templateListCompanyFilter, templateListDepartmentFilter, templateListTypeFilter, templates],
  );
  const filteredTemplateIdSet = useMemo(
    () => new Set(filteredTemplates.map((template) => template.id)),
    [filteredTemplates],
  );
  const selectedFilteredTemplateIds = selectedTemplateIds.filter((id) => filteredTemplateIdSet.has(id));
  const customFieldDefinitions = form.design.customFields || [];
  const detectedDynamicTokenFields = getTemplateDynamicTokenFields({ ...form, design: form.design });
  const requiredTokenKeySet = new Set(form.design.requiredTokenKeys || []);
  const activePageSize = String(form.design.pageSize || "A4").toUpperCase() === "LEGAL" ? "LEGAL" : "A4";
  const canvasWidth = activePageSize === "LEGAL" ? LEGAL_CANVAS_WIDTH : A4_CANVAS_WIDTH;
  const canvasHeight = activePageSize === "LEGAL" ? LEGAL_CANVAS_HEIGHT : A4_CANVAS_HEIGHT;
  const totalTemplatePages = Math.max(1, Number(form.design.additionalPages || 1));
  const templatePageIndexes = useMemo(
    () => Array.from({ length: totalTemplatePages }, (_, index) => index),
    [totalTemplatePages],
  );
  const allCanvasElements = useMemo(
    () => [...(form.design.canvas.elements || [])].sort((left, right) => left.zIndex - right.zIndex),
    [form.design.canvas.elements],
  );
  const visibleCanvasElements = useMemo(
    () => (form.design.canvas.elements || []).filter((element) => Number(element.pageIndex || 0) === activeEditorPageIndex),
    [activeEditorPageIndex, form.design.canvas.elements],
  );
  const customFieldTokenOptions = customFieldDefinitions.map((field) => ({
    label: field.label,
    key: `cf_${field.key}`,
    token: `{{cf_${field.key}}}`,
  }));
  const defaultCanvasFieldOptions = [
    ...LETTER_FIELD_OPTIONS.map((option) => ({
      key: option.key,
      label: option.label,
      token: `{{${option.key}}}`,
    })),
    ...customFieldTokenOptions,
  ];
  const canvasFieldOptionMap = new Map(defaultCanvasFieldOptions.map((option) => [option.key, option]));
  (form.design.canvas?.elements || [])
    .filter((element) => element.type === "field" && element.fieldKey)
    .forEach((element) => {
      if (!canvasFieldOptionMap.has(element.fieldKey)) {
        canvasFieldOptionMap.set(element.fieldKey, {
          key: element.fieldKey,
          label: element.fieldKey,
          token: `{{${element.fieldKey}}}`,
        });
      }
    });
  const canvasFieldOptions = Array.from(canvasFieldOptionMap.values());
  const canUndoCanvas = canvasHistory.past.length > 0;
  const canRedoCanvas = canvasHistory.future.length > 0;

  useEffect(() => {
    canvasElementsRef.current = form.design.canvas.elements || [];
  }, [form.design.canvas.elements]);

  useEffect(() => {
    if (!form.companyId && companies[0]?.id) {
      setForm((current) => ({ ...current, companyId: companies[0].id }));
    }
  }, [companies, form.companyId]);

  useEffect(() => {
    if (!form.type && templateTypeOptions[0]?.name) {
      setForm((current) => ({ ...current, type: templateTypeOptions[0].name }));
    }
  }, [form.type, templateTypeOptions]);

  useEffect(() => {
    if (templateListDepartmentFilter === "ALL") {
      return;
    }

    const departmentIsVisible = templateListDepartmentOptions.some((department) => department.id === templateListDepartmentFilter);
    if (!departmentIsVisible) {
      setTemplateListDepartmentFilter("ALL");
    }
  }, [templateListDepartmentFilter, templateListDepartmentOptions]);

  const departmentOptions = departments.filter((department) => department.companyId === form.companyId);

  useEffect(() => {
    if (!departmentOptions.some((department) => department.id === form.departmentId)) {
      setForm((current) => ({ ...current, departmentId: departmentOptions[0]?.id || "" }));
    }
  }, [departmentOptions, form.departmentId]);

  useEffect(() => {
    if (activeEditorPageIndex >= totalTemplatePages) {
      setActiveEditorPageIndex(Math.max(0, totalTemplatePages - 1));
    }
  }, [activeEditorPageIndex, totalTemplatePages]);

  useEffect(() => {
    const currentElements = visibleCanvasElements;
    if (!currentElements.some((element) => element.id === selectedElementId)) {
      setSelectedElementId(currentElements[0]?.id || "");
    }
  }, [visibleCanvasElements, selectedElementId]);

  useEffect(() => {
    const currentElements = visibleCanvasElements || [];
    const currentIdSet = new Set(currentElements.map((element) => element.id));

    setSelectedElementIds((current) => {
      const source = Array.isArray(current) ? current : [];
      const filtered = source.filter((id) => currentIdSet.has(id));
      const sameIds = (left, right) => left.length === right.length && left.every((id, index) => id === right[index]);
      if (!selectedElementId) {
        return sameIds(source, filtered) ? current : filtered;
      }

      if (!currentIdSet.has(selectedElementId)) {
        return sameIds(source, filtered) ? current : filtered;
      }

      if (filtered.includes(selectedElementId)) {
        return sameIds(source, filtered) ? current : filtered;
      }

      const next = [selectedElementId];
      return sameIds(source, next) ? current : next;
    });
  }, [visibleCanvasElements, selectedElementId]);

  useEffect(() => {
    if (!inlineTextEditElementId) {
      return;
    }

    const editable = (form.design.canvas.elements || []).find(
      (element) => element.id === inlineTextEditElementId && element.type === "text",
    );

    if (!editable) {
      closeInlineEditor(false);
    }
  }, [form.design.canvas.elements, inlineTextEditElementId]);

  useEffect(() => {
    if (!inlineTextEditElementId) {
      return;
    }

    const targetNode = canvasTextNodeRefs.current.get(inlineTextEditElementId);
    if (!targetNode || typeof targetNode.focus !== "function") {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      targetNode.focus();
      const pendingCaret = pendingInlineCaretRef.current;
      if (pendingCaret?.elementId === inlineTextEditElementId) {
        placeCaretInEditableAtPoint(targetNode, pendingCaret.clientX, pendingCaret.clientY);
        pendingInlineCaretRef.current = null;
      }
      rememberCanvasTextSelection(inlineTextEditElementId);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [inlineTextEditElementId]);

  useEffect(() => {
    const templateIdSet = new Set(templates.map((template) => template.id));
    setSelectedTemplateIds((current) => current.filter((id) => templateIdSet.has(id)));
  }, [templates]);

  useEffect(() => {
    if (!isFullscreenEditorOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreenEditorOpen]);

  function applyEditorZoom(value) {
    const next = clamp(Number(value) || 100, 25, 300);
    setEditorZoomPercent(Math.round(next));
  }

  function openFullscreenEditor() {
    setIsFullscreenEditorOpen(true);
    setActiveEditorSidebarSection("layers");
    setIsEditorInspectorOpen(true);
  }

  function closeFullscreenEditor() {
    closeInlineEditor(true);
    setIsFullscreenEditorOpen(false);
  }

  function clearCanvasHistory() {
    setCanvasHistory({ past: [], future: [] });
  }

  function pushCanvasHistory(previousElements) {
    const snapshot = cloneCanvasElements(previousElements);
    const snapshotSignature = canvasSnapshotSignature(snapshot);

    setCanvasHistory((current) => {
      const last = current.past[current.past.length - 1];
      const lastSignature = last ? canvasSnapshotSignature(last) : "";
      if (lastSignature === snapshotSignature) {
        return current.future.length ? { ...current, future: [] } : current;
      }

      const nextPast = [...current.past, snapshot];
      if (nextPast.length > MAX_CANVAS_HISTORY) {
        nextPast.shift();
      }

      return {
        past: nextPast,
        future: [],
      };
    });
  }

  function applyCanvasSnapshot(elements) {
    const normalized = cloneCanvasElements(elements)
      .map((element, index) => ({ ...element, zIndex: index }))
      .sort((left, right) => left.zIndex - right.zIndex);

    setForm((current) => ({
      ...current,
      design: {
        ...current.design,
        canvas: {
          ...current.design.canvas,
          elements: normalized,
        },
      },
    }));

    const normalizedIdSet = new Set(normalized.map((element) => element.id));
    setSelectedElementId((currentId) => (normalizedIdSet.has(currentId) ? currentId : normalized[0]?.id || ""));
    setSelectedElementIds((current) => {
      const filtered = (Array.isArray(current) ? current : []).filter((id) => normalizedIdSet.has(id));
      if (filtered.length) {
        return filtered;
      }
      return normalized[0]?.id ? [normalized[0].id] : [];
    });
  }

  function handleUndoCanvas() {
    if (!canUndoCanvas) {
      return;
    }

    const currentSnapshot = cloneCanvasElements(canvasElementsRef.current);
    let previousSnapshot = null;

    setCanvasHistory((current) => {
      if (!current.past.length) {
        return current;
      }

      const nextPast = [...current.past];
      previousSnapshot = nextPast.pop();
      const nextFuture = [currentSnapshot, ...current.future].slice(0, MAX_CANVAS_HISTORY);
      return {
        past: nextPast,
        future: nextFuture,
      };
    });

    if (previousSnapshot) {
      applyCanvasSnapshot(previousSnapshot);
    }
  }

  function handleRedoCanvas() {
    if (!canRedoCanvas) {
      return;
    }

    const currentSnapshot = cloneCanvasElements(canvasElementsRef.current);
    let nextSnapshot = null;

    setCanvasHistory((current) => {
      if (!current.future.length) {
        return current;
      }

      const [firstFuture, ...remainingFuture] = current.future;
      nextSnapshot = firstFuture;
      const nextPast = [...current.past, currentSnapshot].slice(-MAX_CANVAS_HISTORY);
      return {
        past: nextPast,
        future: remainingFuture,
      };
    });

    if (nextSnapshot) {
      applyCanvasSnapshot(nextSnapshot);
    }
  }

  function fitEditorToWidth() {
    const viewport = fullscreenViewportRef.current;
    if (!viewport) {
      return;
    }

    const availableWidth = Math.max(viewport.clientWidth - 96, 120);
    const ratio = (availableWidth / canvasWidth) * 105;
    applyEditorZoom(ratio);
  }

  function fitEditorToPage() {
    const viewport = fullscreenViewportRef.current;
    if (!viewport) {
      return;
    }

    const availableWidth = Math.max(viewport.clientWidth - 96, 120);
    const availableHeight = Math.max(viewport.clientHeight - 96, 120);
    const widthRatio = availableWidth / canvasWidth;
    const heightRatio = availableHeight / canvasHeight;
    applyEditorZoom(Math.min(widthRatio, heightRatio) * 100);
  }

  function fitEditorToHeight() {
    const viewport = fullscreenViewportRef.current;
    if (!viewport) {
      return;
    }

    const availableHeight = Math.max(viewport.clientHeight - 96, 120);
    const ratio = (availableHeight / canvasHeight) * 100;
    applyEditorZoom(ratio);
  }

  useEffect(() => {
    if (!isFullscreenEditorOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => fitEditorToPage());
    return () => window.cancelAnimationFrame(frameId);
  }, [isFullscreenEditorOpen]);

  useEffect(() => {
    if (!isFullscreenEditorOpen) {
      return undefined;
    }

    const viewportNode = fullscreenViewportRef.current;

    function onWheel(event) {
      if (!event.ctrlKey) {
        return;
      }

      if (!viewportNode) {
        return;
      }

      const targetNode = event.target;
      if (!(targetNode instanceof Node) || !viewportNode.contains(targetNode)) {
        return;
      }

      event.preventDefault();
      const delta = event.deltaY < 0 ? 10 : -10;
      applyEditorZoom(editorZoomPercent + delta);
    }

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [editorZoomPercent, isFullscreenEditorOpen]);

  useEffect(() => {
    if (!isFullscreenEditorOpen) {
      return undefined;
    }

    function onKeyDown(event) {
      if (event.key === "Escape") {
        closeFullscreenEditor();
        return;
      }

      const activeTag = document.activeElement?.tagName || "";
      const isTypingTarget =
        activeTag === "INPUT" ||
        activeTag === "TEXTAREA" ||
        activeTag === "SELECT" ||
        document.activeElement?.getAttribute("contenteditable") === "true";

      if (isTypingTarget) {
        return;
      }

      const ctrlOrMeta = event.ctrlKey || event.metaKey;
      if (!ctrlOrMeta) {
        return;
      }

      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedoCanvas();
        } else {
          handleUndoCanvas();
        }
        return;
      }

      if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        handleRedoCanvas();
        return;
      }

      if (event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelectedElement();
        return;
      }

      if (event.key.toLowerCase() === "c") {
        if (!selectedElementId) {
          return;
        }

        event.preventDefault();
        copySelectedElement();
        return;
      }

      if (event.key.toLowerCase() === "v") {
        if (!copiedCanvasElement) {
          return;
        }

        event.preventDefault();
        pasteCopiedElement();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canRedoCanvas, canUndoCanvas, copiedCanvasElement, isFullscreenEditorOpen, selectedElementId]);

  useEffect(() => {
    function onTextStyleShortcut(event) {
      const ctrlOrMeta = event.ctrlKey || event.metaKey;
      if (!ctrlOrMeta || event.altKey) {
        return;
      }

      const key = String(event.key || "").toLowerCase();
      if (key !== "b" && key !== "u" && key !== "i") {
        return;
      }

      const activeElement = (canvasElementsRef.current || []).find((element) => element.id === selectedElementId);
      if (!activeElement || activeElement.type !== "text") {
        return;
      }

      if (!isFullscreenEditorOpen && !showAdvancedBuilder) {
        return;
      }

      const activeTag = document.activeElement?.tagName || "";
      const activeEditableCanvasNode = canvasTextNodeRefs.current.get(selectedElementId);
      const isInlineCanvasEditorActive =
        Boolean(activeEditableCanvasNode) && document.activeElement === activeEditableCanvasNode;

      if (
        activeTag === "INPUT" ||
        activeTag === "SELECT" ||
        (document.activeElement?.getAttribute("contenteditable") === "true" && !isInlineCanvasEditorActive)
      ) {
        return;
      }

      if (activeTag === "TEXTAREA" && document.activeElement !== textEditorRef.current) {
        return;
      }

      event.preventDefault();

      if (key === "b") {
        handleBoldClick();
        return;
      }

      if (key === "u") {
        handleUnderlineClick();
        return;
      }

      handleItalicClick();
    }

    window.addEventListener("keydown", onTextStyleShortcut);
    return () => window.removeEventListener("keydown", onTextStyleShortcut);
  }, [form.design.canvas.elements, isFullscreenEditorOpen, selectedElementId, showAdvancedBuilder]);

  function resetToCreateMode(baseCompanyId = form.companyId, baseDepartmentId = departmentOptions[0]?.id || "") {
    setEditingTemplateId("");
    setShowAdvancedBuilder(false);
    setCustomFieldDraft(createCustomFieldDraft());
    clearCanvasHistory();
    setForm(
      getInitialForm({
        companyId: baseCompanyId,
        departmentId: baseDepartmentId,
      }),
    );
    clearCanvasSelection();
    setInlineTextEditElementId("");
    setActiveEditorPageIndex(0);
    setAlignmentGuides({ vertical: null, horizontal: null });
  }

  function loadTemplateForEditing(template) {
    if (!template) {
      return;
    }

    const normalizedDesign = normalizeTemplateDesign(template.design);
    const hasBackground = Boolean(normalizedDesign.backgroundImage?.dataUrl);
    const existingElements = normalizedDesign.canvas?.elements || [];
    const canvasElements = existingElements.length ? existingElements : hasBackground ? createBackgroundTextElements() : [];

    setEditingTemplateId(template.id);
    setForm(
      getInitialForm({
        companyId: template.companyId,
        departmentId: template.departmentId,
        name: template.name || "",
        type: template.type || "",
        defaultSubject: template.defaultSubject || "",
        refCode: template.refCode || "",
        letterNoPattern: template.letterNoPattern || "",
        bodyTemplate: template.bodyTemplate || "",
        design: {
          ...normalizedDesign,
          canvas: {
            ...normalizedDesign.canvas,
            elements: canvasElements,
          },
        },
      }),
    );
    setCustomFieldDraft(createCustomFieldDraft());
    setShowAdvancedBuilder(false);
    setSelectedElementId(canvasElements[0]?.id || "");
    setSelectedElementIds(canvasElements[0]?.id ? [canvasElements[0].id] : []);
    setActiveEditorPageIndex(0);
    setInlineTextEditElementId("");
    setAlignmentGuides({ vertical: null, horizontal: null });
    clearCanvasHistory();
  }

  useEffect(() => {
    if (!editTemplateId) {
      return;
    }

    const target = templates.find((template) => template.id === editTemplateId);
    if (target) {
      loadTemplateForEditing(target);
    }

    if (onConsumeEditTarget) {
      onConsumeEditTarget();
    }
  }, [editTemplateId, onConsumeEditTarget, templates]);

  useEffect(() => {
    function onPointerMove(event) {
      const interaction = interactionRef.current;
      const activeCanvasNode = isFullscreenEditorOpen ? fullscreenCanvasRef.current : inlineCanvasRef.current;
      if (!interaction || !activeCanvasNode) {
        return;
      }
      if (interaction.pointerId != null && event.pointerId !== interaction.pointerId) {
        return;
      }
      if (interaction.pointerType === "mouse" && (event.buttons & 1) === 0) {
        stopInteraction();
        return;
      }

      const rect = activeCanvasNode.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }

      const movedDistance = Math.hypot(event.clientX - interaction.startClientX, event.clientY - interaction.startClientY);
      if (!interaction.hasMoved) {
        if (movedDistance < DRAG_ACTIVATION_DISTANCE_PX) {
          return;
        }
        interaction.hasMoved = true;
      }

      const rawDxPercent = ((event.clientX - interaction.startClientX) / rect.width) * 100;
      const rawDyPercent = ((event.clientY - interaction.startClientY) / rect.height) * 100;
      let dxPercent = rawDxPercent;
      let dyPercent = rawDyPercent;
      if (event.shiftKey) {
        if (!interaction.axisLock) {
          interaction.axisLock = Math.abs(rawDxPercent) >= Math.abs(rawDyPercent) ? "x" : "y";
        }
        if (interaction.axisLock === "x") {
          dyPercent = 0;
        } else {
          dxPercent = 0;
        }
      } else {
        interaction.axisLock = null;
      }
      const sourceElements = canvasElementsRef.current || [];
      const movingElement = sourceElements.find((element) => element.id === interaction.elementId) || interaction.startElement;
      let nextGuides = { vertical: null, horizontal: null };
      let nextX = interaction.startElement.x;
      let nextY = interaction.startElement.y;
      let nextWidth = interaction.startElement.width;
      let nextHeight = interaction.startElement.height;

      if (interaction.mode === "drag") {
        const movingIds = Array.isArray(interaction.selectedIds) && interaction.selectedIds.length
          ? interaction.selectedIds
          : [interaction.elementId];
        const startItems = movingIds
          .map((id) => interaction.startElementMap?.[id])
          .filter(Boolean);

        if (startItems.length > 1) {
          const maxDxLeft = Math.max(...startItems.map((item) => -Number(item.x || 0)));
          const maxDxRight = Math.min(...startItems.map((item) => 100 - (Number(item.x || 0) + Number(item.width || 0))));
          const maxDyUp = Math.max(...startItems.map((item) => -Number(item.y || 0)));
          const maxDyDown = Math.min(...startItems.map((item) => 100 - (Number(item.y || 0) + Number(item.height || 0))));

          const groupDx = clamp(dxPercent, maxDxLeft, maxDxRight);
          const groupDy = clamp(dyPercent, maxDyUp, maxDyDown);

          interaction.dragDeltaX = groupDx;
          interaction.dragDeltaY = groupDy;
          nextX = clamp(interaction.startElement.x + groupDx, 0, 100 - movingElement.width);
          nextY = clamp(interaction.startElement.y + groupDy, 0, 100 - movingElement.height);
          nextGuides = { vertical: null, horizontal: null };
        } else {
          const rawX = clamp(interaction.startElement.x + dxPercent, 0, 100 - movingElement.width);
          const rawY = clamp(interaction.startElement.y + dyPercent, 0, 100 - movingElement.height);
          const xTargets = collectAxisTargets(sourceElements, interaction.elementId, "x");
          const yTargets = collectAxisTargets(sourceElements, interaction.elementId, "y");
          const xSnap = findAxisSnap(rawX, movingElement.width, xTargets);
          const ySnap = findAxisSnap(rawY, movingElement.height, yTargets);

          nextX = clamp(xSnap.value, 0, 100 - movingElement.width);
          nextY = clamp(ySnap.value, 0, 100 - movingElement.height);
          interaction.dragDeltaX = nextX - interaction.startElement.x;
          interaction.dragDeltaY = nextY - interaction.startElement.y;
          nextGuides = {
            vertical: xSnap.guide,
            horizontal: ySnap.guide,
          };
        }
      } else if (interaction.mode === "line-resize-start") {
        const lineMinWidth = 2;
        const rightEdge = interaction.startElement.x + interaction.startElement.width;
        nextX = clamp(interaction.startElement.x + dxPercent, 0, rightEdge - lineMinWidth);
        nextWidth = clamp(rightEdge - nextX, lineMinWidth, 100 - nextX);
      } else if (interaction.mode === "line-resize-end") {
        const lineMinWidth = 2;
        nextWidth = clamp(interaction.startElement.width + dxPercent, lineMinWidth, 100 - interaction.startElement.x);
      } else {
        const widthDelta = interaction.axisLock === "y" ? 0 : dxPercent;
        const heightDelta = interaction.axisLock === "x" ? 0 : dyPercent;
        nextWidth = clamp(interaction.startElement.width + widthDelta, 2, 100 - interaction.startElement.x);
        nextHeight = clamp(interaction.startElement.height + heightDelta, 0.8, 100 - interaction.startElement.y);
      }

      setAlignmentGuides(nextGuides);

      setForm((current) => {
        const currentElements = current.design.canvas.elements;
        const nextElements = currentElements.map((element) => {
          if (interaction.mode === "drag") {
            const selectedIds = Array.isArray(interaction.selectedIds) ? interaction.selectedIds : [];
            if (!selectedIds.includes(element.id)) {
              return element;
            }

            const startItem = interaction.startElementMap?.[element.id] || element;
            return {
              ...element,
              x: clamp(Number(startItem.x || 0) + Number(interaction.dragDeltaX || 0), 0, 100 - Number(startItem.width || 0)),
              y: clamp(Number(startItem.y || 0) + Number(interaction.dragDeltaY || 0), 0, 100 - Number(startItem.height || 0)),
            };
          }

          if (element.id !== interaction.elementId) {
            return element;
          }

          if (interaction.mode === "line-resize-start") {
            return {
              ...element,
              x: nextX,
              width: nextWidth,
            };
          }

          if (interaction.mode === "line-resize-end") {
            return {
              ...element,
              width: nextWidth,
            };
          }

          return {
            ...element,
            width: nextWidth,
            height: nextHeight,
          };
        });

        return {
          ...current,
          design: {
            ...current.design,
            canvas: {
              ...current.design.canvas,
              elements: nextElements,
            },
          },
        };
      });
    }

    function stopInteraction() {
      const interaction = interactionRef.current;
      if (!interaction) {
        return;
      }

      interactionRef.current = null;
      setAlignmentGuides({ vertical: null, horizontal: null });
      const currentSignature = canvasSnapshotSignature(canvasElementsRef.current);
      if (currentSignature !== interaction.startSignature) {
        pushCanvasHistory(interaction.startElements);
      }
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopInteraction);
    window.addEventListener("pointercancel", stopInteraction);
    window.addEventListener("blur", stopInteraction);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopInteraction);
      window.removeEventListener("pointercancel", stopInteraction);
      window.removeEventListener("blur", stopInteraction);
    };
  }, [isFullscreenEditorOpen]);

  function updateField(field, value) {
    setForm((current) => {
      if (field !== "type") {
        return { ...current, [field]: value };
      }

      return {
        ...current,
        type: value,
        design: normalizeTemplateDesignForIssueType(current.design, value),
      };
    });
  }

  function updateDesign(field, value) {
    setForm((current) => ({
      ...current,
      design: {
        ...current.design,
        [field]: value,
      },
    }));
  }

  function addEditorPage() {
    updateDesign("additionalPages", totalTemplatePages + 1);
    setActiveEditorPageIndex(totalTemplatePages);
    setActiveEditorSidebarSection("pages");
    clearCanvasSelection();
    setInlineTextEditElementId("");
  }

  function duplicateEditorPage(pageIndex = activeEditorPageIndex) {
    const sourceElements = (form.design.canvas.elements || []).filter((element) => Number(element.pageIndex || 0) === pageIndex);
    const nextPageIndex = totalTemplatePages;
    let duplicatedIds = [];

    setForm((current) => {
      const existing = current.design.canvas.elements || [];
      const pageSource = existing.filter((element) => Number(element.pageIndex || 0) === pageIndex);
      const duplicates = pageSource.map((element, index) => ({
        ...createDuplicatedElement(element, existing.length + index),
        pageIndex: nextPageIndex,
        x: Number(element.x || 0),
        y: Number(element.y || 0),
      }));
      duplicatedIds = duplicates.map((element) => element.id);

      return {
        ...current,
        design: {
          ...current.design,
          additionalPages: totalTemplatePages + 1,
          canvas: {
            ...current.design.canvas,
            elements: [...existing, ...duplicates].map((element, index) => ({ ...element, zIndex: index })),
          },
        },
      };
    });

    setActiveEditorPageIndex(nextPageIndex);
    setActiveEditorSidebarSection("pages");
    setSelectedElementId(duplicatedIds[0] || "");
    setSelectedElementIds(duplicatedIds);
    setInlineTextEditElementId("");
    setAlignmentGuides({ vertical: null, horizontal: null });

    if (!sourceElements.length) {
      clearCanvasSelection();
    }
  }

  function deleteEditorPage(pageIndex = activeEditorPageIndex) {
    if (totalTemplatePages <= 1) {
      return;
    }

    const pageElements = (form.design.canvas.elements || []).filter((element) => Number(element.pageIndex || 0) === pageIndex);
    const confirmed = window.confirm(
      pageElements.length
        ? `Delete page ${pageIndex + 1} and its ${pageElements.length} element${pageElements.length === 1 ? "" : "s"}?`
        : `Delete page ${pageIndex + 1}?`,
    );
    if (!confirmed) {
      return;
    }

    setForm((current) => {
      const nextElements = (current.design.canvas.elements || [])
        .filter((element) => Number(element.pageIndex || 0) !== pageIndex)
        .map((element) =>
          Number(element.pageIndex || 0) > pageIndex
            ? { ...element, pageIndex: Number(element.pageIndex || 0) - 1 }
            : element,
        )
        .map((element, index) => ({ ...element, zIndex: index }));

      return {
        ...current,
        design: {
          ...current.design,
          additionalPages: Math.max(1, Number(current.design.additionalPages || 1) - 1),
          canvas: {
            ...current.design.canvas,
            elements: nextElements,
          },
        },
      };
    });

    clearCanvasSelection();
    setInlineTextEditElementId("");
    setAlignmentGuides({ vertical: null, horizontal: null });
    setActiveEditorPageIndex((current) => {
      if (current > pageIndex) {
        return current - 1;
      }
      return Math.max(0, Math.min(current, totalTemplatePages - 2));
    });
  }

  function updateBackground(field, value) {
    setForm((current) => ({
      ...current,
      design: {
        ...current.design,
        backgroundImage: {
          ...current.design.backgroundImage,
          [field]: value,
        },
      },
    }));
  }

  function updateCanvasElements(updater, options = {}) {
    const { recordHistory = true } = options;
    let changed = false;
    let previousElements = [];
    let nextElements = [];

    setForm((current) => {
      const existing = current.design.canvas.elements || [];
      const updatedRaw = updater(existing);
      const updated = (Array.isArray(updatedRaw) ? updatedRaw : existing)
        .map((element, index) => ({ ...element, zIndex: index }))
        .sort((left, right) => left.zIndex - right.zIndex);

      if (canvasSnapshotSignature(existing) === canvasSnapshotSignature(updated)) {
        return current;
      }

      changed = true;
      previousElements = cloneCanvasElements(existing);
      nextElements = cloneCanvasElements(updated);

      return {
        ...current,
        design: {
          ...current.design,
          canvas: {
            ...current.design.canvas,
            elements: updated,
          },
        },
      };
    });

    if (!changed) {
      return false;
    }

    if (recordHistory) {
      pushCanvasHistory(previousElements);
    }

    const nextIdSet = new Set(nextElements.map((element) => element.id));
    setSelectedElementIds((current) => (Array.isArray(current) ? current.filter((id) => nextIdSet.has(id)) : []));

    const stillSelected = nextElements.some((element) => element.id === selectedElementId);
    if (!stillSelected) {
      const fallbackId = nextElements[0]?.id || "";
      setSelectedElementId(fallbackId);
      if (!fallbackId) {
        setSelectedElementIds([]);
      }
    }

    return true;
  }

  function updateCustomFields(updater) {
    setForm((current) => {
      const source = Array.isArray(current.design.customFields) ? current.design.customFields : [];
      const next = normalizeTemplateCustomFields(updater(source));

      return {
        ...current,
        design: {
          ...current.design,
          customFields: next,
        },
      };
    });
  }

  function clearCanvasSelection() {
    setSelectedElementId("");
    setSelectedElementIds([]);
  }

  function handleElementListSelection(event, elementId) {
    const multiToggle = Boolean(event?.ctrlKey || event?.metaKey);
    if (multiToggle) {
      const source = Array.isArray(selectedElementIds) ? selectedElementIds : [];
      if (source.includes(elementId)) {
        const next = source.filter((id) => id !== elementId);
        setSelectedElementIds(next);
        if (selectedElementId === elementId) {
          setSelectedElementId(next[next.length - 1] || "");
        }
      } else {
        const next = [...source, elementId];
        setSelectedElementIds(next);
        setSelectedElementId(elementId);
      }
      return;
    }

    setSelectedElementId(elementId);
    setSelectedElementIds(elementId ? [elementId] : []);
  }

  function handleElementPointerDown(event, element, mode = "drag") {
    const multiToggle = mode === "drag" && Boolean(event?.ctrlKey || event?.metaKey);
    if (multiToggle) {
      event.preventDefault();
      event.stopPropagation();
      const source = Array.isArray(selectedElementIds) ? selectedElementIds : [];
      if (source.includes(element.id)) {
        const next = source.filter((id) => id !== element.id);
        setSelectedElementIds(next);
        if (selectedElementId === element.id) {
          setSelectedElementId(next[next.length - 1] || "");
        }
      } else {
        const next = [...source, element.id];
        setSelectedElementIds(next);
        setSelectedElementId(element.id);
      }
      return;
    }

    const currentSelection = Array.isArray(selectedElementIds) ? selectedElementIds : [];
    const isAlreadySelected = currentSelection.includes(element.id);
    const activeSelectionIds =
      mode === "drag"
        ? isAlreadySelected && currentSelection.length
          ? currentSelection
          : [element.id]
        : [element.id];

    setSelectedElementId(element.id);
    setSelectedElementIds(activeSelectionIds);

    if (inlineTextEditElementId && inlineTextEditElementId !== element.id) {
      closeInlineEditor(true);
    }

    startInteraction(event, element, mode, activeSelectionIds);
  }

  function handleElementPointerUp(event, element) {
    if (element.type !== "text") {
      return;
    }

    const interaction = interactionRef.current;
    if (!interaction || interaction.elementId !== element.id || interaction.mode !== "drag" || interaction.hasMoved) {
      return;
    }

    if (selectedElementId !== element.id) {
      setSelectedElementId(element.id);
    }
    openInlineEditorAtPoint(element.id, event.clientX, event.clientY);
  }

  function startInteraction(event, element, mode, selectionIds = [element.id]) {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const startElements = cloneCanvasElements(form.design.canvas.elements || []);
    const startElementMap = Object.fromEntries(startElements.map((item) => [item.id, { ...item }]));
    const normalizedSelectionIds = Array.from(
      new Set(
        (Array.isArray(selectionIds) ? selectionIds : [element.id]).filter((item) =>
          startElements.some((canvasItem) => canvasItem.id === item),
        ),
      ),
    );
    const selectedIdsForMode =
      mode === "drag"
        ? normalizedSelectionIds.includes(element.id)
          ? normalizedSelectionIds
          : [element.id]
        : [element.id];

    interactionRef.current = {
      mode,
      elementId: element.id,
      selectedIds: selectedIdsForMode.length ? selectedIdsForMode : [element.id],
      startClientX: event.clientX,
      startClientY: event.clientY,
      startElement: { ...element },
      startElementMap,
      startElements,
      startSignature: canvasSnapshotSignature(startElements),
      hasMoved: false,
      axisLock: null,
      dragDeltaX: 0,
      dragDeltaY: 0,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
    };
    setAlignmentGuides({ vertical: null, horizontal: null });
  }

  function addCanvasElement(type) {
    const newElement = createCanvasElement(type);
    newElement.pageIndex = activeEditorPageIndex;
    updateCanvasElements((elements) => [...elements, { ...newElement, zIndex: elements.length }]);
    setSelectedElementId(newElement.id);
    setSelectedElementIds([newElement.id]);
    setAlignmentGuides({ vertical: null, horizontal: null });
  }

  function applyBackgroundTextPreset() {
    const presetElements = createBackgroundTextElements().map((element) => ({ ...element, pageIndex: activeEditorPageIndex }));
    updateCanvasElements((elements) => {
      const retained = elements.filter((element) => Number(element.pageIndex || 0) !== activeEditorPageIndex);
      return [...retained, ...presetElements].map((element, index) => ({ ...element, zIndex: index }));
    });
    setSelectedElementId(presetElements[0]?.id || "");
    setSelectedElementIds(presetElements[0]?.id ? [presetElements[0].id] : []);
    setInlineTextEditElementId("");
    setAlignmentGuides({ vertical: null, horizontal: null });
  }

  function copySelectedElement() {
    if (!selectedElement) {
      return;
    }

    setCopiedCanvasElement({ ...selectedElement });
  }

  function duplicateSelectedElement() {
    const baseSelection = Array.isArray(selectedElementIds) && selectedElementIds.length
      ? selectedElementIds
      : selectedElementId
        ? [selectedElementId]
        : [];
    if (!baseSelection.length) {
      return;
    }

    let duplicatedIds = [];
    updateCanvasElements((elements) => {
      const selectedSet = new Set(baseSelection);
      const sources = elements.filter((element) => selectedSet.has(element.id));
      if (!sources.length) {
        return elements;
      }

      const duplicates = sources.map((source, index) => createDuplicatedElement(source, elements.length + index));
      duplicatedIds = duplicates.map((item) => item.id);
      return [...elements, ...duplicates];
    });

    if (duplicatedIds.length) {
      setSelectedElementId(duplicatedIds[duplicatedIds.length - 1]);
      setSelectedElementIds(duplicatedIds);
    }
  }

  function pasteCopiedElement() {
    if (!copiedCanvasElement) {
      return;
    }

    let pastedId = "";
    updateCanvasElements((elements) => {
      const duplicated = createDuplicatedElement(copiedCanvasElement, elements.length);
      pastedId = duplicated.id;
      return [...elements, duplicated];
    });

    if (pastedId) {
      setSelectedElementId(pastedId);
      setSelectedElementIds([pastedId]);
    }
  }

  function alignSelectedElement(alignment) {
    if (!selectedElement) {
      return;
    }

    const patch = {};
    let verticalGuide = null;
    let horizontalGuide = null;

    if (alignment === "left") {
      patch.x = 0;
      verticalGuide = 0;
    }
    if (alignment === "center") {
      patch.x = clamp((100 - selectedElement.width) / 2, 0, 100 - selectedElement.width);
      verticalGuide = 50;
    }
    if (alignment === "right") {
      patch.x = clamp(100 - selectedElement.width, 0, 100 - selectedElement.width);
      verticalGuide = 100;
    }
    if (alignment === "top") {
      patch.y = 0;
      horizontalGuide = 0;
    }
    if (alignment === "middle") {
      patch.y = clamp((100 - selectedElement.height) / 2, 0, 100 - selectedElement.height);
      horizontalGuide = 50;
    }
    if (alignment === "bottom") {
      patch.y = clamp(100 - selectedElement.height, 0, 100 - selectedElement.height);
      horizontalGuide = 100;
    }

    if (!Object.keys(patch).length) {
      return;
    }

    updateSelectedElement(patch);
    setAlignmentGuides({
      vertical: verticalGuide,
      horizontal: horizontalGuide,
    });
  }

  function updateSelectedElement(patch) {
    if (!selectedElementId) {
      return;
    }

    updateCanvasElements((elements) =>
      elements.map((element) => (element.id === selectedElementId ? { ...element, ...patch } : element)),
    );
  }

  function commitInlineEditorValue(targetElementId = inlineTextEditElementId, options = {}) {
    const { close = false } = options;
    if (!targetElementId) {
      return false;
    }

    const node = canvasTextNodeRefs.current.get(targetElementId);
    if (!node || !node.isContentEditable) {
      if (close) {
        setInlineTextEditElementId("");
      }
      return false;
    }

    const currentElement = (canvasElementsRef.current || []).find((element) => element.id === targetElementId);
    if (!currentElement || currentElement.type !== "text") {
      if (close) {
        setInlineTextEditElementId("");
      }
      return false;
    }

    const nextText = editableHtmlToMarkdown(node.innerHTML);
    const didChange = String(currentElement.text || "") !== nextText;

    if (didChange) {
      updateCanvasElements((elements) =>
        elements.map((element) => (element.id === targetElementId ? { ...element, text: nextText } : element)),
      );
    }

    if (close) {
      setInlineTextEditElementId("");
    }

    return didChange;
  }

  function closeInlineEditor(commit = true) {
    if (!inlineTextEditElementId) {
      return;
    }

    if (commit) {
      commitInlineEditorValue(inlineTextEditElementId, { close: true });
      return;
    }

    setInlineTextEditElementId("");
  }

  function changeSelectedElementSize(deltaWidth = 0, deltaHeight = 0) {
    if (!selectedElement) {
      return;
    }

    const nextWidth = clamp(Number(selectedElement.width || 0) + deltaWidth, 1, 100 - Number(selectedElement.x || 0));
    const nextHeight = clamp(Number(selectedElement.height || 0) + deltaHeight, 0.8, 100 - Number(selectedElement.y || 0));
    updateSelectedElement({
      width: nextWidth,
      height: nextHeight,
    });
  }

  function changeSelectedFontSize(delta = 0) {
    if (!selectedElement || (selectedElement.type !== "text" && selectedElement.type !== "field")) {
      return;
    }

    updateSelectedElement({
      fontSize: clamp(Number(selectedElement.fontSize || 12) + delta, 8, 72),
    });
  }

  function setSelectedTextAlign(align) {
    if (!selectedElement || (selectedElement.type !== "text" && selectedElement.type !== "field")) {
      return;
    }

    updateSelectedElement({ align });
  }

  function toggleSelectedBold() {
    if (!selectedElement || (selectedElement.type !== "text" && selectedElement.type !== "field")) {
      return;
    }

    updateSelectedElement({
      fontWeight: String(selectedElement.fontWeight) === "700" ? "400" : "700",
    });
  }

  function toggleSelectedUnderline() {
    if (!selectedElement || (selectedElement.type !== "text" && selectedElement.type !== "field")) {
      return;
    }

    updateSelectedElement({
      textDecoration: selectedElement.textDecoration === "underline" ? "none" : "underline",
    });
  }

  function setCanvasTextNodeRef(elementId, node) {
    if (!elementId) {
      return;
    }

    if (node) {
      canvasTextNodeRefs.current.set(elementId, node);
      return;
    }

    canvasTextNodeRefs.current.delete(elementId);
  }

  function placeCaretInEditableAtPoint(node, clientX, clientY) {
    if (!node || typeof window === "undefined" || typeof document === "undefined") {
      return false;
    }

    const selection = window.getSelection ? window.getSelection() : null;
    if (!selection) {
      return false;
    }

    let range = null;
    if (typeof document.caretRangeFromPoint === "function") {
      range = document.caretRangeFromPoint(clientX, clientY);
    } else if (typeof document.caretPositionFromPoint === "function") {
      const position = document.caretPositionFromPoint(clientX, clientY);
      if (position?.offsetNode) {
        range = document.createRange();
        range.setStart(position.offsetNode, position.offset || 0);
        range.collapse(true);
      }
    }

    if (!range || !node.contains(range.startContainer)) {
      return false;
    }

    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  function openInlineEditorAtPoint(elementId, clientX, clientY) {
    if (!elementId) {
      return;
    }

    pendingInlineCaretRef.current = {
      elementId,
      clientX,
      clientY,
    };
    setInlineTextEditElementId(elementId);
  }

  function keepInlineEditorFocused(event) {
    if (getActiveInlineEditorNode()) {
      event.preventDefault();
    }
  }

  function getCanvasTextSelection(elementId) {
    if (!elementId) {
      return null;
    }

    const node = canvasTextNodeRefs.current.get(elementId);
    const selection = typeof window !== "undefined" && window.getSelection ? window.getSelection() : null;

    if (!node || !selection || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    if (!node.contains(range.startContainer) || !node.contains(range.endContainer)) {
      return null;
    }

    const startRange = document.createRange();
    startRange.selectNodeContents(node);
    startRange.setEnd(range.startContainer, range.startOffset);

    const endRange = document.createRange();
    endRange.selectNodeContents(node);
    endRange.setEnd(range.endContainer, range.endOffset);

    const start = Number(startRange.toString().length);
    const end = Number(endRange.toString().length);

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return null;
    }

    return { start, end, source: "display", elementId };
  }

  function rememberTextSelection(event) {
    const target = event.currentTarget;
    textEditorRef.current = target;
    textSelectionRef.current = {
      start: Number(target.selectionStart ?? 0),
      end: Number(target.selectionEnd ?? 0),
      source: "raw",
      elementId: selectedElementId,
    };
  }

  function rememberCanvasTextSelection(elementId) {
    if (!elementId) {
      return;
    }

    const selection = getCanvasTextSelection(elementId);
    if (!selection) {
      return;
    }

    textSelectionRef.current = selection;
  }

  function getActiveTextSelection(length) {
    const current = textSelectionRef.current || {};

    if (current.elementId === selectedElementId) {
      const start = clamp(Math.min(Number(current.start || 0), Number(current.end || 0)), 0, length);
      const end = clamp(Math.max(Number(current.start || 0), Number(current.end || 0)), 0, length);

      if (end > start) {
        return {
          start,
          end,
          source: current.source || "raw",
        };
      }
    }

    const canvasSelection = getCanvasTextSelection(selectedElementId);
    if (canvasSelection) {
      textSelectionRef.current = canvasSelection;
      const start = clamp(Math.min(canvasSelection.start, canvasSelection.end), 0, length);
      const end = clamp(Math.max(canvasSelection.start, canvasSelection.end), 0, length);
      if (end > start) {
        return {
          start,
          end,
          source: "display",
        };
      }
    }

    return null;
  }

  function applyWrapToSelectedText(openMarker, closeMarker = openMarker) {
    if (!selectedElement || selectedElement.type !== "text") {
      return false;
    }

    const source = String(selectedElement.text || "");
    const selection = getActiveTextSelection(source.length);
    if (!selection) {
      return false;
    }

    const start =
      selection.source === "display"
        ? mapDisplayIndexToSource(source, selection.start)
        : selection.start;
    const end =
      selection.source === "display"
        ? mapDisplayIndexToSource(source, selection.end)
        : selection.end;

    if (end <= start) {
      return false;
    }
    const before = source.slice(0, start);
    const selectedText = source.slice(start, end);
    const after = source.slice(end);

    let nextText = "";
    let nextSelection = { start, end };

    if (before.endsWith(openMarker) && after.startsWith(closeMarker)) {
      nextText = `${before.slice(0, -openMarker.length)}${selectedText}${after.slice(closeMarker.length)}`;
      nextSelection = {
        start: Math.max(0, start - openMarker.length),
        end: Math.max(0, end - openMarker.length),
      };
    } else {
      nextText = `${before}${openMarker}${selectedText}${closeMarker}${after}`;
      nextSelection = {
        start: start + openMarker.length,
        end: end + openMarker.length,
      };
    }

    updateSelectedElement({ text: nextText });

    textSelectionRef.current = {
      ...nextSelection,
      source: "raw",
      elementId: selectedElementId,
    };

    if (selection.source === "raw" && document.activeElement === textEditorRef.current) {
      window.requestAnimationFrame(() => {
        const editorNode = textEditorRef.current;
        if (!editorNode || typeof editorNode.setSelectionRange !== "function") {
          return;
        }

        editorNode.focus();
        editorNode.setSelectionRange(nextSelection.start, nextSelection.end);
        textSelectionRef.current = {
          ...nextSelection,
          source: "raw",
          elementId: selectedElementId,
        };
      });
    }

    return true;
  }

  function applyBoldToSelectedText() {
    return applyWrapToSelectedText("**");
  }

  function applyUnderlineToSelectedText() {
    return applyWrapToSelectedText("++");
  }

  function applyItalicToSelectedText() {
    return applyWrapToSelectedText("_");
  }

  function getActiveInlineEditorNode() {
    if (!inlineTextEditElementId || inlineTextEditElementId !== selectedElementId) {
      return null;
    }

    const node = canvasTextNodeRefs.current.get(selectedElementId);
    if (!node || !node.isContentEditable) {
      return null;
    }

    return node;
  }

  function applyInlineRichCommand(command) {
    const node = getActiveInlineEditorNode();
    if (!node || typeof document === "undefined" || typeof document.execCommand !== "function") {
      return false;
    }

    const selection = typeof window !== "undefined" && window.getSelection ? window.getSelection() : null;
    if (!selection || selection.rangeCount === 0) {
      return false;
    }

    const range = selection.getRangeAt(0);
    if (!node.contains(range.startContainer) || !node.contains(range.endContainer)) {
      return false;
    }

    document.execCommand(command, false, null);
    rememberCanvasTextSelection(selectedElementId);
    return true;
  }

  function applyInlineInsertText(value) {
    const node = getActiveInlineEditorNode();
    if (!node || typeof document === "undefined" || typeof document.execCommand !== "function") {
      return false;
    }

    const selection = typeof window !== "undefined" && window.getSelection ? window.getSelection() : null;
    if (!selection || selection.rangeCount === 0) {
      return false;
    }

    const range = selection.getRangeAt(0);
    if (!node.contains(range.startContainer) || !node.contains(range.endContainer)) {
      return false;
    }

    document.execCommand("insertText", false, String(value || ""));
    rememberCanvasTextSelection(selectedElementId);
    return true;
  }

  function handleBoldClick() {
    if (applyInlineRichCommand("bold")) {
      return;
    }

    const appliedInlineBold = applyBoldToSelectedText();
    if (!appliedInlineBold) {
      toggleSelectedBold();
    }
  }

  function handleUnderlineClick() {
    if (applyInlineRichCommand("underline")) {
      return;
    }

    const appliedInlineUnderline = applyUnderlineToSelectedText();
    if (!appliedInlineUnderline) {
      toggleSelectedUnderline();
    }
  }

  function handleItalicClick() {
    if (applyInlineRichCommand("italic")) {
      return;
    }

    applyItalicToSelectedText();
  }

  function appendTokenToBodyTemplate(token) {
    setForm((current) => ({
      ...current,
      bodyTemplate: `${current.bodyTemplate || ""}${token}`,
    }));
  }

  function appendTokenToReferencePattern(token) {
    setForm((current) => ({
      ...current,
      letterNoPattern: `${current.letterNoPattern || ""}${token}`,
    }));
  }

  function addCustomField() {
    const label = String(customFieldDraft.label || "").trim();
    if (!label) {
      return;
    }

    const providedKey = normalizeCustomFieldKey(customFieldDraft.key);
    const labelKey = normalizeCustomFieldKey(label);
    const rawKey = providedKey || labelKey;

    if (!rawKey) {
      return;
    }

    const existingKeys = new Set(customFieldDefinitions.map((field) => field.key));
    let key = rawKey;
    let suffix = 2;
    while (existingKeys.has(key)) {
      key = `${rawKey}_${suffix}`;
      suffix += 1;
    }

    const nextField = {
      label,
      key,
      placeholder: String(customFieldDraft.placeholder || ""),
      defaultValue: String(customFieldDraft.defaultValue || ""),
      type: customFieldDraft.type === "textarea" ? "textarea" : "text",
      required: Boolean(customFieldDraft.required),
    };

    updateCustomFields((fields) => [...fields, nextField]);
    setCustomFieldDraft(createCustomFieldDraft());
  }

  function updateCustomField(index, patch) {
    updateCustomFields((fields) =>
      fields.map((field, fieldIndex) => {
        if (fieldIndex !== index) {
          return field;
        }

        const next = {
          ...field,
          ...patch,
        };

        if (Object.prototype.hasOwnProperty.call(patch, "key")) {
          next.key = normalizeCustomFieldKey(patch.key, field.key);
        }

        if (Object.prototype.hasOwnProperty.call(patch, "label")) {
          next.label = String(patch.label || "");
        }

        return next;
      }),
    );
  }

  function removeCustomField(index) {
    const target = customFieldDefinitions[index];
    if (!target) {
      return;
    }

    const confirmed = window.confirm(`Delete custom field "${target.label}"?`);
    if (!confirmed) {
      return;
    }

    updateCustomFields((fields) => fields.filter((_, fieldIndex) => fieldIndex !== index));
  }

  function toggleRequiredToken(tokenKey, isRequired) {
    const normalizedKey = normalizeCustomFieldKey(tokenKey, "");
    if (!normalizedKey) {
      return;
    }
    const source = Array.isArray(form.design.requiredTokenKeys) ? form.design.requiredTokenKeys : [];
    const next = isRequired
      ? Array.from(new Set([...source, normalizedKey]))
      : source.filter((item) => item !== normalizedKey);
    updateDesign("requiredTokenKeys", next);
  }

  function appendTokenToSelectedText(token) {
    if (!selectedElement || selectedElement.type !== "text") {
      return;
    }

    if (applyInlineInsertText(token)) {
      return;
    }

    const source = String(selectedElement.text || "");
    const current = textSelectionRef.current || {};

    let start = source.length;
    let end = source.length;

    if (current.elementId === selectedElementId) {
      start = clamp(Math.min(Number(current.start ?? source.length), Number(current.end ?? source.length)), 0, source.length);
      end = clamp(Math.max(Number(current.start ?? source.length), Number(current.end ?? source.length)), 0, source.length);

      if (current.source === "display") {
        start = mapDisplayIndexToSource(source, start);
        end = mapDisplayIndexToSource(source, end);
      }
    }

    const nextText = `${source.slice(0, start)}${token}${source.slice(end)}`;
    const caret = start + String(token).length;

    updateSelectedElement({ text: nextText });
    textSelectionRef.current = {
      start: caret,
      end: caret,
      source: "raw",
      elementId: selectedElementId,
    };

    window.requestAnimationFrame(() => {
      const editorNode = textEditorRef.current;
      if (!editorNode || document.activeElement !== editorNode || typeof editorNode.setSelectionRange !== "function") {
        return;
      }

      editorNode.focus();
      editorNode.setSelectionRange(caret, caret);
    });
  }

  function removeSelectedTextLine() {
    if (!selectedElement || selectedElement.type !== "text") {
      return;
    }

    const lines = String(selectedElement.text || "")
      .split("\n")
      .filter((line, index, array) => index !== array.length - 1 || line.trim().length > 0);

    lines.pop();
    updateSelectedElement({ text: lines.join("\n") });
  }

  function removeSelectedElement() {
    const baseSelection = Array.isArray(selectedElementIds) && selectedElementIds.length
      ? selectedElementIds
      : selectedElementId
        ? [selectedElementId]
        : [];
    if (!baseSelection.length) {
      return;
    }

    const confirmed = window.confirm(
      baseSelection.length > 1
        ? `Delete ${baseSelection.length} selected canvas elements?`
        : "Delete selected canvas element?",
    );
    if (!confirmed) {
      return;
    }

    const selectedSet = new Set(baseSelection);
    updateCanvasElements((elements) => elements.filter((element) => !selectedSet.has(element.id)));
    clearCanvasSelection();
    setInlineTextEditElementId("");
  }

  function toggleTemplateSelection(templateId) {
    setSelectedTemplateIds((current) =>
      current.includes(templateId) ? current.filter((id) => id !== templateId) : [...current, templateId],
    );
  }

  function toggleSelectAllTemplates() {
    if (!filteredTemplates.length) {
      return;
    }

    setSelectedTemplateIds((current) => {
      const currentSet = new Set(current);
      const allFilteredSelected = filteredTemplates.every((template) => currentSet.has(template.id));

      if (allFilteredSelected) {
        return current.filter((id) => !filteredTemplateIdSet.has(id));
      }

      filteredTemplates.forEach((template) => currentSet.add(template.id));
      return Array.from(currentSet);
    });
  }

  async function handleDeleteTemplateById(templateId) {
    if (!onDeleteTemplate) {
      return;
    }

    const deleted = await onDeleteTemplate(templateId);
    if (!deleted) {
      return;
    }

    setSelectedTemplateIds((current) => current.filter((id) => id !== templateId));
    if (editingTemplateId === templateId) {
      resetToCreateMode();
    }
  }

  async function handleDuplicateTemplateById(templateId) {
    if (!onDuplicateTemplate) {
      return;
    }

    const duplicated = await onDuplicateTemplate(templateId);
    if (!duplicated) {
      return;
    }

    setSelectedTemplateIds((current) => current.filter((id) => id !== templateId));
  }

  async function handleAddTemplateType() {
    const name = newTemplateTypeName.trim();
    if (!name || !onAddTemplateType) {
      return;
    }

    const created = await onAddTemplateType(name);
    if (!created) {
      return;
    }

    updateField("type", created.name || name);
    setNewTemplateTypeName("");
  }

  async function handleDeleteSelectedTemplateType() {
    if (!selectedTemplateType?.id || !onDeleteTemplateType) {
      return;
    }

    const deleted = await onDeleteTemplateType(selectedTemplateType.id);
    if (!deleted) {
      return;
    }

    const nextType = templateTypeOptions.find((type) => type.id !== selectedTemplateType.id)?.name || "";
    updateField("type", nextType);
  }

  async function handleSaveAsTemplate() {
    if (!editingTemplateId || !onDuplicateTemplate) {
      return;
    }

    const suggestedName = String(form.name || "Letter Agreement").trim() || "Letter Agreement";
    const requestedName = window.prompt("Save as new Letter Agreement", `${suggestedName} Copy`);
    if (requestedName == null) {
      return;
    }

    const duplicateName = String(requestedName || "").trim();
    if (!duplicateName) {
      window.alert("Please enter a name for the new Letter Agreement.");
      return;
    }

    await onDuplicateTemplate(editingTemplateId, { name: duplicateName });
  }

  async function handleBulkDeleteSelection() {
    if (!onBulkDeleteTemplates || !selectedFilteredTemplateIds.length) {
      return;
    }

    const deleted = await onBulkDeleteTemplates(selectedFilteredTemplateIds);
    if (!deleted) {
      return;
    }

    const deletedSet = new Set(selectedFilteredTemplateIds);
    setSelectedTemplateIds((current) => current.filter((id) => !deletedSet.has(id)));
    if (editingTemplateId && deletedSet.has(editingTemplateId)) {
      resetToCreateMode();
    }
  }

  function moveLayer(direction) {
    if (!selectedElementId) {
      return;
    }

    updateCanvasElements((elements) => {
      const index = elements.findIndex((element) => element.id === selectedElementId);
      if (index === -1) {
        return elements;
      }

      const target = direction === "up" ? index + 1 : index - 1;
      if (target < 0 || target >= elements.length) {
        return elements;
      }

      const next = [...elements];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  function clearCanvas() {
    updateCanvasElements((elements) => elements.filter((element) => Number(element.pageIndex || 0) !== activeEditorPageIndex));
    clearCanvasSelection();
    setInlineTextEditElementId("");
    setAlignmentGuides({ vertical: null, horizontal: null });
  }

  function handleBackgroundUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      let firstPresetId = "";

      setForm((current) => {
        const existingElements = current.design.canvas?.elements || [];
        const shouldCreatePreset = !existingElements.length;
        const presetElements = shouldCreatePreset ? createBackgroundTextElements() : existingElements;

        if (shouldCreatePreset) {
          firstPresetId = presetElements[0]?.id || "";
        }

        return {
          ...current,
          design: {
            ...current.design,
            renderMode: "background",
            backgroundImage: {
              ...current.design.backgroundImage,
              dataUrl,
              fileName: file.name,
            },
            canvas: {
              ...current.design.canvas,
              elements: presetElements,
            },
          },
        };
      });

      if (firstPresetId) {
        setSelectedElementId(firstPresetId);
        setSelectedElementIds([firstPresetId]);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function clearBackground() {
    setForm((current) => ({
      ...current,
      design: {
        ...current.design,
        backgroundImage: {
          dataUrl: "",
          fileName: "",
          fit: "cover",
          opacity: 100,
        },
      },
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const payload = {
      ...form,
      id: editingTemplateId,
      letterNoPattern: normalizeReferencePattern(form.letterNoPattern),
      design: normalizeTemplateDesign(form.design),
    };

    if (editingTemplateId && onUpdateTemplate) {
      onUpdateTemplate(payload);
      return;
    }

    onAddTemplate(payload);
    resetToCreateMode(form.companyId, departmentOptions[0]?.id || "");
  }

  async function handleDeleteCurrentTemplate() {
    if (!editingTemplateId || !onDeleteTemplate) {
      return;
    }

    const deleted = await onDeleteTemplate(editingTemplateId);
    if (!deleted) {
      return;
    }

    setSelectedTemplateIds((current) => current.filter((id) => id !== editingTemplateId));
    resetToCreateMode();
  }

  const canvasElements = useMemo(
    () => [...visibleCanvasElements].sort((left, right) => left.zIndex - right.zIndex),
    [visibleCanvasElements],
  );
  const selectedElementIdSet = new Set(selectedElementIds);
  const selectedElement = canvasElements.find((element) => element.id === selectedElementId) || null;
  const hasCanvasElements = canvasElements.length > 0;
  const editorZoomScale = editorZoomPercent / 100;
  const canvasPaddingXPercent = clamp(Number(form.design.pagePaddingX ?? 0), 0, 25);
  const canvasPaddingYPercent = clamp(Number(form.design.pagePaddingY ?? 0), 0, 25);
  const canvasContentLayerStyle = {
    left: `${canvasPaddingXPercent}%`,
    top: `${canvasPaddingYPercent}%`,
    width: `${Math.max(5, 100 - canvasPaddingXPercent * 2)}%`,
    height: `${Math.max(5, 100 - canvasPaddingYPercent * 2)}%`,
  };
  const inlineToolbarStyle = selectedElement
    ? {
      left: `${clamp(Number(selectedElement.x || 0) + Number(selectedElement.width || 0) / 2, 4, 96)}%`,
      top: `${selectedElement.y <= 6 ? Number(selectedElement.y || 0) + Number(selectedElement.height || 0) + 1.2 : Number(selectedElement.y || 0) - 1.2}%`,
      transform: selectedElement.y <= 6 ? "translate(-50%, 0)" : "translate(-50%, -100%)",
      zIndex: Number(selectedElement.zIndex || 0) + 500,
    }
    : null;

  return (
    <section className="view is-active templates-view">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Template Builder</p>
          <h2>Letter templates</h2>
        </div>
      </div>

      <div className="content-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{editingTemplateId ? "Edit" : "Create"}</p>
              <h3>{editingTemplateId ? "Edit letter template" : "Add letter template"}</h3>
            </div>
          </div>

          <form className="form-grid" onSubmit={handleSubmit}>
            <label>
              Company
              <select
                required
                value={form.companyId}
                onChange={(event) => updateField("companyId", event.target.value)}
                disabled={!companies.length}
              >
                <option value="">Select company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name} ({company.shortCode})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Department
              <select
                required
                value={form.departmentId}
                onChange={(event) => updateField("departmentId", event.target.value)}
                disabled={!departmentOptions.length}
              >
                <option value="">Select department</option>
                {departmentOptions.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name} ({department.code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Template name
              <input
                required
                type="text"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Salary Certificate"
              />
            </label>
            <label>
              Template type
              <select required value={form.type} onChange={(event) => updateField("type", event.target.value)}>
                <option value="">Select template type</option>
                {templateTypeOptions.map((type) => (
                  <option key={type.id || type.code} value={type.name}>
                    {type.name}
                  </option>
                ))}
              </select>
              <div className="template-type-manager">
                <input
                  type="text"
                  value={newTemplateTypeName}
                  onChange={(event) => setNewTemplateTypeName(event.target.value)}
                  placeholder="Create type"
                />
                <button className="button button-secondary" type="button" onClick={handleAddTemplateType} disabled={!newTemplateTypeName.trim()}>
                  Add
                </button>
                <button
                  className="button button-secondary button-danger"
                  type="button"
                  onClick={handleDeleteSelectedTemplateType}
                  disabled={!selectedTemplateType?.id}
                >
                  Delete
                </button>
              </div>
            </label>
            <label>
              Page size
              <select value={activePageSize} onChange={(event) => updateDesign("pageSize", event.target.value)}>
                <option value="A4">Letter = A4 - 210 x 297 mm - Standard office documents, letters</option>
                <option value="LEGAL">AG = Legal - 8.5 x 14 inches (216 x 356 mm) - Agreements, contracts, legal documents</option>
              </select>
            </label>
            <label>
              Total pages
              <input type="number" min="1" max="50" value={totalTemplatePages} onChange={(event) => updateDesign("additionalPages", clamp(Number(event.target.value), 1, 50))} />
            </label>
            <label className="span-2">
              Default subject
              <input
                type="text"
                value={form.defaultSubject}
                onChange={(event) => updateField("defaultSubject", event.target.value)}
                placeholder="Salary Certificate"
              />
            </label>

            <label>
              Template code (optional)
              <input
                type="text"
                value={form.refCode || ""}
                onChange={(event) => updateField("refCode", event.target.value.toUpperCase())}
                placeholder="OFFER / PROM"
              />
            </label>

            <label className="span-2">
              Template reference format (optional override)
              <input
                type="text"
                value={form.letterNoPattern}
                onChange={(event) => updateField("letterNoPattern", event.target.value)}
                placeholder={DEFAULT_REFERENCE_PATTERN}
              />
            </label>

            <div className="placeholder-picker span-2">
              <p className="placeholder-picker__label">Reference format tokens</p>
              <div className="placeholder-picker__grid">
                {REFERENCE_FORMAT_TOKENS.map((token) => (
                  <button
                    key={token}
                    className="button button-secondary"
                    type="button"
                    onClick={() => appendTokenToReferencePattern(token)}
                  >
                    {token}
                  </button>
                ))}
              </div>
            </div>

            <div className="design-settings span-2 template-builder-launcher">
              <div className="design-settings__header">
                <div>
                  <p className="eyebrow">Design Workspace</p>
                  <h3>Clean mode</h3>
                </div>
              </div>
              <div className="button-row" style={{ marginBottom: 12 }}>
                {templatePageIndexes.map((pageIndex) => (
                  <button
                    key={`page-tab-${pageIndex + 1}`}
                    className={`button ${activeEditorPageIndex === pageIndex ? "button-primary" : "button-secondary"}`}
                    type="button"
                    onClick={() => {
                      setActiveEditorPageIndex(pageIndex);
                      clearCanvasSelection();
                    }}
                  >
                    Page {pageIndex + 1}
                  </button>
                ))}
              </div>
              <p className="template-builder-launcher__copy">
                Use Full Editor for large page editing. The selected page tab controls which page gets its own elements.
              </p>
              <div className="button-row">
                <button className="button button-primary" type="button" onClick={openFullscreenEditor}>
                  Open Full Editor
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setShowAdvancedBuilder((current) => !current)}
                >
                  {showAdvancedBuilder ? "Hide advanced controls" : "Show advanced controls"}
                </button>
              </div>

              <div className="template-mini-preview">
                <div className="template-mini-preview__heading">
                  <strong>Template preview</strong>
                  <span>Quick look (read-only)</span>
                </div>
                <div className="template-mini-preview__viewport">
                  <div
                    className="template-mini-preview__zoom-layer"
                    style={{
                      width: `${canvasWidth * MINI_PREVIEW_SCALE}px`,
                      height: `${(canvasHeight * totalTemplatePages + Math.max(0, totalTemplatePages - 1) * 24) * MINI_PREVIEW_SCALE}px`,
                      display: "grid",
                      gap: `${24 * MINI_PREVIEW_SCALE}px`,
                    }}
                  >
                    {templatePageIndexes.map((pageIndex) => (
                      <div
                        key={`mini-page-${pageIndex + 1}`}
                        className="template-canvas template-canvas--fullscreen template-canvas--mini"
                        style={{
                          width: `${canvasWidth}px`,
                          height: `${canvasHeight}px`,
                          minHeight: `${canvasHeight}px`,
                          transform: `scale(${MINI_PREVIEW_SCALE})`,
                          transformOrigin: "top left",
                        }}
                      >
                        {form.design.backgroundImage.dataUrl ? (
                          <img
                            className="template-canvas__bg"
                            src={form.design.backgroundImage.dataUrl}
                            alt="Template background preview"
                            style={{
                              objectFit: form.design.backgroundImage.fit,
                              opacity: form.design.backgroundImage.opacity / 100,
                            }}
                          />
                        ) : null}
                        <div className="template-canvas__content-layer template-canvas__content-layer--preview" style={canvasContentLayerStyle}>
                          {allCanvasElements
                            .filter((element) => Number(element.pageIndex || 0) === pageIndex)
                            .map((element) => (
                            <div
                              key={`mini-page-${pageIndex + 1}-element-${element.id}`}
                              className={`canvas-element canvas-element--${element.type} canvas-element--mini`}
                              style={{
                                left: `${element.x}%`,
                                top: `${element.y}%`,
                                width: `${element.width}%`,
                                height: `${element.height}%`,
                                zIndex: element.zIndex,
                                color: element.color,
                                backgroundColor: element.type === "text" || element.type === "field" ? "transparent" : element.backgroundColor,
                                borderColor: element.borderColor,
                                borderWidth: `${element.borderWidth}px`,
                                fontSize: `${element.fontSize}px`,
                                fontFamily: element.fontFamily || "inherit",
                                fontWeight: element.fontWeight,
                                textDecoration: element.textDecoration || "none",
                                textAlign: element.align || "left",
                                lineHeight: Number(element.lineHeight ?? 1.35),
                                letterSpacing: `${Number(element.letterSpacing ?? 0)}px`,
                                opacity: element.opacity / 100,
                                padding:
                                  element.type === "text" || element.type === "field"
                                    ? `${Number(element.paddingY ?? 4)}px ${Number(element.paddingX ?? 6)}px`
                                    : undefined,
                              }}
                            >
                              {element.type === "line" ? (
                                <span
                                  className="canvas-line"
                                  style={{
                                    backgroundColor: element.color,
                                    height: `${getLineStrokeWidth(element)}px`,
                                  }}
                                />
                              ) : null}
                              {element.type === "text" ? (
                                <span className="canvas-element__text-content">
                                  {renderEditorMarkdownBlocks(element.text || "Text", `mini-${pageIndex}-${element.id}`)}
                                </span>
                              ) : null}
                              {element.type === "field" ? (
                                <span className="canvas-field-chip">
                                  {(element.text || "Field").trim()}: {`{{${element.fieldKey || "recipient_name"}}}`}
                                </span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {showAdvancedBuilder ? (
              <>
            <div className="design-settings span-2">
              <div className="design-settings__header">
                <div>
                  <p className="eyebrow">Design Settings</p>
                  <h3>Control the template look</h3>
                </div>
              </div>

              <div className="design-grid">
                <label>
                  Render mode
                  <select value={form.design.renderMode} onChange={(event) => updateDesign("renderMode", event.target.value)}>
                    {RENDER_MODES.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Design preset
                  <select value={form.design.layout} onChange={(event) => updateDesign("layout", event.target.value)}>
                    {DESIGN_LAYOUTS.map((layout) => (
                      <option key={layout.value} value={layout.value}>
                        {layout.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Title override
                  <input
                    type="text"
                    value={form.design.titleText}
                    onChange={(event) => updateDesign("titleText", event.target.value)}
                    placeholder="Employee Undertaking & Declaration"
                  />
                </label>
                <label>
                  Primary color
                  <input
                    type="color"
                    value={form.design.accentColor}
                    onChange={(event) => updateDesign("accentColor", event.target.value)}
                  />
                </label>
                <label>
                  Secondary color
                  <input
                    type="color"
                    value={form.design.secondaryColor}
                    onChange={(event) => updateDesign("secondaryColor", event.target.value)}
                  />
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={form.design.showContactLine}
                    onChange={(event) => updateDesign("showContactLine", event.target.checked)}
                  />
                  <span>Show phone and email line</span>
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={form.design.showSignatureLine}
                    onChange={(event) => updateDesign("showSignatureLine", event.target.checked)}
                  />
                  <span>Show signature blocks</span>
                </label>
                <label className="checkbox-field span-2">
                  <input
                    type="checkbox"
                    checked={form.design.showDecorativeHeader}
                    onChange={(event) => updateDesign("showDecorativeHeader", event.target.checked)}
                  />
                  <span>Use decorative header ribbons and accent shapes</span>
                </label>
                <label>
                  Page padding X (%)
                  <input
                    type="number"
                    min="0"
                    max="25"
                    step="0.5"
                    value={canvasPaddingXPercent}
                    onChange={(event) => updateDesign("pagePaddingX", clamp(Number(event.target.value), 0, 25))}
                  />
                </label>
                <label>
                  Page padding Y (%)
                  <input
                    type="number"
                    min="0"
                    max="25"
                    step="0.5"
                    value={canvasPaddingYPercent}
                    onChange={(event) => updateDesign("pagePaddingY", clamp(Number(event.target.value), 0, 25))}
                  />
                </label>
              </div>
            </div>

            <div className="design-settings span-2">
              <div className="design-settings__header">
                <div>
                  <p className="eyebrow">Dynamic Fields</p>
                  <h3>Custom issue form fields</h3>
                </div>
              </div>

              {customFieldDefinitions.length ? (
                <div className="custom-fields-grid">
                  {customFieldDefinitions.map((field, index) => (
                    <article key={`${field.key}-${index}`} className="custom-field-card">
                      <label>
                        Label
                        <input
                          type="text"
                          value={field.label}
                          onChange={(event) => updateCustomField(index, { label: event.target.value })}
                          placeholder="Employee Name"
                        />
                      </label>
                      <label>
                        Token key
                        <input
                          type="text"
                          value={field.key}
                          onChange={(event) => updateCustomField(index, { key: event.target.value })}
                          placeholder="employee_name"
                        />
                      </label>
                      <label>
                        Input type
                        <select
                          value={field.type}
                          onChange={(event) => updateCustomField(index, { type: event.target.value })}
                        >
                          {CUSTOM_FIELD_TYPES.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Placeholder
                        <input
                          type="text"
                          value={field.placeholder || ""}
                          onChange={(event) => updateCustomField(index, { placeholder: event.target.value })}
                          placeholder="Enter employee CNIC"
                        />
                      </label>
                      <label>
                        Default value
                        <input
                          type="text"
                          value={field.defaultValue || ""}
                          onChange={(event) => updateCustomField(index, { defaultValue: event.target.value })}
                          placeholder="N/A"
                        />
                      </label>
                      <label className="checkbox-field">
                        <input
                          type="checkbox"
                          checked={Boolean(field.required)}
                          onChange={(event) => updateCustomField(index, { required: event.target.checked })}
                        />
                        <span>Required field</span>
                      </label>
                      <div className="button-row">
                        <button className="button button-secondary" type="button" onClick={() => removeCustomField(index)}>
                          Delete field
                        </button>
                        <span className="custom-field-token">{`{{cf_${field.key}}}`}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="custom-field-empty">No custom fields yet. Add fields below to make this template fully dynamic.</p>
              )}

              <div className="custom-field-add">
                <label>
                  New field label
                  <input
                    type="text"
                    value={customFieldDraft.label}
                    onChange={(event) => setCustomFieldDraft((current) => ({ ...current, label: event.target.value }))}
                    placeholder="Cheque No"
                  />
                </label>
                <label>
                  New field key (optional)
                  <input
                    type="text"
                    value={customFieldDraft.key}
                    onChange={(event) => setCustomFieldDraft((current) => ({ ...current, key: normalizeCustomFieldKey(event.target.value) }))}
                    placeholder="cheque_no"
                  />
                </label>
                <label>
                  Input type
                  <select
                    value={customFieldDraft.type}
                    onChange={(event) => setCustomFieldDraft((current) => ({ ...current, type: event.target.value }))}
                  >
                    {CUSTOM_FIELD_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Placeholder
                  <input
                    type="text"
                    value={customFieldDraft.placeholder}
                    onChange={(event) => setCustomFieldDraft((current) => ({ ...current, placeholder: event.target.value }))}
                    placeholder="Enter value"
                  />
                </label>
                <label>
                  Default value
                  <input
                    type="text"
                    value={customFieldDraft.defaultValue}
                    onChange={(event) => setCustomFieldDraft((current) => ({ ...current, defaultValue: event.target.value }))}
                    placeholder="Optional default"
                  />
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={customFieldDraft.required}
                    onChange={(event) => setCustomFieldDraft((current) => ({ ...current, required: event.target.checked }))}
                  />
                  <span>Required field</span>
                </label>
                <div className="button-row">
                  <button className="button button-secondary" type="button" onClick={addCustomField}>
                    Add custom field
                  </button>
                </div>
              </div>
            </div>

            {detectedDynamicTokenFields.length ? (
              <div className="design-settings span-2">
                <div className="design-settings__header">
                  <div>
                    <p className="eyebrow">Detected Placeholders</p>
                    <h3>Mark placeholders as required</h3>
                  </div>
                </div>
                <div className="custom-fields-grid">
                  {detectedDynamicTokenFields.map((field) => (
                    <article key={field.key} className="custom-field-card">
                      <p><strong>{field.label}</strong> <code>{field.token}</code></p>
                      <label className="checkbox-field">
                        <input
                          type="checkbox"
                          checked={requiredTokenKeySet.has(field.key)}
                          onChange={(event) => toggleRequiredToken(field.key, event.target.checked)}
                        />
                        <span>Required in Issue Letter form</span>
                      </label>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="background-uploader span-2">
              <div className="background-uploader__header">
                <p className="eyebrow">Background Template</p>
                <h3>Upload design image</h3>
              </div>
              <div className="design-grid">
                <label className="span-2">
                  Upload Canva export (PNG/JPG/WebP)
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleBackgroundUpload} />
                </label>
                <label>
                  Fit mode
                  <select value={form.design.backgroundImage.fit} onChange={(event) => updateBackground("fit", event.target.value)}>
                    {BACKGROUND_FITS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Opacity (%)
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={form.design.backgroundImage.opacity}
                    onChange={(event) => updateBackground("opacity", clamp(Number(event.target.value), 10, 100))}
                  />
                </label>
                <div className="span-2 background-uploader__footer">
                  <span>{form.design.backgroundImage.fileName || "No background uploaded"}</span>
                  <button className="button button-secondary" type="button" onClick={clearBackground}>
                    Clear background
                  </button>
                </div>
              </div>
            </div>

            <div className="canvas-editor span-2">
              <div className="canvas-toolbar">
                <div className="canvas-toolbar__actions">
                  {ELEMENT_TYPES.map((type) => (
                    <button
                      key={type.value}
                      className="button button-secondary"
                      type="button"
                      onClick={() => addCanvasElement(type.value)}
                    >
                      Add {type.label}
                    </button>
                  ))}
                  <button className="button button-secondary" type="button" onClick={applyBackgroundTextPreset}>
                    Auto Place Fields
                  </button>
                </div>
                <div className="canvas-toolbar__actions">
                  <button className="button button-secondary" type="button" onClick={handleUndoCanvas} disabled={!canUndoCanvas}>
                    Undo
                  </button>
                  <button className="button button-secondary" type="button" onClick={handleRedoCanvas} disabled={!canRedoCanvas}>
                    Redo
                  </button>
                  <button className="button button-secondary" type="button" onClick={copySelectedElement} disabled={!selectedElement}>
                    Copy
                  </button>
                  <button className="button button-secondary" type="button" onClick={duplicateSelectedElement} disabled={!selectedElement}>
                    Duplicate
                  </button>
                  <button className="button button-secondary" type="button" onClick={pasteCopiedElement} disabled={!copiedCanvasElement}>
                    Paste
                  </button>
                  <button className="button button-secondary" type="button" onClick={() => moveLayer("up")} disabled={!selectedElement}>
                    Bring Front
                  </button>
                  <button className="button button-secondary" type="button" onClick={() => moveLayer("down")} disabled={!selectedElement}>
                    Send Back
                  </button>
                  <button className="button button-secondary" type="button" onClick={clearCanvas}>
                    Clear
                  </button>
                  <button className="button button-secondary" type="button" onClick={openFullscreenEditor}>
                    Full Editor
                  </button>
                </div>
              </div>

              <div className="canvas-workspace">
                <div
                  className="template-canvas"
                  onPointerDown={() => {
                    clearCanvasSelection();
                    closeInlineEditor(true);
                    setAlignmentGuides({ vertical: null, horizontal: null });
                  }}
                >
                  {form.design.backgroundImage.dataUrl ? (
                    <img
                      className="template-canvas__bg"
                      src={form.design.backgroundImage.dataUrl}
                      alt="Template background"
                      style={{
                        objectFit: form.design.backgroundImage.fit,
                        opacity: form.design.backgroundImage.opacity / 100,
                      }}
                    />
                  ) : null}
                  <div className="template-canvas__content-layer" ref={inlineCanvasRef} style={canvasContentLayerStyle}>
                    {selectedElement && inlineToolbarStyle ? (
                      <div
                        className="canvas-inline-toolbar"
                        style={inlineToolbarStyle}
                        onPointerDown={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.preventDefault()}
                      >
                        <div className="canvas-inline-toolbar__group">
                          <button className="canvas-inline-toolbar__btn" type="button" onClick={() => changeSelectedElementSize(-1, 0)} title="Width -">
                            W-
                          </button>
                          <button className="canvas-inline-toolbar__btn" type="button" onClick={() => changeSelectedElementSize(1, 0)} title="Width +">
                            W+
                          </button>
                          <button className="canvas-inline-toolbar__btn" type="button" onClick={() => changeSelectedElementSize(0, -1)} title="Height -">
                            H-
                          </button>
                          <button className="canvas-inline-toolbar__btn" type="button" onClick={() => changeSelectedElementSize(0, 1)} title="Height +">
                            H+
                          </button>
                        </div>
                        {selectedElement.type === "text" || selectedElement.type === "field" ? (
                          <div className="canvas-inline-toolbar__group">
                            <button className="canvas-inline-toolbar__btn" type="button" onClick={() => changeSelectedFontSize(-1)} title="Font size -">
                              A-
                            </button>
                            <button className="canvas-inline-toolbar__btn" type="button" onClick={() => changeSelectedFontSize(1)} title="Font size +">
                              A+
                            </button>
                            <button
                              className={`canvas-inline-toolbar__btn ${String(selectedElement.fontWeight) === "700" ? "is-active" : ""}`}
                              type="button"
                              onClick={handleBoldClick}
                              title="Bold"
                            >
                              B
                            </button>
                            <button
                              className={`canvas-inline-toolbar__btn ${selectedElement.textDecoration === "underline" ? "is-active" : ""}`}
                              type="button"
                              onClick={handleUnderlineClick}
                              title="Underline"
                            >
                              U
                            </button>
                            <button
                              className="canvas-inline-toolbar__btn"
                              type="button"
                              onClick={handleItalicClick}
                              title="Italic"
                            >
                              I
                            </button>
                            <button
                              className={`canvas-inline-toolbar__btn ${selectedElement.align === "left" ? "is-active" : ""}`}
                              type="button"
                              onClick={() => setSelectedTextAlign("left")}
                              title="Align left"
                            >
                              L
                            </button>
                            <button
                              className={`canvas-inline-toolbar__btn ${selectedElement.align === "center" ? "is-active" : ""}`}
                              type="button"
                              onClick={() => setSelectedTextAlign("center")}
                              title="Align center"
                            >
                              C
                            </button>
                            <button
                              className={`canvas-inline-toolbar__btn ${selectedElement.align === "right" ? "is-active" : ""}`}
                              type="button"
                              onClick={() => setSelectedTextAlign("right")}
                              title="Align right"
                            >
                              R
                            </button>
                          </div>
                        ) : null}
                        <div className="canvas-inline-toolbar__group">
                          <button className="canvas-inline-toolbar__btn" type="button" onClick={duplicateSelectedElement} title="Duplicate element">
                            Dup
                          </button>
                          <button className="canvas-inline-toolbar__btn" type="button" onClick={removeSelectedElement} title="Delete element">
                            Del
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {alignmentGuides.vertical != null ? (
                      <span className="canvas-alignment-guide canvas-alignment-guide--vertical" style={{ left: `${alignmentGuides.vertical}%` }} />
                    ) : null}
                    {alignmentGuides.horizontal != null ? (
                      <span className="canvas-alignment-guide canvas-alignment-guide--horizontal" style={{ top: `${alignmentGuides.horizontal}%` }} />
                    ) : null}
                    {canvasElements.map((element) => (
                      <div
                        key={element.id}
                        className={`canvas-element canvas-element--${element.type} ${selectedElementIdSet.has(element.id) ? "is-selected" : ""}`}
                        style={{
                          left: `${element.x}%`,
                          top: `${element.y}%`,
                          width: `${element.width}%`,
                          height: `${element.height}%`,
                          zIndex: element.zIndex,
                          color: element.color,
                          backgroundColor: element.type === "text" || element.type === "field" ? "transparent" : element.backgroundColor,
                          borderColor: element.borderColor,
                          borderWidth: `${element.borderWidth}px`,
                          fontSize: `${element.fontSize}px`,
                          fontFamily: element.fontFamily || "inherit",
                          fontWeight: element.fontWeight,
                          textDecoration: element.textDecoration || "none",
                          textAlign: element.align || "left",
                          lineHeight: Number(element.lineHeight ?? 1.35),
                          letterSpacing: `${Number(element.letterSpacing ?? 0)}px`,
                          opacity: element.opacity / 100,
                          padding:
                            element.type === "text" || element.type === "field"
                              ? `${Number(element.paddingY ?? 4)}px ${Number(element.paddingX ?? 6)}px`
                              : undefined,
                          cursor:
                            element.type === "text" && inlineTextEditElementId === element.id
                              ? "text"
                              : undefined,
                        }}
                        onPointerDown={(event) => handleElementPointerDown(event, element, "drag")}
                        onPointerUp={(event) => handleElementPointerUp(event, element)}
                      >
                        {element.type === "line" ? (
                          <span
                            className="canvas-line"
                            style={{
                              backgroundColor: element.color,
                              height: `${getLineStrokeWidth(element)}px`,
                            }}
                          />
                        ) : null}
                        {element.type === "text" ? (
                          inlineTextEditElementId === element.id ? (
                            <div
                              ref={(node) => {
                                setCanvasTextNodeRef(element.id, node);
                                if (node && document.activeElement === node) {
                                  textEditorRef.current = node;
                                }
                              }}
                              className="canvas-inline-text-editor"
                              contentEditable
                              suppressContentEditableWarning
                              dangerouslySetInnerHTML={{ __html: markdownToEditableHtml(element.text || "") }}
                              onPointerDown={(event) => event.stopPropagation()}
                              onFocus={(event) => {
                                textEditorRef.current = event.currentTarget;
                                rememberCanvasTextSelection(element.id);
                              }}
                              onInput={() => rememberCanvasTextSelection(element.id)}
                              onKeyUp={() => rememberCanvasTextSelection(element.id)}
                              onMouseUp={() => rememberCanvasTextSelection(element.id)}
                              onClick={() => rememberCanvasTextSelection(element.id)}
                              onBlur={() => commitInlineEditorValue(element.id, { close: true })}
                              onKeyDown={(event) => {
                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  closeInlineEditor(true);
                                }
                              }}
                            />
                          ) : (
                            <span
                              ref={(node) => setCanvasTextNodeRef(element.id, node)}
                              className="canvas-element__text-content"
                              onPointerUp={(event) => {
                                event.stopPropagation();
                                rememberCanvasTextSelection(element.id);
                              }}
                              onMouseUp={(event) => {
                                event.stopPropagation();
                                rememberCanvasTextSelection(element.id);
                              }}
                              onDoubleClick={(event) => {
                                event.stopPropagation();
                                setSelectedElementId(element.id);
                                setSelectedElementIds([element.id]);
                                openInlineEditorAtPoint(element.id, event.clientX, event.clientY);
                              }}
                            >
                              {renderEditorMarkdownBlocks(element.text || "Text", `inline-${element.id}`)}
                            </span>
                          )
                        ) : null}
                        {element.type === "field" ? (
                          <span className="canvas-field-chip">
                            {(element.text || "Field").trim()}: {`{{${element.fieldKey || "recipient_name"}}}`}
                          </span>
                        ) : null}
                        {selectedElementId === element.id && element.type === "line" ? (
                          <>
                            <button
                              type="button"
                              className="canvas-line-handle canvas-line-handle--start"
                              onPointerDown={(event) => handleElementPointerDown(event, element, "line-resize-start")}
                              aria-label="Resize line from start"
                            />
                            <button
                              type="button"
                              className="canvas-line-handle canvas-line-handle--end"
                              onPointerDown={(event) => handleElementPointerDown(event, element, "line-resize-end")}
                              aria-label="Resize line from end"
                            />
                          </>
                        ) : selectedElementId === element.id ? (
                          <button
                            type="button"
                            className="canvas-resize-handle"
                            onPointerDown={(event) => handleElementPointerDown(event, element, "resize")}
                            aria-label="Resize element"
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="canvas-properties">
                  <h4>Element Properties</h4>
                  {selectedElement ? (
                    <div className="canvas-properties__form">
                      <label>
                        X Position (%)
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={selectedElement.x.toFixed(1)}
                          onChange={(event) => updateSelectedElement({ x: clamp(Number(event.target.value), 0, 100 - selectedElement.width) })}
                        />
                      </label>
                      <label>
                        Y Position (%)
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={selectedElement.y.toFixed(1)}
                          onChange={(event) => updateSelectedElement({ y: clamp(Number(event.target.value), 0, 100 - selectedElement.height) })}
                        />
                      </label>
                      <label>
                        Width (%)
                        <input
                          type="number"
                          min="1"
                          max="100"
                          step="0.1"
                          value={selectedElement.width.toFixed(1)}
                          onChange={(event) => updateSelectedElement({ width: clamp(Number(event.target.value), 1, 100 - selectedElement.x) })}
                        />
                      </label>
                      <label>
                        Height (%)
                        <input
                          type="number"
                          min="0.8"
                          max="100"
                          step="0.1"
                          value={selectedElement.height.toFixed(1)}
                          onChange={(event) => updateSelectedElement({ height: clamp(Number(event.target.value), 0.8, 100 - selectedElement.y) })}
                        />
                      </label>
                      <label>
                        Page padding X (%)
                        <input
                          type="number"
                          min="0"
                          max="25"
                          step="0.5"
                          value={canvasPaddingXPercent}
                          onChange={(event) => updateDesign("pagePaddingX", clamp(Number(event.target.value), 0, 25))}
                        />
                      </label>
                      <label>
                        Page padding Y (%)
                        <input
                          type="number"
                          min="0"
                          max="25"
                          step="0.5"
                          value={canvasPaddingYPercent}
                          onChange={(event) => updateDesign("pagePaddingY", clamp(Number(event.target.value), 0, 25))}
                        />
                      </label>
                      <label>
                        Padding X (px)
                        <input
                          type="number"
                          min="0"
                          max="60"
                          step="1"
                          value={Number(selectedElement.paddingX ?? 6)}
                          onChange={(event) => updateSelectedElement({ paddingX: clamp(Number(event.target.value), 0, 60) })}
                          disabled={selectedElement.type === "line" || selectedElement.type === "rect"}
                        />
                      </label>
                      <label>
                        Padding Y (px)
                        <input
                          type="number"
                          min="0"
                          max="60"
                          step="1"
                          value={Number(selectedElement.paddingY ?? 4)}
                          onChange={(event) => updateSelectedElement({ paddingY: clamp(Number(event.target.value), 0, 60) })}
                          disabled={selectedElement.type === "line" || selectedElement.type === "rect"}
                        />
                      </label>

                      <div className="alignment-tools span-2">
                        <p>Align on page</p>
                        <div className="alignment-tools__grid">
                          <button className="button button-secondary" type="button" onClick={() => alignSelectedElement("left")}>
                            Left
                          </button>
                          <button className="button button-secondary" type="button" onClick={() => alignSelectedElement("center")}>
                            Center
                          </button>
                          <button className="button button-secondary" type="button" onClick={() => alignSelectedElement("right")}>
                            Right
                          </button>
                          <button className="button button-secondary" type="button" onClick={() => alignSelectedElement("top")}>
                            Top
                          </button>
                          <button className="button button-secondary" type="button" onClick={() => alignSelectedElement("middle")}>
                            Middle
                          </button>
                          <button className="button button-secondary" type="button" onClick={() => alignSelectedElement("bottom")}>
                            Bottom
                          </button>
                        </div>
                      </div>

                      {selectedElement.type === "text" ? (
                        <div className="span-2">
                          <label>
                            Text
                            <textarea
                              rows={4}
                              value={selectedElement.text}
                              onChange={(event) => updateSelectedElement({ text: event.target.value })}
                              onFocus={rememberTextSelection}
                              onSelect={rememberTextSelection}
                              onKeyUp={rememberTextSelection}
                              onClick={rememberTextSelection}
                              placeholder="Example: Name: {{recipient_name}}"
                            />
                          </label>
                          <div className="placeholder-picker">
                            <p className="placeholder-picker__label">Insert dynamic value in selected text</p>
                            <div className="text-selection-tools" onMouseDown={keepInlineEditorFocused}>
                              <button
                                className="button button-secondary"
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={handleBoldClick}
                              >
                                Bold selected
                              </button>
                              <button
                                className="button button-secondary"
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={handleUnderlineClick}
                              >
                                Underline selected
                              </button>
                              <button
                                className="button button-secondary"
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={handleItalicClick}
                              >
                                Italic selected
                              </button>
                              <span>Select text on canvas or in textbox, then apply style.</span>
                            </div>
                            <div className="placeholder-picker__grid" onMouseDown={keepInlineEditorFocused}>
                              <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{recipient_name}}")}>{"{{recipient_name}}"}</button>
                              <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{recipient_company}}")}>{"{{recipient_company}}"}</button>
                              <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{recipient_department}}")}>{"{{recipient_department}}"}</button>
                              <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{subject}}")}>{"{{subject}}"}</button>
                              <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{issue_date}}")}>{"{{issue_date}}"}</button>
                              <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{company_code}}")}>{"{{company_code}}"}</button>
                              <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{department_code}}")}>{"{{department_code}}"}</button>
                              <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{template_code}}")}>{"{{template_code}}"}</button>
                              <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{letter_no}}")}>{"{{letter_no}}"}</button>
                              <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{body_text}}")}>{"{{body_text}}"}</button>
                              <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{custom_fields_block}}")}>{"{{custom_fields_block}}"}</button>
                              <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{employee_emp_id}}")}>{"{{employee_emp_id}}"}</button>
                              <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{employee_name}}")}>{"{{employee_name}}"}</button>
                              <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{employee_cnic}}")}>{"{{employee_cnic}}"}</button>
                              <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{employee_designation}}")}>{"{{employee_designation}}"}</button>
                              <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{employee_department}}")}>{"{{employee_department}}"}</button>
                              <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{employee_address}}")}>{"{{employee_address}}"}</button>
                              <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{employee_joining_date}}")}>{"{{employee_joining_date}}"}</button>
                              <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{joining_date}}")}>{"{{joining_date}}"}</button>
                              {customFieldTokenOptions.map((option) => (
                                <button
                                  key={option.key}
                                  className="button button-secondary"
                                  type="button"
                                  onClick={() => appendTokenToSelectedText(option.token)}
                                >
                                  {option.token}
                                </button>
                              ))}
                              <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("\n")}>New Line</button>
                              <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("  ")}>Double Space</button>
                              <button className="button button-secondary" type="button" onClick={removeSelectedTextLine}>Remove Last Line</button>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {selectedElement.type === "field" ? (
                        <div className="span-2">
                          <label>
                            Field label text
                            <input
                              type="text"
                              value={selectedElement.text || ""}
                              onChange={(event) => updateSelectedElement({ text: event.target.value })}
                              placeholder="Example: Name"
                            />
                          </label>
                          <label>
                            Field value source
                            <select
                              value={selectedElement.fieldKey || "recipient_name"}
                              onChange={(event) => updateSelectedElement({ fieldKey: event.target.value })}
                            >
                              {canvasFieldOptions.map((option) => (
                                <option key={option.key} value={option.key}>
                                  {option.label} ({option.token})
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      ) : null}

                      <label>
                        Text / Line color
                        <input type="color" value={selectedElement.color} onChange={(event) => updateSelectedElement({ color: event.target.value })} />
                      </label>
                      <label>
                        Background
                        <input
                          type="color"
                          value={selectedElement.backgroundColor === "transparent" ? "#ffffff" : selectedElement.backgroundColor}
                          onChange={(event) => updateSelectedElement({ backgroundColor: event.target.value })}
                          disabled={selectedElement.type === "text" || selectedElement.type === "field" || selectedElement.type === "line"}
                        />
                      </label>
                      <label>
                        Border color
                        <input type="color" value={selectedElement.borderColor} onChange={(event) => updateSelectedElement({ borderColor: event.target.value })} />
                      </label>
                      <label>
                        Border width
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={selectedElement.borderWidth}
                          onChange={(event) => updateSelectedElement({ borderWidth: clamp(Number(event.target.value), 0, 10) })}
                        />
                      </label>
                      <label>
                        Opacity (%)
                        <input
                          type="number"
                          min="10"
                          max="100"
                          value={selectedElement.opacity}
                          onChange={(event) => updateSelectedElement({ opacity: clamp(Number(event.target.value), 10, 100) })}
                        />
                      </label>
                      <label>
                        Alignment
                        <select
                          value={selectedElement.align || "left"}
                          onChange={(event) => updateSelectedElement({ align: event.target.value })}
                        >
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                          <option value="justify">Justify</option>
                        </select>
                      </label>

                      {selectedElement.type === "text" || selectedElement.type === "field" ? (
                        <>
                          <label>
                            Font size
                            <input
                              type="number"
                              min="8"
                              max="72"
                              value={selectedElement.fontSize}
                              onChange={(event) => updateSelectedElement({ fontSize: clamp(Number(event.target.value), 8, 72) })}
                            />
                          </label>
                          <label>
                            Line spacing
                            <input
                              type="number"
                              min="0.8"
                              max="3"
                              step="0.05"
                              value={Number(selectedElement.lineHeight ?? 1.35)}
                              onChange={(event) => updateSelectedElement({ lineHeight: clamp(Number(event.target.value), 0.8, 3) })}
                            />
                          </label>
                          <label>
                            Letter spacing (px)
                            <input
                              type="number"
                              min="-2"
                              max="20"
                              step="0.1"
                              value={Number(selectedElement.letterSpacing ?? 0)}
                              onChange={(event) => updateSelectedElement({ letterSpacing: clamp(Number(event.target.value), -2, 20) })}
                            />
                          </label>
                          <label>
                            Font family
                            <select
                              value={selectedElement.fontFamily || "inherit"}
                              onChange={(event) => updateSelectedElement({ fontFamily: event.target.value })}
                            >
                              {FONT_FAMILY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Font weight
                            <select
                              value={selectedElement.fontWeight}
                              onChange={(event) => updateSelectedElement({ fontWeight: event.target.value })}
                            >
                              <option value="400">Regular</option>
                              <option value="700">Bold</option>
                            </select>
                          </label>
                          <label>
                            Text decoration
                            <select
                              value={selectedElement.textDecoration || "none"}
                              onChange={(event) => updateSelectedElement({ textDecoration: event.target.value })}
                            >
                              <option value="none">None</option>
                              <option value="underline">Underline</option>
                            </select>
                          </label>
                        </>
                      ) : null}

                      <div className="canvas-element-actions span-2">
                        <button className="button button-secondary" type="button" onClick={copySelectedElement}>
                          Copy Element
                        </button>
                        <button className="button button-secondary" type="button" onClick={duplicateSelectedElement}>
                          Duplicate Element
                        </button>
                        <button className="button button-secondary" type="button" onClick={pasteCopiedElement} disabled={!copiedCanvasElement}>
                          Paste Element
                        </button>
                      </div>

                      <button className="button button-secondary span-2" type="button" onClick={removeSelectedElement}>
                        Delete Element
                      </button>
                    </div>
                  ) : (
                    <div className="canvas-properties__empty">
                      {hasCanvasElements ? (
                        <p>Select an element on canvas (or from list below) to edit its properties.</p>
                      ) : (
                        <>
                          <p>No editable layers yet. Add one, or auto-place common letter fields.</p>
                          <div className="canvas-empty-actions">
                            <button className="button button-secondary" type="button" onClick={() => addCanvasElement("text")}>
                              Add Text
                            </button>
                            <button className="button button-secondary" type="button" onClick={() => addCanvasElement("field")}>
                              Add Field
                            </button>
                            <button className="button button-secondary" type="button" onClick={applyBackgroundTextPreset}>
                              Auto Place Fields
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {hasCanvasElements ? (
                    <div className="canvas-elements-list">
                      <p>Elements ({canvasElements.length})</p>
                      <div className="canvas-elements-list__grid">
                        {canvasElements.map((element, index) => (
                          <button
                            key={element.id}
                            type="button"
                            className={`canvas-elements-list__item ${selectedElementIdSet.has(element.id) ? "is-active" : ""}`}
                            onClick={(event) => handleElementListSelection(event, element.id)}
                          >
                            {getElementLabel(element, index)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <label className="span-2">
              Body template
              <textarea
                rows={12}
                value={form.bodyTemplate}
                onChange={(event) => updateField("bodyTemplate", event.target.value)}
                placeholder="Use placeholders like {{recipient_name}}, {{subject}}, {{issue_date}}, {{company_name}}, {{department_name}}, {{body_notes}}"
              />
            </label>
            <div className="placeholder-picker span-2">
              <p className="placeholder-picker__label">Insert dynamic tokens in body template</p>
              <div className="placeholder-picker__grid">
                <button className="button button-secondary" type="button" onClick={() => appendTokenToBodyTemplate("{{recipient_name}}")}>{"{{recipient_name}}"}</button>
                <button className="button button-secondary" type="button" onClick={() => appendTokenToBodyTemplate("{{recipient_company}}")}>{"{{recipient_company}}"}</button>
                <button className="button button-secondary" type="button" onClick={() => appendTokenToBodyTemplate("{{recipient_department}}")}>{"{{recipient_department}}"}</button>
                <button className="button button-secondary" type="button" onClick={() => appendTokenToBodyTemplate("{{company_name}}")}>{"{{company_name}}"}</button>
                <button className="button button-secondary" type="button" onClick={() => appendTokenToBodyTemplate("{{department_name}}")}>{"{{department_name}}"}</button>
                <button className="button button-secondary" type="button" onClick={() => appendTokenToBodyTemplate("{{company_code}}")}>{"{{company_code}}"}</button>
                <button className="button button-secondary" type="button" onClick={() => appendTokenToBodyTemplate("{{department_code}}")}>{"{{department_code}}"}</button>
                <button className="button button-secondary" type="button" onClick={() => appendTokenToBodyTemplate("{{template_code}}")}>{"{{template_code}}"}</button>
                <button className="button button-secondary" type="button" onClick={() => appendTokenToBodyTemplate("{{issue_date}}")}>{"{{issue_date}}"}</button>
                <button className="button button-secondary" type="button" onClick={() => appendTokenToBodyTemplate("{{letter_no}}")}>{"{{letter_no}}"}</button>
                <button className="button button-secondary" type="button" onClick={() => appendTokenToBodyTemplate("{{body_notes}}")}>{"{{body_notes}}"}</button>
                <button className="button button-secondary" type="button" onClick={() => appendTokenToBodyTemplate("{{body_text}}")}>{"{{body_text}}"}</button>
                <button className="button button-secondary" type="button" onClick={() => appendTokenToBodyTemplate("{{custom_fields_block}}")}>{"{{custom_fields_block}}"}</button>
                <button className="button button-secondary" type="button" onClick={() => appendTokenToBodyTemplate("{{employee_emp_id}}")}>{"{{employee_emp_id}}"}</button>
                <button className="button button-secondary" type="button" onClick={() => appendTokenToBodyTemplate("{{employee_name}}")}>{"{{employee_name}}"}</button>
                <button className="button button-secondary" type="button" onClick={() => appendTokenToBodyTemplate("{{employee_cnic}}")}>{"{{employee_cnic}}"}</button>
                <button className="button button-secondary" type="button" onClick={() => appendTokenToBodyTemplate("{{employee_designation}}")}>{"{{employee_designation}}"}</button>
                <button className="button button-secondary" type="button" onClick={() => appendTokenToBodyTemplate("{{employee_department}}")}>{"{{employee_department}}"}</button>
                <button className="button button-secondary" type="button" onClick={() => appendTokenToBodyTemplate("{{employee_address}}")}>{"{{employee_address}}"}</button>
                <button className="button button-secondary" type="button" onClick={() => appendTokenToBodyTemplate("{{employee_joining_date}}")}>{"{{employee_joining_date}}"}</button>
                <button className="button button-secondary" type="button" onClick={() => appendTokenToBodyTemplate("{{joining_date}}")}>{"{{joining_date}}"}</button>
                {customFieldTokenOptions.map((option) => (
                  <button
                    key={option.key}
                    className="button button-secondary"
                    type="button"
                    onClick={() => appendTokenToBodyTemplate(option.token)}
                  >
                    {option.token}
                  </button>
                ))}
                <button className="button button-secondary" type="button" onClick={() => appendTokenToBodyTemplate("\n")}>New Line</button>
              </div>
            </div>
              </>
            ) : null}
            <div className="button-row span-2">
              <button className="button button-primary" type="submit" disabled={!companies.length || !departmentOptions.length}>
                {editingTemplateId ? "Update template" : "Save template"}
              </button>
              {editingTemplateId ? (
                <>
                  <button className="button button-secondary" type="button" onClick={handleSaveAsTemplate}>
                    Save As
                  </button>
                  <button className="button button-secondary" type="button" onClick={() => resetToCreateMode()}>
                    Cancel edit
                  </button>
                  <button className="button button-secondary" type="button" onClick={handleDeleteCurrentTemplate}>
                    Delete template
                  </button>
                </>
              ) : null}
            </div>
          </form>

          <div className="helper-note">
            {showAdvancedBuilder ? (
              <>
                Available placeholders: <code>{"{{letter_no}}"}</code>, <code>{"{{issue_date}}"}</code>, <code>{"{{recipient_name}}"}</code>,{" "}
                <code>{"{{recipient_company}}"}</code>, <code>{"{{recipient_department}}"}</code>, <code>{"{{subject}}"}</code>,{" "}
                <code>{"{{company_name}}"}</code>, <code>{"{{department_name}}"}</code>, <code>{"{{company_code}}"}</code>, <code>{"{{department_code}}"}</code>, <code>{"{{template_code}}"}</code>, <code>{"{{body_notes}}"}</code>,{" "}
                <code>{"{{prepared_by}}"}</code>, <code>{"{{approved_by}}"}</code>, <code>{"{{remarks}}"}</code>, <code>{"{{body_text}}"}</code>, <code>{"{{custom_fields_block}}"}</code>,{" "}
                <code>{"{{employee_emp_id}}"}</code>, <code>{"{{employee_name}}"}</code>, <code>{"{{employee_cnic}}"}</code>, <code>{"{{employee_designation}}"}</code>, <code>{"{{employee_department}}"}</code>, <code>{"{{employee_address}}"}</code>, <code>{"{{employee_joining_date}}"}</code>, <code>{"{{joining_date}}"}</code>
                {customFieldTokenOptions.length ? (
                  <>
                    <br />
                    Custom placeholders for this template:{" "}
                    {customFieldTokenOptions.map((option, index) => (
                      <span key={option.key}>
                        <code>{option.token}</code>
                        {index < customFieldTokenOptions.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </>
                ) : null}
                <br />
                For background templates, use "Auto Place Fields" (recommended). Everything is editable: labels, values, text placeholders, reference number pattern, size, position, width/height, bold, and delete.
                <br />
                Rich text tip: use <code>**bold**</code>, <code>++underline++</code>, and <code>*italic*</code> inside body/template text.
              </>
            ) : (
              <>
                Clean mode is enabled. Click <strong>Show advanced controls</strong> when you need full inline settings. Use{" "}
                <strong>Open Full Editor</strong> for large, easy canvas editing with zoom.
              </>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Library</p>
              <h3>Template list</h3>
            </div>
            {templates.length ? (
              <div className="row-actions">
                <button className="button button-secondary" type="button" onClick={toggleSelectAllTemplates}>
                  {filteredTemplates.length && selectedFilteredTemplateIds.length === filteredTemplates.length ? "Clear all" : "Select all"}
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={handleBulkDeleteSelection}
                  disabled={!selectedFilteredTemplateIds.length}
                >
                  Delete selected ({selectedFilteredTemplateIds.length})
                </button>
              </div>
            ) : null}
          </div>

          {templates.length ? (
            <div className="template-library-toolbar">
              <div className="template-library-filters">
                <label>
                  Company
                  <select
                    value={templateListCompanyFilter}
                    onChange={(event) => {
                      setTemplateListCompanyFilter(event.target.value);
                      setTemplateListDepartmentFilter("ALL");
                    }}
                  >
                    <option value="ALL">All companies</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Department
                  <select value={templateListDepartmentFilter} onChange={(event) => setTemplateListDepartmentFilter(event.target.value)}>
                    <option value="ALL">All departments</option>
                    {templateListDepartmentOptions.map((department) => {
                      const company = companies.find((item) => item.id === department.companyId);
                      return (
                        <option key={department.id} value={department.id}>
                          {department.name}{templateListCompanyFilter === "ALL" && company?.name ? ` - ${company.name}` : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label>
                  Letter / AG
                  <select value={templateListTypeFilter} onChange={(event) => setTemplateListTypeFilter(event.target.value)}>
                    <option value="ALL">All types</option>
                    {ISSUE_LETTER_TYPE_OPTIONS.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <span className="template-library-count">
                Showing {filteredTemplates.length} of {templates.length}
              </span>
            </div>
          ) : null}

          {templates.length && filteredTemplates.length ? (
            <div className="card-list">
              {filteredTemplates.map((template) => {
                const company = companies.find((item) => item.id === template.companyId);
                const department = departments.find((item) => item.id === template.departmentId);
                const isSelected = selectedTemplateIds.includes(template.id);

                return (
                  <article className="entity-card" key={template.id}>
                    <div className="template-select-row">
                      <label className="template-select-checkbox">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleTemplateSelection(template.id)}
                        />
                        <span>Select</span>
                      </label>
                    </div>
                    <h4>{template.name}</h4>
                    <p>
                      {template.type} - {company?.name || ""} / {department?.name || ""}
                    </p>
                    <div className="entity-meta">
                      {template.defaultSubject ? <span className="chip">{template.defaultSubject}</span> : null}
                      {template.refCode ? <span className="chip chip--tone">Code: {template.refCode}</span> : null}
                      {template.letterNoPattern ? <span className="chip chip--tone">Ref: {template.letterNoPattern}</span> : null}
                      <span className="chip chip--tone">{RENDER_MODES.find((item) => item.value === template.design?.renderMode)?.label || "Structured Layout"}</span>
                      <span className="chip chip--tone">{DESIGN_LAYOUTS.find((item) => item.value === template.design?.layout)?.label || "Classic Letterhead"}</span>
                      <span className="chip chip--tone">{template.design?.canvas?.elements?.length || 0} elements</span>
                      <span className="chip chip--tone">{template.design?.customFields?.length || 0} custom fields</span>
                      {template.design?.backgroundImage?.dataUrl ? <span className="chip chip--tone">Background</span> : null}
                    </div>
                    <div className="row-actions">
                      <button className="button button-secondary" type="button" onClick={() => loadTemplateForEditing(template)}>
                        Edit
                      </button>
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => handleDuplicateTemplateById(template.id)}
                      >
                        Duplicate
                      </button>
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => handleDeleteTemplateById(template.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : templates.length ? (
            <EmptyState message="No templates found for this filter." />
          ) : (
            <EmptyState message="Templates will appear here after you create the first one." />
          )}
        </article>
      </div>

      {isFullscreenEditorOpen ? (
        <div className="editor-modal-backdrop editor-fullscreen-page">
          <div className="editor-modal" role="dialog" aria-modal="true">
            <div className="editor-modal__header">
              <div className="editor-modal__titleblock">
                <p className="eyebrow">Canvas Editor</p>
                <h3>Full Editor ({activePageSize}) - Page {activeEditorPageIndex + 1}</h3>
              </div>
              <div className="editor-modal__statusbar">
                <span className="editor-chip">{totalTemplatePages} page{totalTemplatePages === 1 ? "" : "s"}</span>
                <span className="editor-chip">{activePageSize}</span>
                <span className="editor-modal__hint">Ctrl + Wheel zooms. Double-click text to edit directly on the page.</span>
                <button className="button button-secondary" type="button" onClick={closeFullscreenEditor}>
                  Back to templates
                </button>
              </div>
            </div>

            <div className="editor-modal__toolbar">
              <div className="editor-toolbar-group">
                <span className="editor-toolbar-label">Quick edit</span>
                <button className="button button-secondary" type="button" onClick={addEditorPage}>
                  Add Page
                </button>
                <button className="button button-secondary" type="button" onClick={() => addCanvasElement("text")}>
                  Add Text
                </button>
                <button className="button button-secondary" type="button" onClick={handleUndoCanvas} disabled={!canUndoCanvas}>
                  Undo
                </button>
                <button className="button button-secondary" type="button" onClick={handleRedoCanvas} disabled={!canRedoCanvas}>
                  Redo
                </button>
                <button className="button button-secondary" type="button" onClick={copySelectedElement} disabled={!selectedElement}>
                  Copy
                </button>
                <button className="button button-secondary" type="button" onClick={duplicateSelectedElement} disabled={!selectedElement}>
                  Duplicate
                </button>
              </div>
              <div className="editor-toolbar-group editor-toolbar-group--zoom">
                <span className="editor-toolbar-label">Zoom</span>
                <button className="button button-secondary" type="button" onClick={() => applyEditorZoom(editorZoomPercent - 10)}>
                  -
                </button>
                <input
                  type="number"
                  min="25"
                  max="300"
                  value={editorZoomPercent}
                  onChange={(event) => applyEditorZoom(event.target.value)}
                  aria-label="Zoom percent"
                />
                <span>%</span>
                <button className="button button-secondary" type="button" onClick={() => applyEditorZoom(editorZoomPercent + 10)}>
                  +
                </button>
                <button className="button button-secondary" type="button" onClick={fitEditorToWidth}>
                  Fit Width
                </button>
                <button className="button button-secondary" type="button" onClick={fitEditorToHeight}>
                  Fit Height
                </button>
                <button className="button button-secondary" type="button" onClick={fitEditorToPage}>
                  Fit Page
                </button>
              </div>
            </div>

            <div className={`editor-modal__body editor-modal__body--studio ${isEditorInspectorOpen ? "has-inspector" : "is-inspector-closed"}`}>
              <aside className={`editor-modal__rail ${isEditorSidebarCollapsed ? "is-collapsed" : ""}`}>
                <button
                  className="editor-rail__toggle"
                  type="button"
                  onClick={() => setIsEditorSidebarCollapsed((current) => !current)}
                  aria-label={isEditorSidebarCollapsed ? "Open editor sidebar" : "Close editor sidebar"}
                >
                  {isEditorSidebarCollapsed ? ">" : "<"}
                </button>
                <div className="editor-rail__nav">
                  {[
                    { key: "pages", label: "Pages" },
                    { key: "insert", label: "Insert" },
                    { key: "layers", label: "Layers" },
                    { key: "document", label: "Document" },
                    { key: "selection", label: "Selection" },
                  ].map((section) => (
                    <button
                      key={section.key}
                      type="button"
                      className={`editor-rail__nav-btn ${activeEditorSidebarSection === section.key ? "is-active" : ""}`}
                      onClick={() => {
                        setActiveEditorSidebarSection(section.key);
                        setIsEditorSidebarCollapsed(false);
                        setIsEditorInspectorOpen(true);
                      }}
                    >
                      {isEditorSidebarCollapsed ? section.label.slice(0, 1) : section.label}
                    </button>
                  ))}
                </div>
              </aside>

              <div className="editor-modal__workspace">
                <div className="editor-modal__canvas-panel">
                <div className="fullscreen-canvas-viewport" ref={fullscreenViewportRef}>
                  <div
                    className="fullscreen-canvas-zoom-layer"
                    style={{
                      width: `${canvasWidth}px`,
                      height: `${canvasHeight * totalTemplatePages + Math.max(0, totalTemplatePages - 1) * 32}px`,
                      display: "grid",
                      gap: "32px",
                      transform: `scale(${editorZoomScale})`,
                      transformOrigin: "top center",
                    }}
                  >
                    {templatePageIndexes.map((pageIndex) => (
                      (() => {
                        const isActiveEditorPage = pageIndex === activeEditorPageIndex;
                        return (
                          <div
                            key={`editor-page-${pageIndex + 1}`}
                            className={`template-canvas template-canvas--fullscreen ${isActiveEditorPage ? "is-active-page" : ""}`}
                            onPointerDown={isActiveEditorPage ? () => {
                              clearCanvasSelection();
                              closeInlineEditor(true);
                              setAlignmentGuides({ vertical: null, horizontal: null });
                            } : undefined}
                            style={{
                              width: `${canvasWidth}px`,
                              height: `${canvasHeight}px`,
                              minHeight: `${canvasHeight}px`,
                            }}
                          >
                            <div className="template-canvas__page-badge">Page {pageIndex + 1}</div>
                            {form.design.backgroundImage.dataUrl ? (
                              <img
                                className="template-canvas__bg"
                                src={form.design.backgroundImage.dataUrl}
                                alt="Template background"
                                style={{
                                  objectFit: form.design.backgroundImage.fit,
                                  opacity: form.design.backgroundImage.opacity / 100,
                                }}
                              />
                            ) : null}
                            <div className="template-canvas__content-layer" ref={isActiveEditorPage ? fullscreenCanvasRef : undefined} style={canvasContentLayerStyle}>
                          {isActiveEditorPage && selectedElement && inlineToolbarStyle ? (
                            <div
                              className="canvas-inline-toolbar"
                              style={inlineToolbarStyle}
                              onPointerDown={(event) => event.stopPropagation()}
                              onMouseDown={(event) => event.preventDefault()}
                            >
                            <div className="canvas-inline-toolbar__group">
                              <button className="canvas-inline-toolbar__btn" type="button" onClick={() => changeSelectedElementSize(-1, 0)} title="Width -">
                                W-
                              </button>
                              <button className="canvas-inline-toolbar__btn" type="button" onClick={() => changeSelectedElementSize(1, 0)} title="Width +">
                                W+
                              </button>
                              <button className="canvas-inline-toolbar__btn" type="button" onClick={() => changeSelectedElementSize(0, -1)} title="Height -">
                                H-
                              </button>
                              <button className="canvas-inline-toolbar__btn" type="button" onClick={() => changeSelectedElementSize(0, 1)} title="Height +">
                                H+
                              </button>
                            </div>
                            {selectedElement.type === "text" || selectedElement.type === "field" ? (
                              <div className="canvas-inline-toolbar__group">
                                <button className="canvas-inline-toolbar__btn" type="button" onClick={() => changeSelectedFontSize(-1)} title="Font size -">
                                  A-
                                </button>
                                <button className="canvas-inline-toolbar__btn" type="button" onClick={() => changeSelectedFontSize(1)} title="Font size +">
                                  A+
                                </button>
                                <button
                                  className={`canvas-inline-toolbar__btn ${String(selectedElement.fontWeight) === "700" ? "is-active" : ""}`}
                                  type="button"
                                  onClick={handleBoldClick}
                                  title="Bold"
                                >
                                  B
                                </button>
                                <button
                                  className={`canvas-inline-toolbar__btn ${selectedElement.textDecoration === "underline" ? "is-active" : ""}`}
                                  type="button"
                                  onClick={handleUnderlineClick}
                                  title="Underline"
                                >
                                  U
                                </button>
                                <button
                                  className="canvas-inline-toolbar__btn"
                                  type="button"
                                  onClick={handleItalicClick}
                                  title="Italic"
                                >
                                  I
                                </button>
                                <button
                                  className={`canvas-inline-toolbar__btn ${selectedElement.align === "left" ? "is-active" : ""}`}
                                  type="button"
                                  onClick={() => setSelectedTextAlign("left")}
                                  title="Align left"
                                >
                                  L
                                </button>
                                <button
                                  className={`canvas-inline-toolbar__btn ${selectedElement.align === "center" ? "is-active" : ""}`}
                                  type="button"
                                  onClick={() => setSelectedTextAlign("center")}
                                  title="Align center"
                                >
                                  C
                                </button>
                                <button
                                  className={`canvas-inline-toolbar__btn ${selectedElement.align === "right" ? "is-active" : ""}`}
                                  type="button"
                                  onClick={() => setSelectedTextAlign("right")}
                                  title="Align right"
                                >
                                  R
                                </button>
                              </div>
                            ) : null}
                            <div className="canvas-inline-toolbar__group">
                              <button className="canvas-inline-toolbar__btn" type="button" onClick={duplicateSelectedElement} title="Duplicate element">
                                Dup
                              </button>
                              <button className="canvas-inline-toolbar__btn" type="button" onClick={removeSelectedElement} title="Delete element">
                                Del
                              </button>
                            </div>
                            </div>
                          ) : null}
                          {isActiveEditorPage && alignmentGuides.vertical != null ? (
                            <span className="canvas-alignment-guide canvas-alignment-guide--vertical" style={{ left: `${alignmentGuides.vertical}%` }} />
                          ) : null}
                          {isActiveEditorPage && alignmentGuides.horizontal != null ? (
                            <span className="canvas-alignment-guide canvas-alignment-guide--horizontal" style={{ top: `${alignmentGuides.horizontal}%` }} />
                          ) : null}
                          {allCanvasElements
                            .filter((element) => Number(element.pageIndex || 0) === pageIndex)
                            .map((element) => (
                            <div
                              key={`modal-page-${pageIndex + 1}-element-${element.id}`}
                            className={`canvas-element canvas-element--${element.type} ${selectedElementIdSet.has(element.id) ? "is-selected" : ""}`}
                            style={{
                              left: `${element.x}%`,
                              top: `${element.y}%`,
                              width: `${element.width}%`,
                              height: `${element.height}%`,
                              zIndex: element.zIndex,
                              color: element.color,
                              backgroundColor: element.type === "text" || element.type === "field" ? "transparent" : element.backgroundColor,
                              borderColor: element.borderColor,
                              borderWidth: `${element.borderWidth}px`,
                              fontSize: `${element.fontSize}px`,
                              fontFamily: element.fontFamily || "inherit",
                              fontWeight: element.fontWeight,
                              textDecoration: element.textDecoration || "none",
                              textAlign: element.align || "left",
                              lineHeight: Number(element.lineHeight ?? 1.35),
                              letterSpacing: `${Number(element.letterSpacing ?? 0)}px`,
                              opacity: element.opacity / 100,
                              padding:
                                element.type === "text" || element.type === "field"
                                  ? `${Number(element.paddingY ?? 4)}px ${Number(element.paddingX ?? 6)}px`
                                  : undefined,
                              cursor:
                                isActiveEditorPage && element.type === "text" && inlineTextEditElementId === element.id
                                  ? "text"
                                  : undefined,
                            }}
                            onPointerDown={isActiveEditorPage ? (event) => handleElementPointerDown(event, element, "drag") : undefined}
                            onPointerUp={isActiveEditorPage ? (event) => handleElementPointerUp(event, element) : undefined}
                          >
                            {element.type === "line" ? (
                              <span
                                className="canvas-line"
                                style={{
                                  backgroundColor: element.color,
                                  height: `${getLineStrokeWidth(element)}px`,
                                }}
                              />
                            ) : null}
                            {element.type === "text" ? (
                              isActiveEditorPage && inlineTextEditElementId === element.id ? (
                                <div
                                  ref={(node) => {
                                    setCanvasTextNodeRef(element.id, node);
                                    if (node && document.activeElement === node) {
                                      textEditorRef.current = node;
                                    }
                                  }}
                                  className="canvas-inline-text-editor"
                                  contentEditable
                                  suppressContentEditableWarning
                                  dangerouslySetInnerHTML={{ __html: markdownToEditableHtml(element.text || "") }}
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onFocus={(event) => {
                                    textEditorRef.current = event.currentTarget;
                                    rememberCanvasTextSelection(element.id);
                                  }}
                                  onInput={() => rememberCanvasTextSelection(element.id)}
                                  onKeyUp={() => rememberCanvasTextSelection(element.id)}
                                  onMouseUp={() => rememberCanvasTextSelection(element.id)}
                                  onClick={() => rememberCanvasTextSelection(element.id)}
                                  onBlur={() => commitInlineEditorValue(element.id, { close: true })}
                                  onKeyDown={(event) => {
                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      closeInlineEditor(true);
                                    }
                                  }}
                                />
                              ) : (
                                <span
                                  ref={(node) => setCanvasTextNodeRef(element.id, node)}
                                  className="canvas-element__text-content"
                                  onPointerUp={isActiveEditorPage ? (event) => {
                                    event.stopPropagation();
                                    rememberCanvasTextSelection(element.id);
                                  } : undefined}
                                  onMouseUp={isActiveEditorPage ? (event) => {
                                    event.stopPropagation();
                                    rememberCanvasTextSelection(element.id);
                                  } : undefined}
                                onDoubleClick={isActiveEditorPage ? (event) => {
                                  event.stopPropagation();
                                  setSelectedElementId(element.id);
                                  setSelectedElementIds([element.id]);
                                  openInlineEditorAtPoint(element.id, event.clientX, event.clientY);
                                } : undefined}
                              >
                                  {renderEditorMarkdownBlocks(element.text || "Text", `modal-${pageIndex}-${element.id}`)}
                                </span>
                              )
                            ) : null}
                            {element.type === "field" ? (
                              <span className="canvas-field-chip">
                                {(element.text || "Field").trim()}: {`{{${element.fieldKey || "recipient_name"}}}`}
                              </span>
                            ) : null}
                            {isActiveEditorPage && selectedElementId === element.id && element.type === "line" ? (
                              <>
                                <button
                                  type="button"
                                  className="canvas-line-handle canvas-line-handle--start"
                                  onPointerDown={(event) => handleElementPointerDown(event, element, "line-resize-start")}
                                  aria-label="Resize line from start"
                                />
                                <button
                                  type="button"
                                  className="canvas-line-handle canvas-line-handle--end"
                                  onPointerDown={(event) => handleElementPointerDown(event, element, "line-resize-end")}
                                  aria-label="Resize line from end"
                                />
                              </>
                            ) : isActiveEditorPage && selectedElementId === element.id ? (
                              <button
                                type="button"
                                className="canvas-resize-handle"
                                onPointerDown={(event) => handleElementPointerDown(event, element, "resize")}
                                aria-label="Resize element"
                              />
                            ) : null}
                          </div>
                          ))}
                            </div>
                          </div>
                        );
                      })()
                    ))}
                  </div>
                </div>
              </div>
              </div>

              {isEditorInspectorOpen ? (
              <aside className="editor-modal__inspector">
                <button
                  className="editor-inspector__close"
                  type="button"
                  onClick={() => setIsEditorInspectorOpen(false)}
                  aria-label="Close editor panel"
                >
                  X
                </button>
                {activeEditorSidebarSection === "pages" ? (
                  <section className="editor-pane editor-pane--active">
                    <div className="editor-pane__header">
                      <div>
                        <p className="eyebrow">Pages</p>
                        <h4>Manage Pages</h4>
                      </div>
                      <span className="editor-count-badge">{totalTemplatePages}</span>
                    </div>
                    <div className="editor-sidebar-fields">
                      <label>
                        Template
                        <input type="text" value={form.name || "Untitled template"} readOnly />
                      </label>
                      <label>
                        Current page
                        <select
                          value={activeEditorPageIndex}
                          onChange={(event) => {
                            setActiveEditorPageIndex(Number(event.target.value) || 0);
                            clearCanvasSelection();
                            closeInlineEditor(true);
                            setAlignmentGuides({ vertical: null, horizontal: null });
                          }}
                        >
                          {templatePageIndexes.map((pageIndex) => (
                            <option key={`sidebar-page-option-${pageIndex + 1}`} value={pageIndex}>
                              Page {pageIndex + 1}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="editor-page-actions">
                      <button className="button button-primary" type="button" onClick={addEditorPage}>
                        Add Page
                      </button>
                      <button className="button button-secondary" type="button" onClick={() => duplicateEditorPage(activeEditorPageIndex)}>
                        Duplicate Page
                      </button>
                    </div>
                    <div className="editor-page-list">
                      {templatePageIndexes.map((pageIndex) => {
                        const pageElementCount = allCanvasElements.filter((element) => Number(element.pageIndex || 0) === pageIndex).length;
                        const isActiveEditorPage = pageIndex === activeEditorPageIndex;

                        return (
                          <div className={`editor-page-card ${isActiveEditorPage ? "is-active" : ""}`} key={`sidebar-page-${pageIndex + 1}`}>
                            <button
                              className="editor-page-card__main"
                              type="button"
                              onClick={() => {
                                setActiveEditorPageIndex(pageIndex);
                                clearCanvasSelection();
                                closeInlineEditor(true);
                              }}
                            >
                              <span className="editor-page-card__thumb">
                                <span className="editor-page-card__paper" />
                              </span>
                              <span className="editor-page-card__meta">
                                <strong>Page {pageIndex + 1}</strong>
                                <small>{pageElementCount} element{pageElementCount === 1 ? "" : "s"}</small>
                              </span>
                            </button>
                            <button
                              className="editor-page-card__delete"
                              type="button"
                              onClick={() => deleteEditorPage(pageIndex)}
                              disabled={totalTemplatePages <= 1}
                              title={totalTemplatePages <= 1 ? "At least one page is required" : `Delete page ${pageIndex + 1}`}
                              aria-label={`Delete page ${pageIndex + 1}`}
                            >
                              Bin
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <p className="editor-pane__note">Add blank pages like Canva. Each page keeps its own elements and can be deleted with the bin button.</p>
                  </section>
                ) : null}

                {activeEditorSidebarSection === "insert" ? (
                  <section className="editor-pane editor-pane--active">
                    <div className="editor-pane__header">
                      <div>
                        <p className="eyebrow">Insert</p>
                        <h4>Add Content</h4>
                      </div>
                    </div>
                    <div className="editor-insert-grid">
                      {ELEMENT_TYPES.map((type) => (
                        <button
                          key={`insert-panel-${type.value}`}
                          className="button button-secondary"
                          type="button"
                          onClick={() => addCanvasElement(type.value)}
                        >
                          Add {type.label}
                        </button>
                      ))}
                      <button className="button button-secondary" type="button" onClick={applyBackgroundTextPreset}>
                        Auto Place Fields
                      </button>
                    </div>
                    <div className="placeholder-picker">
                      <p className="placeholder-picker__label">Dynamic values for selected text</p>
                      <div className="placeholder-picker__grid" onMouseDown={keepInlineEditorFocused}>
                        {canvasFieldOptions.map((option) => (
                          <button
                            key={`insert-token-${option.key}`}
                            className="button button-secondary"
                            type="button"
                            onClick={() => appendTokenToSelectedText(option.token)}
                          >
                            {option.token}
                          </button>
                        ))}
                        <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("\n")}>New Line</button>
                        <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("  ")}>Double Space</button>
                        <button className="button button-secondary" type="button" onClick={removeSelectedTextLine}>Remove Last Line</button>
                      </div>
                    </div>
                    <p className="editor-pane__note">Select a text element first, then click a token to insert it into that text.</p>
                  </section>
                ) : null}

                {activeEditorSidebarSection === "layers" ? (
                  <section className="editor-pane editor-pane--active">
                    <div className="editor-pane__header">
                      <div>
                        <p className="eyebrow">Layers</p>
                        <h4>Page {activeEditorPageIndex + 1} Layers</h4>
                      </div>
                      <span className="editor-count-badge">{canvasElements.length}</span>
                    </div>
                    {canvasElements.length ? (
                      <div className="canvas-elements-list__grid">
                        {canvasElements.map((element, index) => (
                          <button
                            key={`layer-${element.id}`}
                            className={`canvas-elements-list__item ${selectedElementId === element.id ? "is-active" : ""}`}
                            type="button"
                            onClick={() => {
                              setSelectedElementId(element.id);
                              setSelectedElementIds([element.id]);
                            }}
                          >
                            {getElementLabel(element, index)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="canvas-properties__empty">This page has no elements yet. Use Insert to add text, fields, boxes, or lines.</p>
                    )}
                    <div className="editor-page-actions">
                      <button className="button button-secondary" type="button" onClick={() => moveLayer("up")} disabled={!selectedElement}>
                        Bring Front
                      </button>
                      <button className="button button-secondary" type="button" onClick={() => moveLayer("down")} disabled={!selectedElement}>
                        Send Back
                      </button>
                      <button className="button button-secondary" type="button" onClick={removeSelectedElement} disabled={!selectedElement}>
                        Delete Layer
                      </button>
                    </div>
                  </section>
                ) : null}

                {activeEditorSidebarSection === "document" ? (
                <section className="editor-pane editor-pane--active">
                  <div className="editor-pane__header">
                    <div>
                      <p className="eyebrow">Document</p>
                      <h4>Page Settings</h4>
                    </div>
                  </div>
                  <div className="canvas-properties__form canvas-properties__form--compact">
                    <label className="span-2">
                      Page size
                      <select value={activePageSize} onChange={(event) => updateDesign("pageSize", event.target.value)}>
                        <option value="A4">Letter = A4 - 210 x 297 mm - Standard office documents, letters</option>
                        <option value="LEGAL">AG = Legal - 8.5 x 14 inches (216 x 356 mm) - Agreements, contracts, legal documents</option>
                      </select>
                    </label>
                    <label>
                      Total pages
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={totalTemplatePages}
                        onChange={(event) => {
                          const nextTotal = clamp(Number(event.target.value), 1, 50);
                          if (nextTotal > totalTemplatePages) {
                            updateDesign("additionalPages", nextTotal);
                            return;
                          }
                          if (nextTotal < totalTemplatePages) {
                            deleteEditorPage(totalTemplatePages - 1);
                          }
                        }}
                      />
                    </label>
                    <label>
                      Page padding X (%)
                      <input
                        type="number"
                        min="0"
                        max="25"
                        step="0.5"
                        value={canvasPaddingXPercent}
                        onChange={(event) => updateDesign("pagePaddingX", clamp(Number(event.target.value), 0, 25))}
                      />
                    </label>
                    <label>
                      Page padding Y (%)
                      <input
                        type="number"
                        min="0"
                        max="25"
                        step="0.5"
                        value={canvasPaddingYPercent}
                        onChange={(event) => updateDesign("pagePaddingY", clamp(Number(event.target.value), 0, 25))}
                      />
                    </label>
                    <label>
                      Background fit
                      <select value={form.design.backgroundImage.fit} onChange={(event) => updateBackground("fit", event.target.value)}>
                        <option value="cover">Cover</option>
                        <option value="contain">Contain</option>
                        <option value="fill">Fill</option>
                      </select>
                    </label>
                    <label className="span-2">
                      Background opacity
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={form.design.backgroundImage.opacity}
                        onChange={(event) => updateBackground("opacity", clamp(Number(event.target.value), 0, 100))}
                      />
                    </label>
                  </div>
                </section>
                ) : null}

                {activeEditorSidebarSection === "selection" ? (
                <section className="editor-pane editor-pane--active">
                  <div className="editor-pane__header">
                    <div>
                      <p className="eyebrow">Selection</p>
                      <h4>{selectedElement ? "Element Properties" : "Nothing Selected"}</h4>
                    </div>
                  </div>
                {selectedElement ? (
                  <div className="canvas-properties__form">
                    <label>
                      X (%)
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={selectedElement.x.toFixed(1)}
                        onChange={(event) => updateSelectedElement({ x: clamp(Number(event.target.value), 0, 100 - selectedElement.width) })}
                      />
                    </label>
                    <label>
                      Y (%)
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={selectedElement.y.toFixed(1)}
                        onChange={(event) => updateSelectedElement({ y: clamp(Number(event.target.value), 0, 100 - selectedElement.height) })}
                      />
                    </label>
                    <label>
                      Width (%)
                      <input
                        type="number"
                        min="1"
                        max="100"
                        step="0.1"
                        value={selectedElement.width.toFixed(1)}
                        onChange={(event) => updateSelectedElement({ width: clamp(Number(event.target.value), 1, 100 - selectedElement.x) })}
                      />
                    </label>
                    <label>
                      Height (%)
                      <input
                        type="number"
                        min="0.8"
                        max="100"
                        step="0.1"
                        value={selectedElement.height.toFixed(1)}
                        onChange={(event) => updateSelectedElement({ height: clamp(Number(event.target.value), 0.8, 100 - selectedElement.y) })}
                      />
                    </label>
                    <label>
                      Padding X (px)
                      <input
                        type="number"
                        min="0"
                        max="60"
                        step="1"
                        value={Number(selectedElement.paddingX ?? 6)}
                        onChange={(event) => updateSelectedElement({ paddingX: clamp(Number(event.target.value), 0, 60) })}
                        disabled={selectedElement.type === "line" || selectedElement.type === "rect"}
                      />
                    </label>
                    <label>
                      Padding Y (px)
                      <input
                        type="number"
                        min="0"
                        max="60"
                        step="1"
                        value={Number(selectedElement.paddingY ?? 4)}
                        onChange={(event) => updateSelectedElement({ paddingY: clamp(Number(event.target.value), 0, 60) })}
                        disabled={selectedElement.type === "line" || selectedElement.type === "rect"}
                      />
                    </label>

                    <div className="alignment-tools span-2">
                      <p>Align on page</p>
                      <div className="alignment-tools__grid">
                        <button className="button button-secondary" type="button" onClick={() => alignSelectedElement("left")}>
                          Left
                        </button>
                        <button className="button button-secondary" type="button" onClick={() => alignSelectedElement("center")}>
                          Center
                        </button>
                        <button className="button button-secondary" type="button" onClick={() => alignSelectedElement("right")}>
                          Right
                        </button>
                        <button className="button button-secondary" type="button" onClick={() => alignSelectedElement("top")}>
                          Top
                        </button>
                        <button className="button button-secondary" type="button" onClick={() => alignSelectedElement("middle")}>
                          Middle
                        </button>
                        <button className="button button-secondary" type="button" onClick={() => alignSelectedElement("bottom")}>
                          Bottom
                        </button>
                      </div>
                    </div>

                    {selectedElement.type === "text" ? (
                      <div className="span-2">
                        <label>
                          Text
                          <textarea
                            rows={4}
                            value={selectedElement.text}
                            onChange={(event) => updateSelectedElement({ text: event.target.value })}
                            onFocus={rememberTextSelection}
                            onSelect={rememberTextSelection}
                            onKeyUp={rememberTextSelection}
                            onClick={rememberTextSelection}
                            placeholder="Example: Name: {{recipient_name}}"
                          />
                        </label>
                        <div className="placeholder-picker">
                          <p className="placeholder-picker__label">Insert dynamic value in selected text</p>
                          <div className="text-selection-tools" onMouseDown={keepInlineEditorFocused}>
                            <button
                              className="button button-secondary"
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={handleBoldClick}
                            >
                              Bold selected
                            </button>
                            <button
                              className="button button-secondary"
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={handleUnderlineClick}
                            >
                              Underline selected
                            </button>
                            <button
                              className="button button-secondary"
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={handleItalicClick}
                            >
                              Italic selected
                            </button>
                            <span>Select text on canvas or in textbox, then apply style.</span>
                          </div>
                          <div className="placeholder-picker__grid" onMouseDown={keepInlineEditorFocused}>
                            <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{recipient_name}}")}>{"{{recipient_name}}"}</button>
                            <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{recipient_company}}")}>{"{{recipient_company}}"}</button>
                            <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{recipient_department}}")}>{"{{recipient_department}}"}</button>
                            <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{subject}}")}>{"{{subject}}"}</button>
                            <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{issue_date}}")}>{"{{issue_date}}"}</button>
                            <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{company_code}}")}>{"{{company_code}}"}</button>
                            <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{department_code}}")}>{"{{department_code}}"}</button>
                            <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{template_code}}")}>{"{{template_code}}"}</button>
                            <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{letter_no}}")}>{"{{letter_no}}"}</button>
                            <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{body_text}}")}>{"{{body_text}}"}</button>
                            <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{custom_fields_block}}")}>{"{{custom_fields_block}}"}</button>
                            <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{employee_emp_id}}")}>{"{{employee_emp_id}}"}</button>
                            <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{employee_name}}")}>{"{{employee_name}}"}</button>
                            <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{employee_cnic}}")}>{"{{employee_cnic}}"}</button>
                            <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{employee_designation}}")}>{"{{employee_designation}}"}</button>
                            <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{employee_department}}")}>{"{{employee_department}}"}</button>
                            <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{employee_address}}")}>{"{{employee_address}}"}</button>
                            <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{employee_joining_date}}")}>{"{{employee_joining_date}}"}</button>
                            <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("{{joining_date}}")}>{"{{joining_date}}"}</button>
                            {customFieldTokenOptions.map((option) => (
                              <button
                                key={option.key}
                                className="button button-secondary"
                                type="button"
                                onClick={() => appendTokenToSelectedText(option.token)}
                              >
                                {option.token}
                              </button>
                            ))}
                            <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("\n")}>New Line</button>
                            <button className="button button-secondary" type="button" onClick={() => appendTokenToSelectedText("  ")}>Double Space</button>
                            <button className="button button-secondary" type="button" onClick={removeSelectedTextLine}>Remove Last Line</button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {selectedElement.type === "field" ? (
                      <div className="span-2">
                        <label>
                          Field label text
                          <input
                            type="text"
                            value={selectedElement.text || ""}
                            onChange={(event) => updateSelectedElement({ text: event.target.value })}
                            placeholder="Example: Name"
                          />
                        </label>
                        <label>
                          Field value source
                          <select
                            value={selectedElement.fieldKey || "recipient_name"}
                            onChange={(event) => updateSelectedElement({ fieldKey: event.target.value })}
                          >
                            {canvasFieldOptions.map((option) => (
                              <option key={option.key} value={option.key}>
                                {option.label} ({option.token})
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    ) : null}

                    <label>
                      Text / Line color
                      <input type="color" value={selectedElement.color} onChange={(event) => updateSelectedElement({ color: event.target.value })} />
                    </label>
                    <label>
                      Background
                      <input
                        type="color"
                        value={selectedElement.backgroundColor === "transparent" ? "#ffffff" : selectedElement.backgroundColor}
                        onChange={(event) => updateSelectedElement({ backgroundColor: event.target.value })}
                        disabled={selectedElement.type === "text" || selectedElement.type === "field" || selectedElement.type === "line"}
                      />
                    </label>
                    <label>
                      Border color
                      <input type="color" value={selectedElement.borderColor} onChange={(event) => updateSelectedElement({ borderColor: event.target.value })} />
                    </label>
                    <label>
                      Border width
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={selectedElement.borderWidth}
                        onChange={(event) => updateSelectedElement({ borderWidth: clamp(Number(event.target.value), 0, 10) })}
                      />
                    </label>
                    <label>
                      Opacity (%)
                      <input
                        type="number"
                        min="10"
                        max="100"
                        value={selectedElement.opacity}
                        onChange={(event) => updateSelectedElement({ opacity: clamp(Number(event.target.value), 10, 100) })}
                      />
                    </label>
                    <label>
                      Alignment
                      <select
                        value={selectedElement.align || "left"}
                        onChange={(event) => updateSelectedElement({ align: event.target.value })}
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                        <option value="justify">Justify</option>
                      </select>
                    </label>

                    {selectedElement.type === "text" || selectedElement.type === "field" ? (
                      <>
                          <label>
                            Font size
                            <input
                              type="number"
                              min="8"
                              max="72"
                              value={selectedElement.fontSize}
                              onChange={(event) => updateSelectedElement({ fontSize: clamp(Number(event.target.value), 8, 72) })}
                            />
                          </label>
                          <label>
                            Line spacing
                            <input
                              type="number"
                              min="0.8"
                              max="3"
                              step="0.05"
                              value={Number(selectedElement.lineHeight ?? 1.35)}
                              onChange={(event) => updateSelectedElement({ lineHeight: clamp(Number(event.target.value), 0.8, 3) })}
                            />
                          </label>
                          <label>
                            Letter spacing (px)
                            <input
                              type="number"
                              min="-2"
                              max="20"
                              step="0.1"
                              value={Number(selectedElement.letterSpacing ?? 0)}
                              onChange={(event) => updateSelectedElement({ letterSpacing: clamp(Number(event.target.value), -2, 20) })}
                            />
                          </label>
                          <label>
                            Font family
                            <select
                              value={selectedElement.fontFamily || "inherit"}
                              onChange={(event) => updateSelectedElement({ fontFamily: event.target.value })}
                          >
                            {FONT_FAMILY_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Font weight
                          <select
                            value={selectedElement.fontWeight}
                            onChange={(event) => updateSelectedElement({ fontWeight: event.target.value })}
                          >
                            <option value="400">Regular</option>
                            <option value="700">Bold</option>
                          </select>
                        </label>
                        <label>
                          Text decoration
                          <select
                            value={selectedElement.textDecoration || "none"}
                            onChange={(event) => updateSelectedElement({ textDecoration: event.target.value })}
                          >
                            <option value="none">None</option>
                            <option value="underline">Underline</option>
                          </select>
                        </label>
                      </>
                    ) : null}

                    <div className="canvas-element-actions span-2">
                      <button className="button button-secondary" type="button" onClick={copySelectedElement}>
                        Copy Element
                      </button>
                      <button className="button button-secondary" type="button" onClick={duplicateSelectedElement}>
                        Duplicate Element
                      </button>
                      <button className="button button-secondary" type="button" onClick={pasteCopiedElement} disabled={!copiedCanvasElement}>
                        Paste Element
                      </button>
                    </div>

                    <button className="button button-secondary span-2" type="button" onClick={removeSelectedElement}>
                      Delete Element
                    </button>
                  </div>
                ) : (
                  <p className="canvas-properties__empty">Select an element on canvas to edit position, text, and style.</p>
                )}
                </section>
                ) : null}
              </aside>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}










