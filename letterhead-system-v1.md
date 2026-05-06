# Letterhead System V1

## Core Decision

- Do not save PDF files directly inside the database.
- Save PDF files in cloud storage.
- Save only the PDF link, file name, and metadata in the database.

## Recommended Stack

- App/site: custom internal web app
- Database: Supabase PostgreSQL
- PDF storage: Supabase Storage
- Reporting/export: Excel

## Why PDF Should Not Be Stored In DB

- Database becomes heavy very quickly
- Backups become larger and slower
- File downloads become less efficient
- Cloud storage is better for PDFs and attachments

## Correct Storage Model

- Database stores:
  - company
  - department
  - template
  - issued letter details
  - PDF file path or public/private storage URL
- Storage stores:
  - generated PDF files

## Main Modules

### 1. Companies

- company name
- short code
- address
- phone
- email
- logo
- footer text
- status

### 2. Departments

- linked company
- department name
- department code
- status

### 3. Letter Templates

- linked company
- linked department
- template name
- template type
- header layout
- body layout
- footer layout
- status

### 4. Issue Letter

- select company
- select department
- select template
- enter recipient details
- enter subject
- enter body fields
- preview final letter
- generate PDF

### 5. Letter Register

- list all issued letters
- search by company
- search by department
- search by date
- search by recipient
- search by letter number
- open PDF

### 6. Reports

- export to Excel
- date-wise report
- company-wise report
- department-wise report

## Database Tables

### companies

- id
- name
- short_code
- address
- phone
- email
- logo_url
- footer_text
- status
- created_at

### departments

- id
- company_id
- name
- code
- status
- created_at

### letter_templates

- id
- company_id
- department_id
- name
- type
- header_html_or_layout
- body_layout
- footer_html_or_layout
- status
- created_at

### issued_letters

- id
- company_id
- department_id
- template_id
- letter_no
- issue_date
- recipient_name
- recipient_company
- recipient_department
- subject
- body_data_json
- prepared_by
- approved_by
- pdf_file_name
- pdf_storage_path
- status
- remarks
- created_at

### numbering_sequences

- id
- company_id
- department_id
- template_id
- prefix
- current_number
- reset_rule

### users

- id
- name
- email
- role
- company_id
- department_id
- status

## Example Letter Number Format

- ABC/HR/2026/0001
- ABC/FIN/2026/0002
- XYZ/ADM/2026/0001

## Excel Export Columns

- Letter No
- Issue Date
- Company
- Department
- Template
- Issued To
- Recipient Company
- Recipient Department
- Subject
- Prepared By
- Approved By
- PDF File Name
- PDF Path
- Status
- Remarks

## V1 Scope

- manage companies
- manage departments
- manage letter templates
- issue letter from form
- auto-generate PDF
- save PDF in storage
- save record in database
- export register to Excel

## Later Features

- approval workflow
- digital signature
- template designer
- audit log screen
- advanced filters
- dashboard
- role-based permissions

## Recommendation

- Start with fixed templates, not a full Canva-like editor
- Use database as the main source of truth
- Use Excel only for export and reporting
- Keep PDFs in storage and save only their path in the database
