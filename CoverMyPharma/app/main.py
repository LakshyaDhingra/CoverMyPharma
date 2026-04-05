from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.parse_pdf import router as parse_pdf_router

app = FastAPI(title="CoverMyPharma Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(parse_pdf_router)

@app.get("/")
def root():
    return {"message": "CoverMyPharma backend is running"}