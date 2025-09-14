from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import aiohttp
import asyncio

from app.services import geo_service, inaturalist_service

router = APIRouter()

class FindChunksRequest(BaseModel):
    lat: float
    lon: float
    drivetime: int
    chunkSize: float
    taxaFilter: str | None = None

@router.post("/find-chunks")
async def find_chunks(request: FindChunksRequest):
    async with aiohttp.ClientSession() as session:
        try:
            print(f"Received request: lat={request.lat}, lon={request.lon}, drivetime={request.drivetime}, chunkSize={request.chunkSize}, taxaFilter={request.taxaFilter}")
            
            # Validate required fields
            if request.lat is None or request.lon is None:
                raise HTTPException(status_code=400, detail="Latitude and longitude are required")
            if request.drivetime is None or request.drivetime <= 0:
                raise HTTPException(status_code=400, detail="Valid drivetime is required")
            if request.drivetime > 60:
                raise HTTPException(status_code=400, detail="Drivetime cannot exceed 60 minutes (Mapbox API limitation)")
            if request.chunkSize is None or request.chunkSize <= 0:
                raise HTTPException(status_code=400, detail="Valid chunk size is required")
            
            # 1. Get drivetime polygon
            print("Calling get_drivetime_isochrone...")
            isochrone = await geo_service.get_drivetime_isochrone(session, request.lat, request.lon, request.drivetime)

            # 2. Generate potential chunks within the polygon
            potential_chunks = geo_service.generate_chunks_in_isochrone(isochrone, request.chunkSize)
            
            # 3. Return all chunks - NO pre-filtering to avoid rate limiting
            print(f"Generated {len(potential_chunks)} chunks within {request.drivetime} minute drivetime")
            if request.taxaFilter:
                print(f"Taxa filter '{request.taxaFilter}' will be applied when chunks are clicked/rolled, not during discovery")
            
            return {"chunks": potential_chunks}

        except aiohttp.ClientResponseError as e:
            print(f"ClientResponseError: status={e.status}, message={e.message}")
            if "throttling" in str(e.message).lower():
                raise HTTPException(status_code=429, detail="API rate limit exceeded. Please wait a moment and try again with a smaller area or shorter drivetime.")
            else:
                raise HTTPException(status_code=e.status, detail=f"An external API error occurred: {e.message}")
        except ValueError as e:
            print(f"ValueError in find_chunks: {str(e)}")
            if "No features found" in str(e):
                raise HTTPException(status_code=400, detail=f"Unable to calculate drivetime area for {request.drivetime} minutes. Try a shorter drivetime (Mapbox limit is typically 60 minutes).")
            else:
                raise HTTPException(status_code=400, detail=f"Invalid request: {str(e)}")
        except Exception as e:
            print(f"Unexpected error in find_chunks: {type(e).__name__}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

async def filter_chunk(session, chunk, taxa_ids):
    """Helper function to run taxa filter for a single chunk."""
    # Check for iNaturalist observations if taxa filter is provided
    if taxa_ids:
        has_observations = await inaturalist_service.check_observations_in_chunk(session, chunk, taxa_ids)
        return chunk, has_observations
    
    # If no filters, chunk passes
    return chunk, True


@router.get("/observations")
async def get_observations(
    nelat: float, nelng: float, swlat: float, swlng: float,
    taxaFilter: str | None = Query(None)
):
    chunk_bounds = (swlng, swlat, nelng, nelat)
    async with aiohttp.ClientSession() as session:
        try:
            taxa_ids = None
            if taxaFilter:
                # Split comma-separated categories
                category_names = [cat.strip() for cat in taxaFilter.split(',') if cat.strip()]
                taxa_ids = await inaturalist_service.get_taxa_ids(session, category_names)
            
            observations = await inaturalist_service.get_observations_in_chunk(session, chunk_bounds, taxa_ids)
            return {"observations": observations}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@router.post("/chunk-observations")
async def get_chunk_observations(request: dict):
    """Get observations for a specific chunk bounds."""
    async with aiohttp.ClientSession() as session:
        try:
            # Extract chunk bounds and taxa filter from request
            chunk_bounds_list = request.get("chunkBounds")
            if not chunk_bounds_list:
                raise HTTPException(status_code=400, detail="Missing chunkBounds in request")
            
            chunk_bounds = tuple(chunk_bounds_list)  # (min_lon, min_lat, max_lon, max_lat)
            taxa_filter = request.get("taxaFilter")
            
            # Parse taxa filter
            taxa_ids = None
            if taxa_filter:
                category_names = [cat.strip() for cat in taxa_filter.split(',') if cat.strip()]
                taxa_ids = await inaturalist_service.get_taxa_ids(session, category_names)
                if not taxa_ids:
                    raise HTTPException(status_code=404, detail=f"No valid taxa found for filter: '{taxa_filter}'")
            
            observations = await inaturalist_service.get_observations_in_chunk(
                session, 
                chunk_bounds, 
                taxa_ids
            )
            return {"observations": observations}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
