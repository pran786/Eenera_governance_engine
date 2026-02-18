"""
ICO/GDPR Seed Data - UK Information Commissioner's Office obligations
Structured as: Themes → Obligations → Controls (atomic, testable)
"""

FRAMEWORK_NAME = "UK ICO / GDPR"
FRAMEWORK_DESCRIPTION = "United Kingdom Information Commissioner's Office General Data Protection Regulation compliance framework"

THEMES = [
    {
        "theme": "Lawful Basis",
        "obligations": [
            {
                "title": "Lawful Basis for Processing",
                "description": "Organisation must identify and document a lawful basis for each processing activity under Article 6 GDPR.",
                "controls": [
                    {"control_id": "LB-001", "statement": "A lawful basis is identified and documented for each processing activity.", "weight": 3},
                    {"control_id": "LB-002", "statement": "Where consent is relied upon, it is freely given, specific, informed, and unambiguous.", "weight": 3},
                    {"control_id": "LB-003", "statement": "Legitimate interest assessments are conducted and documented where applicable.", "weight": 2},
                    {"control_id": "LB-004", "statement": "Special category data processing is supported by an Article 9 condition.", "weight": 3},
                    {"control_id": "LB-005", "statement": "Records of processing activities (ROPA) are maintained as per Article 30.", "weight": 2},
                ]
            },
            {
                "title": "Consent Management",
                "description": "Where consent is used as a lawful basis, it must be managed, recorded, and revocable.",
                "controls": [
                    {"control_id": "CM-001", "statement": "Consent records include who consented, when, what they were told, and how.", "weight": 2},
                    {"control_id": "CM-002", "statement": "A mechanism exists for individuals to withdraw consent easily.", "weight": 3},
                    {"control_id": "CM-003", "statement": "Consent is not bundled with terms and conditions.", "weight": 2},
                ]
            }
        ]
    },
    {
        "theme": "Transparency",
        "obligations": [
            {
                "title": "Privacy Notice Requirements",
                "description": "Organisations must provide clear, transparent privacy information to data subjects as per Articles 13 and 14.",
                "controls": [
                    {"control_id": "TR-001", "statement": "A privacy notice is published and accessible to all data subjects.", "weight": 3},
                    {"control_id": "TR-002", "statement": "The privacy notice identifies the data controller and contact details.", "weight": 2},
                    {"control_id": "TR-003", "statement": "The privacy notice specifies all purposes of processing.", "weight": 3},
                    {"control_id": "TR-004", "statement": "The privacy notice identifies the lawful basis for each purpose.", "weight": 3},
                    {"control_id": "TR-005", "statement": "Data retention periods are clearly stated in the privacy notice.", "weight": 2},
                    {"control_id": "TR-006", "statement": "International transfer details are disclosed where applicable.", "weight": 2},
                    {"control_id": "TR-007", "statement": "The privacy notice is written in clear, plain language.", "weight": 2},
                ]
            }
        ]
    },
    {
        "theme": "Data Subject Rights",
        "obligations": [
            {
                "title": "Right of Access",
                "description": "Individuals have the right to access their personal data under Article 15.",
                "controls": [
                    {"control_id": "DSR-001", "statement": "A process exists to handle Subject Access Requests (SARs) within one month.", "weight": 3},
                    {"control_id": "DSR-002", "statement": "Identity verification procedures are in place for SARs.", "weight": 2},
                    {"control_id": "DSR-003", "statement": "Responses include all required information (purposes, categories, recipients).", "weight": 2},
                ]
            },
            {
                "title": "Right to Erasure and Rectification",
                "description": "Data subjects have rights to correction and deletion of their data.",
                "controls": [
                    {"control_id": "DSR-004", "statement": "A process exists for individuals to request data deletion.", "weight": 3},
                    {"control_id": "DSR-005", "statement": "A process exists for individuals to request data correction.", "weight": 2},
                    {"control_id": "DSR-006", "statement": "Third parties are notified when data is erased or rectified.", "weight": 2},
                ]
            },
            {
                "title": "Right to Data Portability",
                "description": "Data subjects can receive their data in a portable format.",
                "controls": [
                    {"control_id": "DSR-007", "statement": "Personal data can be provided in a structured, machine-readable format.", "weight": 2},
                    {"control_id": "DSR-008", "statement": "Data portability requests are fulfilled within one month.", "weight": 2},
                ]
            }
        ]
    },
    {
        "theme": "Security",
        "obligations": [
            {
                "title": "Data Security Measures",
                "description": "Appropriate technical and organisational measures must be in place per Article 32.",
                "controls": [
                    {"control_id": "SEC-001", "statement": "Personal data is encrypted at rest and in transit.", "weight": 3},
                    {"control_id": "SEC-002", "statement": "Access controls restrict data access to authorised personnel only.", "weight": 3},
                    {"control_id": "SEC-003", "statement": "Regular security testing and vulnerability assessments are conducted.", "weight": 2},
                    {"control_id": "SEC-004", "statement": "Staff receive regular data protection and security training.", "weight": 2},
                    {"control_id": "SEC-005", "statement": "Pseudonymisation techniques are applied where appropriate.", "weight": 1},
                ]
            },
            {
                "title": "Breach Notification",
                "description": "Personal data breaches must be reported as per Articles 33 and 34.",
                "controls": [
                    {"control_id": "SEC-006", "statement": "A data breach response plan is documented and tested.", "weight": 3},
                    {"control_id": "SEC-007", "statement": "Breaches are reported to the ICO within 72 hours where required.", "weight": 3},
                    {"control_id": "SEC-008", "statement": "Affected individuals are notified without undue delay for high-risk breaches.", "weight": 2},
                ]
            }
        ]
    },
    {
        "theme": "Accountability",
        "obligations": [
            {
                "title": "Data Protection Officer",
                "description": "A DPO must be appointed where required, with appropriate independence and resources.",
                "controls": [
                    {"control_id": "ACC-001", "statement": "A Data Protection Officer is appointed where required by Article 37.", "weight": 2},
                    {"control_id": "ACC-002", "statement": "The DPO operates independently and reports to the highest management level.", "weight": 2},
                    {"control_id": "ACC-003", "statement": "DPO contact details are published and communicated to the ICO.", "weight": 1},
                ]
            },
            {
                "title": "Data Protection Impact Assessment",
                "description": "DPIAs must be conducted for high-risk processing activities under Article 35.",
                "controls": [
                    {"control_id": "ACC-004", "statement": "DPIAs are conducted for processing likely to result in high risk.", "weight": 3},
                    {"control_id": "ACC-005", "statement": "DPIA outcomes are documented and acted upon.", "weight": 2},
                    {"control_id": "ACC-006", "statement": "The ICO is consulted where residual risks remain high.", "weight": 2},
                ]
            },
            {
                "title": "Data Processing Agreements",
                "description": "Contracts with processors must meet Article 28 requirements.",
                "controls": [
                    {"control_id": "ACC-007", "statement": "Written contracts are in place with all data processors.", "weight": 3},
                    {"control_id": "ACC-008", "statement": "Processor contracts include required Article 28 clauses.", "weight": 2},
                    {"control_id": "ACC-009", "statement": "Sub-processor arrangements are documented and authorised.", "weight": 2},
                ]
            }
        ]
    },
    {
        "theme": "International Transfers",
        "obligations": [
            {
                "title": "Cross-Border Data Transfers",
                "description": "Transfers of personal data outside the UK must have appropriate safeguards.",
                "controls": [
                    {"control_id": "IT-001", "statement": "International transfers are identified and documented.", "weight": 3},
                    {"control_id": "IT-002", "statement": "Appropriate safeguards (SCCs, adequacy decisions) are in place for transfers.", "weight": 3},
                    {"control_id": "IT-003", "statement": "Transfer Impact Assessments are conducted where required.", "weight": 2},
                    {"control_id": "IT-004", "statement": "Data subjects are informed of international transfers and safeguards.", "weight": 2},
                ]
            }
        ]
    }
]

