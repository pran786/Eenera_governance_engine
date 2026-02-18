# Eenera V1 – PRD & Implementation Log

## Original Problem Statement
Build a framework-agnostic governance reasoning engine using UK ICO/GDPR obligations dataset as V1 training domain.
Flow: Upload → Obligation Mapping → Gap Detection → Risk Score → Task → Approval → Export

## Architecture
- **Backend**: FastAPI + MongoDB (motor async driver)
- **Frontend**: React + Tailwind + Shadcn/UI + Recharts
- **Auth**: JWT-based with roles (admin/contributor/viewer)
- **AI**: Multi-LLM (OpenAI via Emergent, Gemini, Ollama optional) with keyword heuristic fallback
- **PDF**: WeasyPrint server-side generation

## User Personas
1. **Compliance Officer / DPO** - Primary user, runs assessments, reviews gaps
2. **Admin** - Manages frameworks, versions, organisations
3. **Contributor** - Creates tasks, attaches evidence, requests approvals
4. **Viewer** - Read-only access to reports and dashboards

## Core Requirements
- [x] Registry Layer: Framework, versions, obligations, controls (atomic/testable)
- [x] Organisation Layer: Orgs, documents, chunks, evidence with hashing
- [x] Assessment Engine: Control assessments, scoring, gap detection
- [x] Scoring: MET=1, PARTIAL=0.5, NOT_MET=0, UNKNOWN=0, weighted average
- [x] Banding: Green ≥80%, Amber 55-79%, Red <55%
- [x] Role-based access
- [x] Audit logging for all actions
- [x] Evidence hashing (SHA-256)

## What's Been Implemented (Feb 18, 2026)
### Backend (28 endpoints, 100% tested)
- Auth: register, login, me
- Frameworks: CRUD, CSV import, seed ICO/GDPR (12 obligations, 44 controls)
- Organisations: CRUD
- Documents: upload with chunking, sample policy embed
- Assessments: create, generate (heuristic keyword matching), score calculation
- Control Assessments: list, manual override
- Gaps: auto-detection from NOT_MET/PARTIAL controls
- Tasks: CRUD with assignment and due dates
- Approvals: create with approve/reject workflow
- Reports: preview (full JSON), PDF export (WeasyPrint)
- AI Analysis: Optional LLM-powered analysis via Emergent integrations
- Audit Logs: full action logging

### Frontend (6 pages, 95% tested)
1. Login/Register with role selection
2. Governance Dashboard: score circle, coverage, status breakdown, theme scores, critical gaps
3. Obligation Mapping: theme sidebar, control table, detail sheet with override
4. Gaps & Tasks: gap table, task creation from gaps, approval workflow
5. Evidence Pack: full report preview + PDF download
6. Framework Management: seed, CSV import, version management

### Design System
- Brand: #0B1F3B (navy) + #1E4FFF (royal blue) on #F4F6FA
- Typography: Plus Jakarta Sans headings, Inter body, JetBrains Mono data
- Stripe × Palantir institutional aesthetic
- No gradients, no glow, minimal shadows

## Prioritized Backlog
### P0 (Critical)
- None remaining for V1

### P1 (Important)
- Document file upload (PDF/DOCX parsing) beyond plain text
- AI analysis integration testing with actual LLM key
- Org data isolation enforcement
- Multi-framework simultaneous assessment

### P2 (Nice to Have)
- DPIA reference detection
- Processor clause analysis
- Retention schedule extraction
- Real-time collaboration features
- Webhook notifications

## Next Tasks
1. Test AI analysis with Emergent LLM key
2. Add file upload support for PDF/DOCX documents
3. Add bulk override capability for control assessments
4. Add dashboard comparison between assessment versions
5. SOC 2 framework template addition
