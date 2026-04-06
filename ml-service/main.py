from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Intelli Sense ML Service",
    description="Machine Learning service for Retain Sense (churn) and Obtain Sense (lead scoring)",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "intelli-sense-ml"}


# Retain Sense endpoints
@app.post("/retain/predict/batch")
async def retain_predict_batch():
    """Batch churn predictions for customers."""
    return {"message": "Not implemented yet - using pre-calculated predictions from DB"}


@app.post("/retain/predict/{customer_id}")
async def retain_predict_single(customer_id: str):
    """Single customer churn prediction with SHAP values."""
    return {"message": "Not implemented yet"}


# Obtain Sense endpoints
@app.post("/obtain/score/batch")
async def obtain_score_batch():
    """Batch lead scoring."""
    return {"message": "Not implemented yet - using pre-calculated scores from DB"}


@app.post("/obtain/score/{lead_id}")
async def obtain_score_single(lead_id: str):
    """Single lead scoring with SHAP values."""
    return {"message": "Not implemented yet"}


@app.post("/obtain/icp/cluster")
async def obtain_icp_cluster():
    """Run ICP clustering."""
    return {"message": "Not implemented yet"}