# Keyword mapping for heuristic analysis
KEYWORD_MAP = {
    "LB-001": ["lawful basis", "legal basis", "processing activity", "article 6", "legitimate interest", "consent", "contract", "legal obligation", "vital interest", "public task"],
    "LB-002": ["consent", "freely given", "specific", "informed", "unambiguous", "opt-in", "checkbox"],
    "LB-003": ["legitimate interest", "LIA", "balancing test", "necessity"],
    "LB-004": ["special category", "sensitive data", "health data", "racial", "ethnic", "political", "religious", "biometric", "genetic", "article 9"],
    "LB-005": ["record of processing", "ROPA", "article 30", "processing register"],
    "CM-001": ["consent record", "who consented", "when", "consent log"],
    "CM-002": ["withdraw consent", "opt-out", "unsubscribe", "revoke consent"],
    "CM-003": ["bundled consent", "terms and conditions", "separate consent"],
    "TR-001": ["privacy notice", "privacy policy", "published", "accessible"],
    "TR-002": ["data controller", "contact details", "contact information", "registered address"],
    "TR-003": ["purpose", "purposes of processing", "why we collect", "use your data"],
    "TR-004": ["lawful basis", "legal basis", "legal ground", "rely on"],
    "TR-005": ["retention", "how long", "keep your data", "storage period", "delete", "retention period"],
    "TR-006": ["international transfer", "outside the UK", "third country", "EEA", "adequacy"],
    "TR-007": ["clear language", "plain language", "easy to understand"],
    "DSR-001": ["subject access request", "SAR", "right to access", "access request", "right of access"],
    "DSR-002": ["identity verification", "verify identity", "proof of identity"],
    "DSR-003": ["access response", "provide information", "copy of data"],
    "DSR-004": ["right to erasure", "right to be forgotten", "delete", "deletion", "erase"],
    "DSR-005": ["rectification", "correction", "inaccurate", "update your data"],
    "DSR-006": ["notify third parties", "inform recipients"],
    "DSR-007": ["data portability", "machine-readable", "structured format", "portable"],
    "DSR-008": ["portability request", "one month"],
    "SEC-001": ["encryption", "encrypted", "TLS", "SSL", "at rest", "in transit"],
    "SEC-002": ["access control", "authorised", "role-based", "authentication", "restricted access"],
    "SEC-003": ["security testing", "vulnerability", "penetration test", "pen test", "security audit"],
    "SEC-004": ["security training", "staff training", "awareness", "data protection training"],
    "SEC-005": ["pseudonymisation", "anonymisation", "de-identified"],
    "SEC-006": ["breach plan", "incident response", "breach procedure", "breach notification plan"],
    "SEC-007": ["72 hours", "report breach", "notify ICO", "supervisory authority"],
    "SEC-008": ["notify individuals", "inform data subjects", "high risk breach"],
    "ACC-001": ["data protection officer", "DPO", "appointed"],
    "ACC-002": ["DPO independence", "reports to", "management level"],
    "ACC-003": ["DPO contact", "published"],
    "ACC-004": ["DPIA", "data protection impact assessment", "impact assessment", "high risk processing"],
    "ACC-005": ["DPIA outcome", "DPIA documented", "assessment results"],
    "ACC-006": ["consult ICO", "prior consultation", "residual risk"],
    "ACC-007": ["processor contract", "data processing agreement", "DPA", "written contract", "processor"],
    "ACC-008": ["article 28", "processor clauses", "contractual obligations"],
    "ACC-009": ["sub-processor", "subcontractor", "onward transfer"],
    "IT-001": ["international transfer", "cross-border", "overseas", "third country"],
    "IT-002": ["standard contractual clauses", "SCC", "adequacy decision", "safeguards"],
    "IT-003": ["transfer impact assessment", "TIA", "transfer risk"],
    "IT-004": ["informed of transfers", "transfer disclosure"],
}
