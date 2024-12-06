import os

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

# DEVELOPMENT_MODE = 'DEV' in os.environ
DEVELOPMENT_MODE = True

app = FastAPI()

if DEVELOPMENT_MODE:
    # Allows accessing the api from a different origin. Required for development purposes, since the frontend will
    # be served at localhost:3000, which is a different origin than localhost:8080.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=['*'],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

import endpoints.pq
app.include_router(endpoints.pq.router)
print('[Server] Process querying endpoints registered.')

import endpoints.log_management
app.include_router(endpoints.log_management.router)
print('[Server] Event log management endpoints registered.')

import endpoints.performance
app.include_router(endpoints.performance.router)
print('[Server] Performance metrics endpoints registered.')

print('[Server] Finished registering all endpoints.')
