import { Fragment, useEffect, useRef, useState } from "react";
import EmptyState from "./EmptyState";
import {
  buildLetterValueMap,
  fillPlaceholders,
  formatDate,
  normalizeTemplateDesign,
} from "../utils/lettering";

const A4_BASE_WIDTH_PX = 794;
const A4_BASE_HEIGHT_PX = 1123;
const LEGAL_BASE_WIDTH_PX = 816;
const LEGAL_BASE_HEIGHT_PX = 1344;

function getLineStrokeWidth(element) {
  const explicitWidth = Number(element?.borderWidth);
  if (Number.isFinite(explicitWidth) && explicitWidth > 0) {
    return explicitWidth;
  }

  const fromHeight = Number(element?.height);
  if (Number.isFinite(fromHeight) && fromHeight > 0) {
    return Math.max(1, Math.min(24, Math.round(fromHeight)));
  }

  return 2;
}

function renderInlineMarkdown(text, keyPrefix, depth = 0) {
  const source = String(text ?? "");
  if (!source) {
    return "";
  }

  const tokenPattern = /(\+\+[^+\n]+?\+\+|\*\*[^*\n]+?\*\*|__[^_\n]+?__|\*[^*\n]+?\*|_[^_\n]+?_)/g;
  const nodes = [];
  let lastIndex = 0;
  let partIndex = 0;

  source.replace(tokenPattern, (match, _group, offset) => {
    if (offset > lastIndex) {
      nodes.push(source.slice(lastIndex, offset));
    }

    const isUnderline = match.startsWith("++") && match.endsWith("++");
    const isBold = (match.startsWith("**") && match.endsWith("**")) || (match.startsWith("__") && match.endsWith("__"));
    const content = isBold || isUnderline ? match.slice(2, -2) : match.slice(1, -1);

    if (content) {
      const renderedContent =
        depth >= 5
          ? content
          : renderInlineMarkdown(content, `${keyPrefix}-n-${partIndex}`, depth + 1);

      if (isBold) {
        nodes.push(
          <strong key={`${keyPrefix}-b-${partIndex}`}>
            {renderedContent}
          </strong>,
        );
      } else if (isUnderline) {
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

function renderMarkdownBlocks(text, keyPrefix) {
  const lines = String(text ?? "").split("\n");
  return lines.map((line, index) => (
    <Fragment key={`${keyPrefix}-line-${index}`}>
      {renderInlineMarkdown(line, `${keyPrefix}-${index}`)}
      {index < lines.length - 1 ? <br /> : null}
    </Fragment>
  ));
}

function renderCanvasElement(element, valueMap) {
  const style = {
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: `${element.width}%`,
    height: `${element.height}%`,
    zIndex: element.zIndex,
    color: element.color,
    borderColor: element.borderColor,
    borderWidth: `${element.borderWidth}px`,
    backgroundColor: element.type === "text" || element.type === "field" ? "transparent" : element.backgroundColor,
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
  };

  if (element.type === "line") {
    return (
      <div key={element.id} className="preview-canvas-element preview-canvas-element--line" style={style}>
        <span
          style={{
            backgroundColor: element.color,
            height: `${getLineStrokeWidth(element)}px`,
          }}
        />
      </div>
    );
  }

  if (element.type === "rect") {
    return <div key={element.id} className="preview-canvas-element preview-canvas-element--rect" style={style} />;
  }

  let rawText = element.text;

  if (element.type === "field") {
    const fieldKey = String(element.fieldKey || "").trim();
    const fieldValue = fieldKey ? fillPlaceholders(`{{${fieldKey}}}`, valueMap) : "";
    const labelText = String(element.text || "").trim();

    if (!labelText) {
      rawText = fieldValue;
    } else if (labelText.includes("{{value}}")) {
      rawText = labelText.replace(/\{\{\s*value\s*\}\}/g, fieldValue);
    } else if (!fieldValue) {
      rawText = labelText;
    } else {
      const separator = /[:\-]$/.test(labelText) ? " " : ": ";
      rawText = `${labelText}${separator}${fieldValue}`;
    }
  }

  const text = fillPlaceholders(rawText, valueMap);

  return (
    <div key={element.id} className="preview-canvas-element preview-canvas-element--text" style={style}>
      {renderMarkdownBlocks(text, `canvas-${element.id}`)}
    </div>
  );
}

function hasBodyTextBinding(elements) {
  return elements.some((element) => {
    if (element.type === "field") {
      return element.fieldKey === "body_text" || element.fieldKey === "body_notes";
    }

    if (element.type !== "text") {
      return false;
    }

    const text = String(element.text || "");
    if (text.includes("{{body_text}}") || text.includes("{{body_notes}}")) {
      return true;
    }

    const lineCount = text.split("\n").filter((line) => String(line).trim().length > 0).length;
    if (text.trim().length >= 140 || lineCount >= 4) {
      return true;
    }

    return false;
  });
}

function createAutoBackgroundOverlayElements() {
  const preset = [
    {
      id: "auto-meta",
      type: "text",
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
      id: "auto-to",
      type: "text",
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
      id: "auto-company",
      type: "text",
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
      id: "auto-body",
      type: "text",
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
      id: "auto-prepared",
      type: "text",
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
      id: "auto-approved",
      type: "text",
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

  return preset.map((item, index) => ({
    ...item,
    zIndex: index,
    color: "#1e2321",
    borderColor: "transparent",
    borderWidth: 0,
    backgroundColor: "transparent",
    textDecoration: "none",
    opacity: 100,
    paddingX: 6,
    paddingY: 4,
    lineHeight: 1.35,
    letterSpacing: 0,
  }));
}
export default function LetterPreview({ preview }) {
  const stageRef = useRef(null);
  const [sheetScale, setSheetScale] = useState(1);
  const previewDesign = preview ? normalizeTemplateDesign(preview.template.design) : null;
  const isLegalPage = String(previewDesign?.pageSize || "A4").toUpperCase() === "LEGAL";
  const pageBaseWidth = isLegalPage ? LEGAL_BASE_WIDTH_PX : A4_BASE_WIDTH_PX;
  const pageBaseHeight = isLegalPage ? LEGAL_BASE_HEIGHT_PX : A4_BASE_HEIGHT_PX;

  useEffect(() => {
    const node = stageRef.current;
    if (!node) {
      return undefined;
    }

    const updateScale = () => {
      const availableWidth = Math.max(120, Number(node.clientWidth || 0));
      const nextScale = Math.min(1, availableWidth / pageBaseWidth);
      setSheetScale(Number.isFinite(nextScale) ? nextScale : 1);
    };

    updateScale();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateScale);
      return () => window.removeEventListener("resize", updateScale);
    }

    const observer = new ResizeObserver(() => updateScale());
    observer.observe(node);
    return () => observer.disconnect();
  }, [pageBaseWidth]);

  if (!preview) {
    return <EmptyState title="Preview unavailable" message="Select a company, department, and template to build the letter." />;
  }

  const { company, department, template, values } = preview;
  const design = previewDesign;
  const totalPages = Math.max(1, Number(design.additionalPages || 1));
  const pageIndexes = Array.from({ length: totalPages }, (_, index) => index);
  const sourceCanvasElements = [...design.canvas.elements].sort((left, right) => left.zIndex - right.zIndex);
  const valueMap = buildLetterValueMap({ company, department, template, values });
  const isBackgroundMode = design.renderMode === "background" || Boolean(design.backgroundImage.dataUrl);
  const canvasElements = isBackgroundMode && !sourceCanvasElements.length ? createAutoBackgroundOverlayElements() : sourceCanvasElements;
  const hasBodyBinding = hasBodyTextBinding(canvasElements);

  const body = valueMap.body_text;
  const paragraphs = body
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  const companyInitials = company.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();

  const contactLine = [company.phone, company.email].filter(Boolean).join(" / ");
  const titleText = design.titleText || values.subject || template.defaultSubject || template.name;
  const pagePaddingXPercent = Math.max(0, Math.min(25, Number(design.pagePaddingX || 0)));
  const pagePaddingYPercent = Math.max(0, Math.min(25, Number(design.pagePaddingY || 0)));
  const contentLayerStyle = {
    left: `${pagePaddingXPercent}%`,
    top: `${pagePaddingYPercent}%`,
    width: `${Math.max(5, 100 - pagePaddingXPercent * 2)}%`,
    height: `${Math.max(5, 100 - pagePaddingYPercent * 2)}%`,
  };
  const linedFields = [
    { label: "Employee", value: values.recipientName || "________________" },
    { label: "Company", value: values.recipientCompany || company.name },
    { label: "Department", value: values.recipientDepartment || department.name },
  ];

  return (
    <div
      ref={stageRef}
      className="letter-sheet-stage"
      style={{
        "--preview-page-width-print": isLegalPage ? "216mm" : "210mm",
        "--preview-page-height-print": isLegalPage ? "356mm" : "297mm",
        height: `${Math.round((pageBaseHeight * totalPages + Math.max(0, totalPages - 1) * 24) * sheetScale)}px`,
        maxWidth: `${pageBaseWidth}px`,
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 24,
          width: `${pageBaseWidth}px`,
          transform: `scale(${sheetScale})`,
          transformOrigin: "top left",
        }}
      >
        {pageIndexes.map((pageIndex) => (
          <div
            key={`preview-page-${pageIndex + 1}`}
            className={`letter-sheet letter-sheet--${design.layout} ${isBackgroundMode ? "letter-sheet--background-mode" : ""}`}
            style={{
              "--template-accent": design.accentColor,
              "--template-secondary": design.secondaryColor,
              width: `${pageBaseWidth}px`,
              minWidth: `${pageBaseWidth}px`,
              minHeight: `${pageBaseHeight}px`,
              aspectRatio: `${pageBaseWidth} / ${pageBaseHeight}`,
            }}
          >
            {design.backgroundImage.dataUrl ? (
              <img
                className="letter-background"
                src={design.backgroundImage.dataUrl}
                alt="Letterhead background"
                style={{
                  objectFit: design.backgroundImage.fit,
                  opacity: design.backgroundImage.opacity / 100,
                }}
              />
            ) : null}

            <div className="preview-canvas-layer" aria-hidden="true">
              <div className="preview-canvas-content-layer" style={contentLayerStyle}>
                {canvasElements
                  .filter((element) => Number(element.pageIndex || 0) === pageIndex)
                  .map((element) => renderCanvasElement(element, valueMap))}
                {isBackgroundMode && !hasBodyBinding ? (
                  <div
                    className="preview-canvas-element preview-canvas-element--text preview-canvas-element--body-fallback"
                    style={{
                      left: "8%",
                      top: "45%",
                      width: "84%",
                      height: "32%",
                      zIndex: 999,
                      color: "#1e2321",
                      borderColor: "transparent",
                      borderWidth: "0px",
                      fontSize: "12px",
                      fontWeight: "400",
                      textAlign: "left",
                      opacity: 1,
                      backgroundColor: "transparent",
                    }}
                  >
                    {renderMarkdownBlocks(valueMap.body_text || "Template body will appear here.", `body-fallback-${pageIndex}`)}
                  </div>
                ) : null}
              </div>
            </div>

            {isBackgroundMode ? null : (
              <>
          {design.showDecorativeHeader ? <div className="letter-decor" aria-hidden="true" /> : null}
          {design.showDecorativeHeader && design.layout !== "classic" ? <div className="letter-decor letter-decor--secondary" aria-hidden="true" /> : null}

          <header className={`letter-header ${design.layout !== "classic" ? "letter-header--styled" : ""}`}>
            <div className="letter-brand">
              <div className="brand-mark">{companyInitials || "LT"}</div>
              <div>
                <h4>{company.name}</h4>
                <div>{company.address}</div>
                {design.layout === "classic" && design.showContactLine && contactLine ? <div>{contactLine}</div> : null}
              </div>
            </div>
            <div className="letter-meta">
              <div>
                <strong>Letter No:</strong> {values.letterNo}
              </div>
              <div>
                <strong>Date:</strong> {formatDate(values.issueDate)}
              </div>
              <div>
                <strong>Dept:</strong> {department.name}
              </div>
              <div>
                <strong>Type:</strong> {template.type || template.name}
              </div>
            </div>
          </header>

          {design.showContactLine && contactLine && design.layout !== "classic" ? (
            <div className="letter-contact-line">{contactLine}</div>
          ) : null}

          <section className={`letter-title-block letter-title-block--${design.layout}`}>
            <span>{titleText}</span>
          </section>

          {design.layout === "declaration" ? (
            <section className="letter-form-block">
              {linedFields.map((field) => (
                <div className="letter-field-row" key={field.label}>
                  <span>{field.label}</span>
                  <strong>{field.value}</strong>
                </div>
              ))}
            </section>
          ) : (
            <section className="letter-recipient">
              <div>
                <strong>To:</strong> {values.recipientName || "Recipient name"}
              </div>
              {values.recipientCompany ? (
                <div>
                  <strong>Company:</strong> {values.recipientCompany}
                </div>
              ) : null}
              {values.recipientDepartment ? (
                <div>
                  <strong>Department:</strong> {values.recipientDepartment}
                </div>
              ) : null}
            </section>
          )}

          <section className={`letter-body letter-body--${design.layout}`}>
            {paragraphs.length
              ? paragraphs.map((paragraph, index) => (
                <p key={`${index}-${paragraph.slice(0, 20)}`}>
                  {renderMarkdownBlocks(paragraph, `body-${index}`)}
                </p>
              ))
              : <p>Template body will appear here.</p>}
          </section>

          {design.showSignatureLine ? (
            <section className="letter-signatures">
              <div className="signature-box">
                <strong>Prepared By</strong>
                <div>{values.preparedBy}</div>
              </div>
              <div className="signature-box">
                <strong>Approved By</strong>
                <div>{values.approvedBy}</div>
              </div>
            </section>
          ) : null}

          <footer className="letter-footer">
            {company.footerText ? <p>{company.footerText}</p> : null}
            {values.remarks ? (
              <p>
                <strong>Remarks:</strong> {values.remarks}
              </p>
            ) : null}
          </footer>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
