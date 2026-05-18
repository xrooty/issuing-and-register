import { useEffect, useMemo, useState } from "react";
import EmptyState from "../components/EmptyState";
import PaginationControls from "../components/PaginationControls";
import { formatDate } from "../utils/lettering";

export default function RegisterView({
  rows,
  companies,
  departments,
  filters,
  onFilterChange,
  onEditLetter,
  onPrintLetter,
  onDeleteLetter,
  onBulkDeleteLetters,
}) {
  const [selectedLetterIds, setSelectedLetterIds] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const rowSet = new Set(rows.map((row) => row.id));
    setSelectedLetterIds((current) => current.filter((id) => rowSet.has(id)));
  }, [rows]);

  const filteredDepartments = departments.filter(
    (department) => !filters.companyId || department.companyId === filters.companyId,
  );

  const visibleRows = rows.filter((row) => {
    if (filters.companyId && row.companyId !== filters.companyId) {
      return false;
    }

    if (filters.departmentId && row.departmentId !== filters.departmentId) {
      return false;
    }

    if (!filters.search.trim()) {
      return true;
    }

    const needle = filters.search.trim().toLowerCase();
    const customValues = Object.values(row.registerCustomFieldValueMap || {});
    const haystack = [
      row.letterNo,
      row.subject,
      row.recipientName,
      row.recipientCompany,
      row.preparedBy,
      row.templateName,
      row.templateTypeName,
      ...customValues,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(needle);
  });

  const visibleRowIdSet = new Set(visibleRows.map((row) => row.id));
  const visibleSelectedCount = selectedLetterIds.filter((id) => visibleRowIdSet.has(id)).length;
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = visibleRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const groupedRows = useMemo(() => {
    const groups = new Map();

    visibleRows.forEach((row) => {
      const groupKey = String(row.registerTypeKey || "template");
      const existing = groups.get(groupKey) || {
        key: groupKey,
        typeName: String(row.templateTypeName || "Template"),
        numberLabels: new Set(),
        rows: [],
        customFieldMap: new Map(),
      };

      existing.rows.push(row);
      existing.numberLabels.add(String(row.registerNumberLabel || "Reference No"));

      (row.registerCustomFields || []).forEach((field) => {
        const fieldKey = String(field?.key || "").trim();
        if (!fieldKey) {
          return;
        }

        const current = existing.customFieldMap.get(fieldKey);
        if (!current) {
          existing.customFieldMap.set(fieldKey, {
            key: fieldKey,
            label: String(field?.label || fieldKey),
            required: Boolean(field?.required),
            sortIndex: existing.customFieldMap.size,
          });
          return;
        }

        if (field?.required && !current.required) {
          current.required = true;
        }
      });

      groups.set(groupKey, existing);
    });

    return Array.from(groups.values()).map((group) => {
      const customColumns = Array.from(group.customFieldMap.values()).sort((left, right) => {
        if (left.required !== right.required) {
          return left.required ? -1 : 1;
        }
        return left.sortIndex - right.sortIndex;
      });

      const numberLabels = Array.from(group.numberLabels.values());
      return {
        ...group,
        numberLabel: numberLabels.length === 1 ? numberLabels[0] : "Reference No",
        customColumns,
      };
    });
  }, [visibleRows]);

  function toggleLetterSelection(letterId) {
    setSelectedLetterIds((current) =>
      current.includes(letterId) ? current.filter((id) => id !== letterId) : [...current, letterId],
    );
  }

  function toggleSelectAllVisible() {
    if (!visibleRows.length) {
      return;
    }

    const allVisibleIds = visibleRows.map((row) => row.id);
    const allVisibleSelected = allVisibleIds.every((id) => selectedLetterIds.includes(id));

    if (allVisibleSelected) {
      setSelectedLetterIds((current) => current.filter((id) => !visibleRowIdSet.has(id)));
      return;
    }

    setSelectedLetterIds((current) => Array.from(new Set([...current, ...allVisibleIds])));
  }

  async function handleDeleteLetter(letterId) {
    if (!onDeleteLetter) {
      return;
    }

    const deleted = await onDeleteLetter(letterId);
    if (!deleted) {
      return;
    }

    setSelectedLetterIds((current) => current.filter((id) => id !== letterId));
  }

  async function handleBulkDeleteLetters() {
    if (!onBulkDeleteLetters || !selectedLetterIds.length) {
      return;
    }

    const deleted = await onBulkDeleteLetters(selectedLetterIds);
    if (!deleted) {
      return;
    }

    setSelectedLetterIds([]);
  }

  return (
    <section className="view is-active">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Register</p>
          <h2>Issued records</h2>
        </div>
      </div>

      <article className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Filters</p>
            <h3>Search register</h3>
          </div>
          {visibleRows.length ? (
            <div className="row-actions">
              <button className="button button-secondary" type="button" onClick={toggleSelectAllVisible}>
                {visibleSelectedCount === visibleRows.length ? "Clear visible" : "Select visible"}
              </button>
              <button
                className="button button-secondary"
                type="button"
                onClick={handleBulkDeleteLetters}
                disabled={!selectedLetterIds.length}
              >
                Delete selected ({selectedLetterIds.length})
              </button>
            </div>
          ) : null}
        </div>

        <div className="filters">
          <label>
            Company
            <select value={filters.companyId} onChange={(event) => onFilterChange({ companyId: event.target.value, departmentId: "" })}>
              <option value="">All companies</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name} ({company.shortCode})
                </option>
              ))}
            </select>
          </label>
          <label>
            Department
            <select value={filters.departmentId} onChange={(event) => onFilterChange({ departmentId: event.target.value })}>
              <option value="">All departments</option>
              {filteredDepartments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name} ({department.code})
                </option>
              ))}
            </select>
          </label>
          <label>
            Search
            <input
              type="search"
              value={filters.search}
              onChange={(event) => onFilterChange({ search: event.target.value })}
              placeholder="Number, subject, recipient, custom fields"
            />
          </label>
        </div>

        <PaginationControls
          page={currentPage}
          pageSize={pageSize}
          totalItems={visibleRows.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Select</th>
                <th>Letter No</th>
                <th>Date</th>
                <th>Company</th>
                <th>Department</th>
                <th>Issued To</th>
                <th>Subject</th>
                <th>Prepared By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length ? (
                paginatedRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedLetterIds.includes(row.id)}
                        onChange={() => toggleLetterSelection(row.id)}
                        aria-label={`Select letter ${row.letterNo}`}
                      />
                    </td>
                    <td>{row.letterNo}</td>
                    <td>{formatDate(row.issueDate)}</td>
                    <td>{row.companyName}</td>
                    <td>{row.departmentName}</td>
                    <td>{row.recipientName}</td>
                    <td>{row.subject}</td>
                    <td>{row.preparedBy}</td>
                    <td>
                      <div className="row-actions">
                        <button className="button button-secondary" type="button" onClick={() => onEditLetter?.(row.id)}>
                          Edit
                        </button>
                        <button className="button button-secondary" type="button" onClick={() => onPrintLetter(row.id)}>
                          Print
                        </button>
                        <button className="button button-secondary" type="button" onClick={() => handleDeleteLetter(row.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9}>
                    <EmptyState message="No letters match the current filters." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {groupedRows.length ? (
          <div className="register-type-groups">
            {groupedRows.map((group) => (
              <section key={group.key} className="register-type-section">
                <div className="register-type-section__header">
                  <div>
                    <p className="eyebrow">Template Type</p>
                    <h3>{group.typeName}</h3>
                  </div>
                  <span className="chip chip--tone">{group.rows.length} record(s)</span>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Select</th>
                        <th>{group.numberLabel}</th>
                        <th>Date</th>
                        <th>Company</th>
                        <th>Department</th>
                        <th>Template</th>
                        <th>Issued To</th>
                        <th>Subject</th>
                        <th>Prepared By</th>
                        {group.customColumns.map((column) => (
                          <th key={`${group.key}-${column.key}`}>
                            {column.label}
                            {column.required ? " *" : ""}
                          </th>
                        ))}
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedLetterIds.includes(row.id)}
                              onChange={() => toggleLetterSelection(row.id)}
                              aria-label={`Select record ${row.letterNo}`}
                            />
                          </td>
                          <td>{row.letterNo}</td>
                          <td>{formatDate(row.issueDate)}</td>
                          <td>{row.companyName}</td>
                          <td>{row.departmentName}</td>
                          <td>{row.templateName}</td>
                          <td>{row.recipientName}</td>
                          <td>{row.subject}</td>
                          <td>{row.preparedBy}</td>
                          {group.customColumns.map((column) => {
                            const rawValue = row.registerCustomFieldValueMap?.[column.key];
                            const value = String(rawValue ?? "").trim();
                            const isMissingRequired = column.required && !value;

                            return (
                              <td key={`${row.id}-${column.key}`} className={isMissingRequired ? "register-custom-cell--missing" : ""}>
                                {value || (isMissingRequired ? "Missing" : "-")}
                              </td>
                            );
                          })}
                          <td>
                            <div className="row-actions">
                              <button className="button button-secondary" type="button" onClick={() => onEditLetter?.(row.id)}>
                                Edit
                              </button>
                              <button className="button button-secondary" type="button" onClick={() => onPrintLetter(row.id)}>
                                Print
                              </button>
                              <button className="button button-secondary" type="button" onClick={() => handleDeleteLetter(row.id)}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState message="No records match the current filters." />
        )}
 
      </article>
      
    </section>
    
  );
}
