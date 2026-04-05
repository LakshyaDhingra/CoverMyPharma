from fastapi import APIRouter, UploadFile, File, Header, HTTPException
from app.services.auth_service import verify_token
from app.services.pdf_service import extract_text_from_pdf
from app.services.gemini_service import analyze_document

router = APIRouter(prefix="/api", tags=["PDF Parsing"])

@router.get("/test-gemini")
def test_gemini():
    analysis = analyze_document(
        "Patient John Doe needs Ozempic for type 2 diabetes. Insurance provider is Aetna. Prior authorization may be required."
    )
    return {"success": True, "analysis": analysis}

@router.post("/parse-pdf")
async def parse_pdf(
    file: UploadFile = File(...),
    authorization: str = Header(None),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization.split(" ", 1)[1]
    verify_token(token)

    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    file_bytes = await file.read()
    extracted_text = extract_text_from_pdf(file_bytes)

    if not extracted_text:
        raise HTTPException(status_code=400, detail="No text could be extracted from the PDF")

    analysis = analyze_document(extracted_text)

    return {
        "success": True,
        "extracted_text": extracted_text,
        "analysis": analysis,
    }