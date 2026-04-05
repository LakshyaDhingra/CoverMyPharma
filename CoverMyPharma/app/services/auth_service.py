import os
import requests
from dotenv import load_dotenv
from jose import jwt
from fastapi import HTTPException

load_dotenv()

def verify_token(token: str):
    auth0_domain = os.getenv("AUTH0_DOMAIN") or os.getenv("VITE_AUTH0_DOMAIN")
    auth0_audience = os.getenv("AUTH0_AUDIENCE") or os.getenv("VITE_AUTH0_AUDIENCE")

    if not auth0_domain or not auth0_audience:
        raise HTTPException(status_code=500, detail="Auth0 environment variables missing")

    jwks_url = f"https://{auth0_domain}/.well-known/jwks.json"
    jwks = requests.get(jwks_url, timeout=10).json()

    unverified_header = jwt.get_unverified_header(token)
    rsa_key = {}

    for key in jwks["keys"]:
        if key["kid"] == unverified_header["kid"]:
            rsa_key = {
                "kty": key["kty"],
                "kid": key["kid"],
                "use": key["use"],
                "n": key["n"],
                "e": key["e"],
            }
            break

    if not rsa_key:
        raise HTTPException(status_code=401, detail="Unable to find appropriate key")

    try:
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience=auth0_audience,
            issuer=f"https://{auth0_domain}/",
        )
        return payload
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
