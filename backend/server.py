from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import hashlib
import re
import io
import csv
import json
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import jwt
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'eenera-default-secret')
LLM_PROVIDER = os.environ.get('LLM_PROVIDER', 'openai')
LLM_MODEL = os.environ.get('LLM_MODEL', 'gpt-5.2')
OLLAMA_URL = os.environ.get('OLLAMA_URL', 'http://localhost:11434')
OLLAMA_MODEL = os.environ.get('OLLAMA_MODEL', 'llama3')

app = FastAPI(title="Eenera V1 - Governance Engine")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ──────────────── PYDANTIC MODELS ────────────────

class UserRegister(BaseModel):
    email: str
    password: str
    name: str
    role: str = "contributor"

class UserLogin(BaseModel):
    email: str
    password: str

class OrgCreate(BaseModel):
    name: str
    description: str = ""

class AssessmentCreate(BaseModel):
    org_id: str
    framework_version_id: str

class ControlOverride(BaseModel):
    status: str
    confidence: float = 1.0
    rationale: str = ""

class GapCreate(BaseModel):
    assessment_id: str
    control_id: str
    obligation_title: str
    severity: str = "medium"
    description: str = ""
    recommended_action: str = ""

class TaskCreate(BaseModel):
    gap_id: str
    assessment_id: str
    description: str
    assigned_to: str = ""
    due_date: str = ""

class TaskUpdate(BaseModel):
    status: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None

class ApprovalCreate(BaseModel):
    task_id: str
    action: str = "approved"
    comment: str = ""

class FrameworkCreate(BaseModel):
    name: str
    description: str = ""

class VersionCreate(BaseModel):
    version: str
    status: str = "active"

# ──────────────── AUTH HELPERS ────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, email: str, role: str) -> str:
    return jwt.encode({"user_id": user_id, "email": email, "role": role}, JWT_SECRET, algorithm="HS256")

async def get_current_user(token: str = None):
    if not token:
        return None
    try:
        token = token.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except Exception:
        return None

def extract_token(authorization: str = None):
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

# ──────────────── AUDIT LOG HELPER ────────────────

async def log_audit(action: str, user_id: str, entity_type: str, entity_id: str, details: str = ""):
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": action,
        "user_id": user_id,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

# ──────────────── AUTH ROUTES ────────────────

@api_router.post("/auth/register")
async def register(data: UserRegister):
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": data.email,
        "password": hash_password(data.password),
        "name": data.name,
        "role": data.role,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    token = create_token(user_id, data.email, data.role)
    await log_audit("user_registered", user_id, "user", user_id)
    return {"token": token, "user": {"id": user_id, "email": data.email, "name": data.name, "role": data.role}}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user["id"], user["email"], user["role"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}}

@api_router.get("/auth/me")
async def get_me(authorization: str = None):
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_data = extract_token(authorization)
    user = await db.users.find_one({"id": user_data["user_id"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ──────────────── FRAMEWORK ROUTES ────────────────

@api_router.get("/frameworks")
async def list_frameworks():
    frameworks = await db.frameworks.find({}, {"_id": 0}).to_list(100)
    return frameworks

@api_router.post("/frameworks")
async def create_framework(data: FrameworkCreate, authorization: str = None):
    user = extract_token(authorization)
    fw_id = str(uuid.uuid4())
    fw = {
        "id": fw_id,
        "name": data.name,
        "description": data.description,
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.frameworks.insert_one(fw)
    await log_audit("framework_created", user["user_id"], "framework", fw_id, data.name)
    return {k: v for k, v in fw.items() if k != "_id"}

@api_router.get("/frameworks/{framework_id}/versions")
async def list_versions(framework_id: str):
    versions = await db.framework_versions.find({"framework_id": framework_id}, {"_id": 0}).to_list(100)
    return versions

@api_router.post("/frameworks/{framework_id}/versions")
async def create_version(framework_id: str, data: VersionCreate, authorization: str = None):
    user = extract_token(authorization)
    ver_id = str(uuid.uuid4())
    ver = {
        "id": ver_id,
        "framework_id": framework_id,
        "version": data.version,
        "status": data.status,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.framework_versions.insert_one(ver)
    await log_audit("version_created", user["user_id"], "framework_version", ver_id, data.version)
    return {k: v for k, v in ver.items() if k != "_id"}

@api_router.get("/frameworks/{version_id}/obligations")
async def list_obligations(version_id: str):
    obligations = await db.obligations.find({"framework_version_id": version_id}, {"_id": 0}).to_list(500)
    return obligations

@api_router.get("/frameworks/{version_id}/controls")
async def list_controls(version_id: str):
    controls = await db.controls.find({"framework_version_id": version_id}, {"_id": 0}).to_list(500)
    return controls

@api_router.post("/frameworks/import-csv")
async def import_csv(file: UploadFile = File(...), framework_id: str = "", version: str = "1.0", authorization: str = None):
    user = extract_token(authorization)
    content = await file.read()
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))
    
    if not framework_id:
        fw_id = str(uuid.uuid4())
        fw_name = file.filename.replace(".csv", "").replace("_", " ").title()
        await db.frameworks.insert_one({
            "id": fw_id, "name": fw_name, "description": f"Imported from {file.filename}",
            "created_by": user["user_id"], "created_at": datetime.now(timezone.utc).isoformat()
        })
        framework_id = fw_id

    ver_id = str(uuid.uuid4())
    await db.framework_versions.insert_one({
        "id": ver_id, "framework_id": framework_id, "version": version,
        "status": "active", "created_at": datetime.now(timezone.utc).isoformat()
    })

    obl_count = 0
    ctrl_count = 0
    obligation_cache = {}

    for row in reader:
        theme = row.get("theme", row.get("Theme", "General"))
        obl_title = row.get("obligation", row.get("Obligation", row.get("obligation_title", "")))
        obl_desc = row.get("obligation_description", row.get("Obligation Description", ""))
        ctrl_id_val = row.get("control_id", row.get("Control ID", ""))
        ctrl_stmt = row.get("control", row.get("Control", row.get("control_statement", "")))
        ctrl_weight = int(row.get("weight", row.get("Weight", "2")))

        cache_key = f"{theme}:{obl_title}"
        if cache_key not in obligation_cache:
            obl_id = str(uuid.uuid4())
            await db.obligations.insert_one({
                "id": obl_id, "framework_version_id": ver_id, "theme": theme,
                "title": obl_title, "description": obl_desc,
            })
            obligation_cache[cache_key] = obl_id
            obl_count += 1

        if ctrl_stmt:
            await db.controls.insert_one({
                "id": str(uuid.uuid4()), "framework_version_id": ver_id,
                "obligation_id": obligation_cache[cache_key], "control_id": ctrl_id_val,
                "statement": ctrl_stmt, "weight": ctrl_weight, "theme": theme,
            })
            ctrl_count += 1

    await log_audit("csv_imported", user["user_id"], "framework", framework_id, f"{obl_count} obligations, {ctrl_count} controls")
    return {"message": f"Imported {obl_count} obligations and {ctrl_count} controls", "framework_id": framework_id, "version_id": ver_id}

# ──────────────── SEED DATA ────────────────

@api_router.post("/seed")
async def seed_data(authorization: str = None):
    user = extract_token(authorization)
    from seed_data import THEMES, FRAMEWORK_NAME, FRAMEWORK_DESCRIPTION, KEYWORD_MAP

    existing = await db.frameworks.find_one({"name": FRAMEWORK_NAME}, {"_id": 0})
    if existing:
        versions = await db.framework_versions.find({"framework_id": existing["id"]}, {"_id": 0}).to_list(10)
        return {"message": "Framework already seeded", "framework_id": existing["id"], "versions": versions}

    fw_id = str(uuid.uuid4())
    await db.frameworks.insert_one({
        "id": fw_id, "name": FRAMEWORK_NAME, "description": FRAMEWORK_DESCRIPTION,
        "created_by": user["user_id"], "created_at": datetime.now(timezone.utc).isoformat()
    })

    ver_id = str(uuid.uuid4())
    await db.framework_versions.insert_one({
        "id": ver_id, "framework_id": fw_id, "version": "1.0",
        "status": "active", "created_at": datetime.now(timezone.utc).isoformat()
    })

    total_controls = 0
    total_obligations = 0
    for theme_data in THEMES:
        theme = theme_data["theme"]
        for obl in theme_data["obligations"]:
            obl_id = str(uuid.uuid4())
            await db.obligations.insert_one({
                "id": obl_id, "framework_version_id": ver_id, "theme": theme,
                "title": obl["title"], "description": obl["description"]
            })
            total_obligations += 1
            for ctrl in obl["controls"]:
                await db.controls.insert_one({
                    "id": str(uuid.uuid4()), "framework_version_id": ver_id,
                    "obligation_id": obl_id, "control_id": ctrl["control_id"],
                    "statement": ctrl["statement"], "weight": ctrl["weight"], "theme": theme
                })
                total_controls += 1

    await log_audit("seed_data_loaded", user["user_id"], "framework", fw_id, f"{total_obligations} obligations, {total_controls} controls")
    return {"message": f"Seeded {total_obligations} obligations and {total_controls} controls", "framework_id": fw_id, "version_id": ver_id}

# ──────────────── ORGANISATION ROUTES ────────────────

@api_router.get("/organisations")
async def list_organisations(authorization: str = None):
    user = extract_token(authorization)
    orgs = await db.organisations.find({}, {"_id": 0}).to_list(100)
    return orgs

@api_router.post("/organisations")
async def create_organisation(data: OrgCreate, authorization: str = None):
    user = extract_token(authorization)
    org_id = str(uuid.uuid4())
    org = {
        "id": org_id, "name": data.name, "description": data.description,
        "created_by": user["user_id"], "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.organisations.insert_one(org)
    await log_audit("organisation_created", user["user_id"], "organisation", org_id, data.name)
    return {k: v for k, v in org.items() if k != "_id"}

@api_router.get("/organisations/{org_id}")
async def get_organisation(org_id: str):
    org = await db.organisations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")
    return org

# ──────────────── DOCUMENT ROUTES ────────────────

def chunk_text(text: str, chunk_size: int = 500) -> list:
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current = ""
    for s in sentences:
        if len(current) + len(s) > chunk_size and current:
            chunks.append(current.strip())
            current = s
        else:
            current = current + " " + s if current else s
    if current.strip():
        chunks.append(current.strip())
    return chunks

@api_router.post("/documents/upload")
async def upload_document(file: UploadFile = File(None), org_id: str = "", authorization: str = None, use_sample: bool = False):
    user = extract_token(authorization)
    
    if use_sample:
        from sample_policy import SAMPLE_PRIVACY_POLICY
        content_text = SAMPLE_PRIVACY_POLICY
        filename = "Sample SaaS Privacy Policy.txt"
    elif file:
        content_bytes = await file.read()
        content_text = content_bytes.decode("utf-8", errors="ignore")
        filename = file.filename
    else:
        raise HTTPException(status_code=400, detail="No file or sample flag provided")
    
    doc_hash = hashlib.sha256(content_text.encode()).hexdigest()
    doc_id = str(uuid.uuid4())
    doc = {
        "id": doc_id, "org_id": org_id, "filename": filename,
        "content": content_text, "hash": doc_hash,
        "uploaded_by": user["user_id"],
        "uploaded_at": datetime.now(timezone.utc).isoformat()
    }
    await db.org_documents.insert_one(doc)

    chunks = chunk_text(content_text)
    chunk_docs = []
    for i, chunk in enumerate(chunks):
        chunk_id = str(uuid.uuid4())
        chunk_doc = {
            "id": chunk_id, "document_id": doc_id, "org_id": org_id,
            "chunk_text": chunk, "chunk_index": i,
            "hash": hashlib.sha256(chunk.encode()).hexdigest()
        }
        chunk_docs.append(chunk_doc)
    
    if chunk_docs:
        await db.doc_chunks.insert_many(chunk_docs)
    
    evidence_id = str(uuid.uuid4())
    await db.evidence_items.insert_one({
        "id": evidence_id, "org_id": org_id, "document_id": doc_id,
        "hash": doc_hash, "source": filename,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    await log_audit("document_uploaded", user["user_id"], "document", doc_id, f"{filename} ({len(chunks)} chunks)")
    return {
        "document_id": doc_id, "filename": filename, "chunks": len(chunks),
        "hash": doc_hash, "evidence_id": evidence_id
    }

@api_router.get("/documents/{org_id}")
async def list_documents(org_id: str):
    docs = await db.org_documents.find({"org_id": org_id}, {"_id": 0, "content": 0}).to_list(100)
    return docs

@api_router.get("/documents/{doc_id}/chunks")
async def get_chunks(doc_id: str):
    chunks = await db.doc_chunks.find({"document_id": doc_id}, {"_id": 0}).sort("chunk_index", 1).to_list(1000)
    return chunks

# ──────────────── ASSESSMENT ROUTES ────────────────

@api_router.post("/assessments")
async def create_assessment(data: AssessmentCreate, authorization: str = None):
    user = extract_token(authorization)
    assessment_id = str(uuid.uuid4())
    
    controls = await db.controls.find({"framework_version_id": data.framework_version_id}, {"_id": 0}).to_list(500)
    
    assessment = {
        "id": assessment_id, "org_id": data.org_id,
        "framework_version_id": data.framework_version_id,
        "status": "draft", "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "total_controls": len(controls)
    }
    await db.assessments.insert_one(assessment)
    
    control_assessments = []
    for ctrl in controls:
        control_assessments.append({
            "id": str(uuid.uuid4()), "assessment_id": assessment_id,
            "control_id": ctrl["id"], "control_ref": ctrl["control_id"],
            "statement": ctrl["statement"], "theme": ctrl.get("theme", ""),
            "obligation_id": ctrl.get("obligation_id", ""),
            "status": "UNKNOWN", "confidence": 0.0, "rationale": "",
            "weight": ctrl.get("weight", 2),
            "evidence_ids": []
        })
    
    if control_assessments:
        await db.control_assessments.insert_many(control_assessments)
    
    await log_audit("assessment_created", user["user_id"], "assessment", assessment_id)
    return {k: v for k, v in assessment.items() if k != "_id"}

@api_router.get("/assessments")
async def list_assessments(org_id: str = None, authorization: str = None):
    user = extract_token(authorization)
    query = {}
    if org_id:
        query["org_id"] = org_id
    assessments = await db.assessments.find(query, {"_id": 0}).to_list(100)
    return assessments

@api_router.get("/assessments/{assessment_id}")
async def get_assessment(assessment_id: str):
    assessment = await db.assessments.find_one({"id": assessment_id}, {"_id": 0})
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    control_assessments = await db.control_assessments.find(
        {"assessment_id": assessment_id}, {"_id": 0}
    ).to_list(500)
    
    gaps = await db.gaps.find({"assessment_id": assessment_id}, {"_id": 0}).to_list(500)
    tasks = await db.tasks.find({"assessment_id": assessment_id}, {"_id": 0}).to_list(500)
    
    score = calculate_score(control_assessments)
    
    assessment["control_assessments"] = control_assessments
    assessment["gaps"] = gaps
    assessment["tasks"] = tasks
    assessment["score"] = score
    
    return assessment

# ──────────────── SCORING ────────────────

def calculate_score(control_assessments: list) -> dict:
    if not control_assessments:
        return {"overall": 0, "coverage": 0, "band": "Red", "themes": {}}
    
    status_scores = {"MET": 1.0, "PARTIAL": 0.5, "NOT_MET": 0.0, "UNKNOWN": 0.0}
    
    total_weight = sum(ca.get("weight", 2) for ca in control_assessments)
    weighted_sum = sum(
        status_scores.get(ca["status"], 0) * ca.get("weight", 2)
        for ca in control_assessments
    )
    
    overall = weighted_sum / total_weight if total_weight > 0 else 0
    
    assessed = sum(1 for ca in control_assessments if ca["status"] != "UNKNOWN")
    coverage = assessed / len(control_assessments) if control_assessments else 0
    
    if overall >= 0.80:
        band = "Green"
    elif overall >= 0.55:
        band = "Amber"
    else:
        band = "Red"
    
    themes = {}
    for ca in control_assessments:
        t = ca.get("theme", "General")
        if t not in themes:
            themes[t] = {"total_weight": 0, "weighted_sum": 0, "count": 0, "met": 0, "partial": 0, "not_met": 0, "unknown": 0}
        themes[t]["total_weight"] += ca.get("weight", 2)
        themes[t]["weighted_sum"] += status_scores.get(ca["status"], 0) * ca.get("weight", 2)
        themes[t]["count"] += 1
        themes[t][ca["status"].lower()] = themes[t].get(ca["status"].lower(), 0) + 1
    
    theme_scores = {}
    for t, d in themes.items():
        score_val = d["weighted_sum"] / d["total_weight"] if d["total_weight"] > 0 else 0
        if score_val >= 0.80:
            t_band = "Green"
        elif score_val >= 0.55:
            t_band = "Amber"
        else:
            t_band = "Red"
        theme_scores[t] = {"score": round(score_val * 100), "band": t_band, **{k: d[k] for k in ["count", "met", "partial", "not_met", "unknown"]}}
    
    status_counts = {"met": 0, "partial": 0, "not_met": 0, "unknown": 0}
    for ca in control_assessments:
        status_counts[ca["status"].lower()] = status_counts.get(ca["status"].lower(), 0) + 1
    
    return {
        "overall": round(overall * 100),
        "coverage": round(coverage * 100),
        "band": band,
        "themes": theme_scores,
        "status_counts": status_counts,
        "total_controls": len(control_assessments)
    }

@api_router.get("/assessments/{assessment_id}/score")
async def get_score(assessment_id: str):
    control_assessments = await db.control_assessments.find(
        {"assessment_id": assessment_id}, {"_id": 0}
    ).to_list(500)
    return calculate_score(control_assessments)

# ──────────────── HEURISTIC + AI ANALYSIS ────────────────

@api_router.post("/assessments/{assessment_id}/generate")
async def generate_assessment(assessment_id: str, use_ai: bool = False, authorization: str = None):
    user = extract_token(authorization)
    
    assessment = await db.assessments.find_one({"id": assessment_id}, {"_id": 0})
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    chunks = await db.doc_chunks.find({"org_id": assessment["org_id"]}, {"_id": 0}).to_list(5000)
    full_text = " ".join([c["chunk_text"] for c in chunks]).lower()
    
    if not full_text.strip():
        raise HTTPException(status_code=400, detail="No documents found for this organisation. Upload a document first.")
    
    from seed_data import KEYWORD_MAP
    
    control_assessments = await db.control_assessments.find(
        {"assessment_id": assessment_id}, {"_id": 0}
    ).to_list(500)
    
    updates = []
    for ca in control_assessments:
        ctrl_ref = ca["control_ref"]
        keywords = KEYWORD_MAP.get(ctrl_ref, [])
        
        matches = 0
        matched_keywords = []
        for kw in keywords:
            if kw.lower() in full_text:
                matches += 1
                matched_keywords.append(kw)
        
        if not keywords:
            status = "UNKNOWN"
            confidence = 0.0
            rationale = "No keyword mapping available for this control."
        elif matches >= len(keywords) * 0.6:
            status = "MET"
            confidence = min(0.9, matches / len(keywords))
            rationale = f"Keywords found: {', '.join(matched_keywords[:5])}"
        elif matches >= len(keywords) * 0.3:
            status = "PARTIAL"
            confidence = matches / len(keywords)
            rationale = f"Partial coverage. Found: {', '.join(matched_keywords[:5])}. Missing some key indicators."
        elif matches > 0:
            status = "PARTIAL"
            confidence = 0.3
            rationale = f"Weak coverage. Only found: {', '.join(matched_keywords[:3])}"
        else:
            status = "NOT_MET"
            confidence = 0.7
            rationale = f"No relevant keywords found for: {', '.join(keywords[:3])}"
        
        updates.append({
            "control_ref": ctrl_ref,
            "ca_id": ca["id"],
            "status": status,
            "confidence": round(confidence, 2),
            "rationale": rationale
        })
    
    for u in updates:
        await db.control_assessments.update_one(
            {"id": u["ca_id"]},
            {"$set": {"status": u["status"], "confidence": u["confidence"], "rationale": u["rationale"]}}
        )
    
    not_met = [u for u in updates if u["status"] == "NOT_MET"]
    partial = [u for u in updates if u["status"] == "PARTIAL"]
    
    gap_count = 0
    for u in not_met:
        ca = next((c for c in control_assessments if c["id"] == u["ca_id"]), None)
        if ca:
            await db.gaps.insert_one({
                "id": str(uuid.uuid4()), "assessment_id": assessment_id,
                "control_id": ca["control_id"], "control_ref": u["control_ref"],
                "obligation_id": ca.get("obligation_id", ""),
                "obligation_title": "",
                "severity": "high", "description": u["rationale"],
                "recommended_action": f"Address control {u['control_ref']}: Review and implement measures.",
                "status": "open", "created_at": datetime.now(timezone.utc).isoformat()
            })
            gap_count += 1
    
    for u in partial:
        ca = next((c for c in control_assessments if c["id"] == u["ca_id"]), None)
        if ca and u["confidence"] < 0.5:
            await db.gaps.insert_one({
                "id": str(uuid.uuid4()), "assessment_id": assessment_id,
                "control_id": ca["control_id"], "control_ref": u["control_ref"],
                "obligation_id": ca.get("obligation_id", ""),
                "obligation_title": "",
                "severity": "medium", "description": u["rationale"],
                "recommended_action": f"Improve coverage for control {u['control_ref']}.",
                "status": "open", "created_at": datetime.now(timezone.utc).isoformat()
            })
            gap_count += 1
    
    # Populate obligation titles for gaps
    gaps = await db.gaps.find({"assessment_id": assessment_id}, {"_id": 0}).to_list(500)
    for gap in gaps:
        if gap.get("obligation_id") and not gap.get("obligation_title"):
            obl = await db.obligations.find_one({"id": gap["obligation_id"]}, {"_id": 0})
            if obl:
                await db.gaps.update_one({"id": gap["id"]}, {"$set": {"obligation_title": obl["title"]}})
    
    await db.assessments.update_one({"id": assessment_id}, {"$set": {"status": "completed"}})
    
    updated_cas = await db.control_assessments.find({"assessment_id": assessment_id}, {"_id": 0}).to_list(500)
    score = calculate_score(updated_cas)
    
    await db.score_snapshots.insert_one({
        "id": str(uuid.uuid4()), "assessment_id": assessment_id,
        "score": score, "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await log_audit("assessment_generated", user["user_id"], "assessment", assessment_id, f"Score: {score['overall']}%")
    
    return {
        "message": f"Assessment generated. {gap_count} gaps identified.",
        "score": score,
        "updates": len(updates)
    }

# ──────────────── AI ANALYSIS (Optional) ────────────────

@api_router.post("/ai/analyze")
async def ai_analyze(assessment_id: str, authorization: str = None):
    user = extract_token(authorization)
    
    assessment = await db.assessments.find_one({"id": assessment_id}, {"_id": 0})
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    chunks = await db.doc_chunks.find({"org_id": assessment["org_id"]}, {"_id": 0}).to_list(5000)
    doc_text = "\n".join([c["chunk_text"] for c in chunks[:20]])
    
    controls = await db.control_assessments.find(
        {"assessment_id": assessment_id, "status": {"$in": ["UNKNOWN", "PARTIAL"]}},
        {"_id": 0}
    ).to_list(50)
    
    if not controls:
        return {"message": "No controls to analyze", "analyzed": 0}
    
    controls_text = "\n".join([f"- {c['control_ref']}: {c['statement']}" for c in controls[:15]])
    
    prompt = f"""Analyze this privacy policy against GDPR compliance controls.

DOCUMENT:
{doc_text[:3000]}

CONTROLS TO EVALUATE:
{controls_text}

For each control, respond in JSON format:
[{{"control_ref": "XX-001", "status": "MET|PARTIAL|NOT_MET", "confidence": 0.0-1.0, "rationale": "brief explanation"}}]

Be strict. If the document is vague or uses placeholders like [COMPANY NAME], mark as PARTIAL or NOT_MET."""

    try:
        llm_key = os.environ.get('EMERGENT_LLM_KEY', '')
        if not llm_key:
            return {"message": "No LLM API key configured. Set EMERGENT_LLM_KEY in environment.", "analyzed": 0}
        
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        chat = LlmChat(
            api_key=llm_key,
            session_id=f"eenera-{assessment_id}",
            system_message="You are a GDPR compliance analyst. Respond only with valid JSON arrays."
        )
        
        provider = os.environ.get('LLM_PROVIDER', 'openai')
        model = os.environ.get('LLM_MODEL', 'gpt-5.2')
        chat.with_model(provider, model)
        
        response = await chat.send_message(UserMessage(text=prompt))
        
        try:
            json_match = re.search(r'\[.*\]', response, re.DOTALL)
            if json_match:
                results = json.loads(json_match.group())
            else:
                results = json.loads(response)
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse AI response: {response[:200]}")
            return {"message": "AI analysis completed but response parsing failed", "analyzed": 0, "raw": response[:500]}
        
        updated = 0
        for r in results:
            ref = r.get("control_ref", "")
            ca = next((c for c in controls if c["control_ref"] == ref), None)
            if ca:
                await db.control_assessments.update_one(
                    {"id": ca["id"]},
                    {"$set": {
                        "status": r.get("status", ca["status"]),
                        "confidence": r.get("confidence", ca["confidence"]),
                        "rationale": f"[AI] {r.get('rationale', '')}"
                    }}
                )
                updated += 1
        
        await log_audit("ai_analysis", user["user_id"], "assessment", assessment_id, f"Analyzed {updated} controls")
        return {"message": f"AI analyzed {updated} controls", "analyzed": updated}
    
    except Exception as e:
        logger.error(f"AI analysis error: {e}")
        return {"message": f"AI analysis failed: {str(e)}", "analyzed": 0}

# ──────────────── CONTROL ASSESSMENT ROUTES ────────────────

@api_router.get("/control-assessments/assessment/{assessment_id}")
async def list_control_assessments(assessment_id: str):
    cas = await db.control_assessments.find({"assessment_id": assessment_id}, {"_id": 0}).to_list(500)
    return cas

@api_router.put("/control-assessments/{ca_id}")
async def override_control_assessment(ca_id: str, data: ControlOverride, authorization: str = None):
    user = extract_token(authorization)
    result = await db.control_assessments.update_one(
        {"id": ca_id},
        {"$set": {"status": data.status, "confidence": data.confidence, "rationale": f"[Manual] {data.rationale}"}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Control assessment not found")
    await log_audit("control_overridden", user["user_id"], "control_assessment", ca_id, f"Status: {data.status}")
    return {"message": "Control assessment updated", "status": data.status}

# ──────────────── GAP ROUTES ────────────────

@api_router.get("/gaps/assessment/{assessment_id}")
async def list_gaps(assessment_id: str):
    gaps = await db.gaps.find({"assessment_id": assessment_id}, {"_id": 0}).to_list(500)
    return gaps

@api_router.post("/gaps")
async def create_gap(data: GapCreate, authorization: str = None):
    user = extract_token(authorization)
    gap_id = str(uuid.uuid4())
    gap = {
        "id": gap_id, "assessment_id": data.assessment_id,
        "control_id": data.control_id, "obligation_title": data.obligation_title,
        "severity": data.severity, "description": data.description,
        "recommended_action": data.recommended_action,
        "status": "open", "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.gaps.insert_one(gap)
    await log_audit("gap_created", user["user_id"], "gap", gap_id)
    return {k: v for k, v in gap.items() if k != "_id"}

# ──────────────── TASK ROUTES ────────────────

@api_router.get("/tasks/assessment/{assessment_id}")
async def list_tasks(assessment_id: str):
    tasks = await db.tasks.find({"assessment_id": assessment_id}, {"_id": 0}).to_list(500)
    return tasks

@api_router.post("/tasks")
async def create_task(data: TaskCreate, authorization: str = None):
    user = extract_token(authorization)
    task_id = str(uuid.uuid4())
    task = {
        "id": task_id, "gap_id": data.gap_id, "assessment_id": data.assessment_id,
        "description": data.description, "assigned_to": data.assigned_to,
        "due_date": data.due_date, "status": "open",
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tasks.insert_one(task)
    await log_audit("task_created", user["user_id"], "task", task_id)
    return {k: v for k, v in task.items() if k != "_id"}

@api_router.put("/tasks/{task_id}")
async def update_task(task_id: str, data: TaskUpdate, authorization: str = None):
    user = extract_token(authorization)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.tasks.update_one({"id": task_id}, {"$set": update_data})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    await log_audit("task_updated", user["user_id"], "task", task_id, json.dumps(update_data))
    return {"message": "Task updated"}

# ──────────────── APPROVAL ROUTES ────────────────

@api_router.post("/approvals")
async def create_approval(data: ApprovalCreate, authorization: str = None):
    user = extract_token(authorization)
    approval_id = str(uuid.uuid4())
    user_doc = await db.users.find_one({"id": user["user_id"]}, {"_id": 0, "password": 0})
    approval = {
        "id": approval_id, "task_id": data.task_id,
        "approved_by": user["user_id"],
        "approver_name": user_doc.get("name", "") if user_doc else "",
        "role": user.get("role", ""),
        "action": data.action, "comment": data.comment,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.approvals.insert_one(approval)
    
    if data.action == "approved":
        await db.tasks.update_one({"id": data.task_id}, {"$set": {"status": "approved"}})
    elif data.action == "rejected":
        await db.tasks.update_one({"id": data.task_id}, {"$set": {"status": "rejected"}})
    
    await log_audit("approval_created", user["user_id"], "approval", approval_id, data.action)
    return {k: v for k, v in approval.items() if k != "_id"}

@api_router.get("/approvals/task/{task_id}")
async def list_approvals(task_id: str):
    approvals = await db.approvals.find({"task_id": task_id}, {"_id": 0}).to_list(100)
    return approvals

@api_router.get("/approvals/assessment/{assessment_id}")
async def list_assessment_approvals(assessment_id: str):
    tasks = await db.tasks.find({"assessment_id": assessment_id}, {"_id": 0}).to_list(500)
    task_ids = [t["id"] for t in tasks]
    approvals = await db.approvals.find({"task_id": {"$in": task_ids}}, {"_id": 0}).to_list(500)
    return approvals

# ──────────────── REPORT / EXPORT ROUTES ────────────────

@api_router.get("/reports/{assessment_id}/preview")
async def report_preview(assessment_id: str):
    assessment = await db.assessments.find_one({"id": assessment_id}, {"_id": 0})
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    org = await db.organisations.find_one({"id": assessment["org_id"]}, {"_id": 0})
    fw_ver = await db.framework_versions.find_one({"id": assessment["framework_version_id"]}, {"_id": 0})
    fw = None
    if fw_ver:
        fw = await db.frameworks.find_one({"id": fw_ver["framework_id"]}, {"_id": 0})
    
    cas = await db.control_assessments.find({"assessment_id": assessment_id}, {"_id": 0}).to_list(500)
    gaps = await db.gaps.find({"assessment_id": assessment_id}, {"_id": 0}).to_list(500)
    tasks = await db.tasks.find({"assessment_id": assessment_id}, {"_id": 0}).to_list(500)
    
    task_ids = [t["id"] for t in tasks]
    approvals = await db.approvals.find({"task_id": {"$in": task_ids}}, {"_id": 0}).to_list(500)
    
    evidence = await db.evidence_items.find({"org_id": assessment["org_id"]}, {"_id": 0}).to_list(500)
    
    score = calculate_score(cas)
    
    high_gaps = len([g for g in gaps if g.get("severity") == "high"])
    medium_gaps = len([g for g in gaps if g.get("severity") == "medium"])
    low_gaps = len([g for g in gaps if g.get("severity") == "low"])
    
    return {
        "assessment_id": assessment_id,
        "organisation": org,
        "framework": fw,
        "framework_version": fw_ver,
        "date": assessment.get("created_at", ""),
        "score": score,
        "control_assessments": cas,
        "gaps": gaps,
        "tasks": tasks,
        "approvals": approvals,
        "evidence": evidence,
        "summary": {
            "high_risk_gaps": high_gaps,
            "medium_risk_gaps": medium_gaps,
            "low_risk_gaps": low_gaps,
        }
    }

@api_router.get("/reports/{assessment_id}/pdf")
async def export_pdf(assessment_id: str):
    report = await report_preview(assessment_id)
    
    score = report["score"]
    org_name = report["organisation"]["name"] if report["organisation"] else "Unknown"
    fw_name = report["framework"]["name"] if report["framework"] else "Unknown"
    fw_ver = report["framework_version"]["version"] if report["framework_version"] else "1.0"
    
    band_color = "#10B981" if score["band"] == "Green" else "#F59E0B" if score["band"] == "Amber" else "#EF4444"
    
    controls_html = ""
    for ca in report["control_assessments"]:
        status_color = "#10B981" if ca["status"] == "MET" else "#F59E0B" if ca["status"] == "PARTIAL" else "#EF4444" if ca["status"] == "NOT_MET" else "#94A3B8"
        controls_html += f"""<tr>
            <td style="padding:8px;border-bottom:1px solid #E2E8F0;font-family:monospace;font-size:12px;">{ca.get('control_ref','')}</td>
            <td style="padding:8px;border-bottom:1px solid #E2E8F0;font-size:12px;">{ca['statement'][:80]}</td>
            <td style="padding:8px;border-bottom:1px solid #E2E8F0;"><span style="background:{status_color};color:white;padding:2px 8px;border-radius:4px;font-size:11px;">{ca['status']}</span></td>
            <td style="padding:8px;border-bottom:1px solid #E2E8F0;font-size:12px;">{ca['confidence']}</td>
        </tr>"""
    
    gaps_html = ""
    for i, gap in enumerate(report["gaps"]):
        sev_color = "#EF4444" if gap.get("severity") == "high" else "#F59E0B" if gap.get("severity") == "medium" else "#3B82F6"
        gaps_html += f"""<tr>
            <td style="padding:8px;border-bottom:1px solid #E2E8F0;font-size:12px;">GAP-{i+1:03d}</td>
            <td style="padding:8px;border-bottom:1px solid #E2E8F0;font-size:12px;">{gap.get('obligation_title','')}</td>
            <td style="padding:8px;border-bottom:1px solid #E2E8F0;"><span style="background:{sev_color};color:white;padding:2px 8px;border-radius:4px;font-size:11px;">{gap.get('severity','')}</span></td>
            <td style="padding:8px;border-bottom:1px solid #E2E8F0;font-size:12px;">{gap.get('description','')[:60]}</td>
        </tr>"""
    
    tasks_html = ""
    for task in report["tasks"]:
        tasks_html += f"""<tr>
            <td style="padding:8px;border-bottom:1px solid #E2E8F0;font-size:12px;">{task.get('description','')[:60]}</td>
            <td style="padding:8px;border-bottom:1px solid #E2E8F0;font-size:12px;">{task.get('assigned_to','')}</td>
            <td style="padding:8px;border-bottom:1px solid #E2E8F0;font-size:12px;">{task.get('status','')}</td>
            <td style="padding:8px;border-bottom:1px solid #E2E8F0;font-size:12px;">{task.get('due_date','')}</td>
        </tr>"""
    
    approvals_html = ""
    for appr in report["approvals"]:
        approvals_html += f"""<tr>
            <td style="padding:8px;border-bottom:1px solid #E2E8F0;font-size:12px;">{appr.get('approver_name','')}</td>
            <td style="padding:8px;border-bottom:1px solid #E2E8F0;font-size:12px;">{appr.get('role','')}</td>
            <td style="padding:8px;border-bottom:1px solid #E2E8F0;font-size:12px;">{appr.get('created_at','')[:10]}</td>
            <td style="padding:8px;border-bottom:1px solid #E2E8F0;font-size:12px;">{appr.get('action','')}</td>
        </tr>"""
    
    evidence_html = ""
    for ev in report["evidence"]:
        evidence_html += f"""<tr>
            <td style="padding:8px;border-bottom:1px solid #E2E8F0;font-size:12px;">{ev.get('id','')[:12]}</td>
            <td style="padding:8px;border-bottom:1px solid #E2E8F0;font-size:12px;">{ev.get('source','')}</td>
            <td style="padding:8px;border-bottom:1px solid #E2E8F0;font-family:monospace;font-size:10px;">{ev.get('hash','')[:24]}...</td>
        </tr>"""
    
    theme_html = ""
    for t_name, t_data in score.get("themes", {}).items():
        t_color = "#10B981" if t_data["band"] == "Green" else "#F59E0B" if t_data["band"] == "Amber" else "#EF4444"
        theme_html += f"""<tr>
            <td style="padding:8px;border-bottom:1px solid #E2E8F0;font-size:13px;">{t_name}</td>
            <td style="padding:8px;border-bottom:1px solid #E2E8F0;font-size:13px;">{t_data['score']}%</td>
            <td style="padding:8px;border-bottom:1px solid #E2E8F0;"><span style="background:{t_color};color:white;padding:2px 8px;border-radius:4px;font-size:11px;">{t_data['band']}</span></td>
        </tr>"""
    
    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
body {{ font-family: 'Helvetica Neue', Arial, sans-serif; color: #111827; margin: 40px; line-height: 1.6; }}
h1 {{ color: #0B1F3B; font-size: 24px; border-bottom: 3px solid #1E4FFF; padding-bottom: 8px; }}
h2 {{ color: #0B1F3B; font-size: 18px; margin-top: 30px; }}
table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
th {{ background: #F4F6FA; padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748B; border-bottom: 2px solid #E2E8F0; }}
.score-box {{ text-align: center; padding: 30px; background: #F4F6FA; border-radius: 8px; margin: 20px 0; }}
.score-num {{ font-size: 48px; font-weight: 700; color: {band_color}; }}
.disclaimer {{ font-size: 11px; color: #94A3B8; margin-top: 40px; padding-top: 20px; border-top: 1px solid #E2E8F0; }}
</style></head><body>
<div style="text-align:center;margin-bottom:40px;">
<h1 style="border:none;font-size:28px;">EENERA GOVERNANCE ASSESSMENT REPORT</h1>
<p style="color:#64748B;">Organisation: {org_name} | Framework: {fw_name} v{fw_ver}</p>
<p style="color:#64748B;">Assessment Date: {report['date'][:10]} | ID: {assessment_id[:12]}...</p>
</div>

<h2>1. Executive Summary</h2>
<div class="score-box">
<div class="score-num">{score['overall']}%</div>
<div style="font-size:14px;color:#64748B;">Overall Governance Score — <span style="color:{band_color};font-weight:600;">{score['band']}</span></div>
</div>
<p>Coverage: {score['coverage']}% | High-Risk Gaps: {report['summary']['high_risk_gaps']} | Medium-Risk Gaps: {report['summary']['medium_risk_gaps']} | Low-Risk Gaps: {report['summary']['low_risk_gaps']}</p>
<p>This assessment evaluates the organisation's policy documentation against structured UK ICO regulatory obligations. The analysis identifies areas of compliance strength and remediation opportunities.</p>

<h2>2. Score Breakdown</h2>
<table><tr><th>Theme</th><th>Score</th><th>Status</th></tr>{theme_html}</table>

<h2>3. Control Assessment Table</h2>
<table><tr><th>Control ID</th><th>Statement</th><th>Status</th><th>Confidence</th></tr>{controls_html}</table>

<h2>4. Identified Gaps</h2>
<table><tr><th>Gap ID</th><th>Obligation</th><th>Severity</th><th>Description</th></tr>{gaps_html}</table>

<h2>5. Remediation Tasks</h2>
<table><tr><th>Task</th><th>Owner</th><th>Status</th><th>Due Date</th></tr>{tasks_html}</table>

<h2>6. Evidence Index</h2>
<table><tr><th>Evidence ID</th><th>Source Document</th><th>Hash</th></tr>{evidence_html}</table>

<h2>7. Approval Log</h2>
<table><tr><th>Approver</th><th>Role</th><th>Date</th><th>Action</th></tr>{approvals_html}</table>

<p class="disclaimer">This report reflects automated and manual evaluation of uploaded documentation. It does not constitute legal advice.</p>
</body></html>"""
    
    from weasyprint import HTML
    pdf_bytes = HTML(string=html).write_pdf()
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=eenera-report-{assessment_id[:8]}.pdf"}
    )

# ──────────────── AUDIT LOG ROUTES ────────────────

@api_router.get("/audit-logs")
async def list_audit_logs(entity_type: str = None, entity_id: str = None, limit: int = 100):
    query = {}
    if entity_type:
        query["entity_type"] = entity_type
    if entity_id:
        query["entity_id"] = entity_id
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return logs

# ──────────────── SAMPLE DATA ROUTE ────────────────

@api_router.get("/sample-policy")
async def get_sample_policy():
    from sample_policy import SAMPLE_PRIVACY_POLICY
    return {"content": SAMPLE_PRIVACY_POLICY, "filename": "Sample SaaS Privacy Policy.txt"}

# ──────────────── INCLUDE ROUTER ────────────────

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
