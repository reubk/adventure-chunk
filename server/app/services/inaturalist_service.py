import aiohttp
import hashlib
import json
from datetime import datetime, timedelta

# Simple in-memory cache for chunk observations
_chunk_cache = {}
CACHE_DURATION = timedelta(hours=2)  # Cache for 2 hours

def _get_cache_key(chunk_bounds: tuple, taxa_ids: list[int] | None) -> str:
    """Generate a cache key for chunk bounds and taxa filter."""
    key_data = {
        "bounds": chunk_bounds,
        "taxa": sorted(taxa_ids) if taxa_ids else None
    }
    return hashlib.md5(json.dumps(key_data, sort_keys=True).encode()).hexdigest()

def _is_cache_valid(timestamp: datetime) -> bool:
    """Check if cache entry is still valid."""
    return datetime.now() - timestamp < CACHE_DURATION

async def get_taxa_ids(session: aiohttp.ClientSession, taxa_names: list) -> list[int]:
    """Gets taxon IDs for multiple scientific or common names."""
    taxon_ids = []
    
    # Map common category names to their scientific names for better API results
    category_mapping = {
        "Aves": "Aves",
        "Amphibia": "Amphibia", 
        "Reptilia": "Reptilia",
        "Mammalia": "Mammalia",
        "Actinopterygii": "Actinopterygii",
        "Mollusca": "Mollusca",
        "Arachnida": "Arachnida",
        "Insecta": "Insecta",
        "Plantae": "Plantae",
        "Fungi": "Fungi",
        "Protozoa": "Protozoa",
        "Unknown": "Unknown"
    }
    
    for taxa_name in taxa_names:
        url = "https://api.inaturalist.org/v1/taxa"
        
        # Use mapped name if available, otherwise use the original
        search_term = category_mapping.get(taxa_name, taxa_name)
        
        params = {"q": search_term, "is_active": "true"} # Search all ranks
        async with session.get(url, params=params, ssl=False) as response:
            response.raise_for_status()
            data = await response.json()
            print(f"iNaturalist taxa API response for '{taxa_name}': {data}")
            if data and 'results' in data and data['results']:
                taxon_ids.append(data['results'][0]['id'])
    
    return taxon_ids

async def check_observations_in_chunk(session: aiohttp.ClientSession, chunk_bounds: tuple, taxa_ids: list[int] | None) -> bool:
    """Checks if there's at least one verifiable observation in a chunk with caching."""
    # Check cache first
    cache_key = _get_cache_key(chunk_bounds, taxa_ids)
    if cache_key in _chunk_cache:
        cached_result, timestamp = _chunk_cache[cache_key]
        if _is_cache_valid(timestamp):
            print(f"Cache HIT for chunk {chunk_bounds[:2]}...")
            return cached_result
        else:
            # Remove expired cache entry
            del _chunk_cache[cache_key]
    
    print(f"Cache MISS - API call for chunk {chunk_bounds[:2]}...")
    
    min_lon, min_lat, max_lon, max_lat = chunk_bounds
    url = "https://api.inaturalist.org/v1/observations"
    params = {
        "nelat": max_lat,
        "nelng": max_lon,
        "swlat": min_lat,
        "swlng": min_lon,
        "verifiable": "true",
        "per_page": 1 # We only need to know if at least one exists
    }
    if taxa_ids and len(taxa_ids) > 0:
        params["taxon_id"] = ",".join(map(str, taxa_ids))

    async with session.get(url, params=params, ssl=False) as response:
        response.raise_for_status()
        data = await response.json()
        result = data.get('total_results', 0) > 0 if data else False
        
        # Cache the result
        _chunk_cache[cache_key] = (result, datetime.now())
        print(f"Cached result for chunk {chunk_bounds[:2]}: {result}")
        
        return result

async def get_observations_in_chunk(session: aiohttp.ClientSession, chunk_bounds: tuple, taxa_ids: list[int] | None):
    """Gets all verifiable observations for a given chunk."""
    min_lon, min_lat, max_lon, max_lat = chunk_bounds
    url = "https://api.inaturalist.org/v1/observations"
    params = {
        "nelat": max_lat,
        "nelng": max_lon,
        "swlat": min_lat,
        "swlng": min_lon,
        "verifiable": "true",
        "per_page": 200, # Max allowed per page
        "order": "desc",
        "order_by": "observed_on",
        "photos": "true" # Ensure observations have photos
    }
    if taxa_ids and len(taxa_ids) > 0:
        params["taxon_id"] = ",".join(map(str, taxa_ids))
        
    async with session.get(url, params=params, ssl=False) as response:
        response.raise_for_status()
        data = await response.json()
        print(f"iNaturalist observations response: {data}")
        
        if not data or 'results' not in data:
            return []
        
        # Format the results for the frontend
        formatted_results = []
        for obs in data.get("results", []):
            if not obs or not obs.get("photos"):
                continue
            
            # Filter out observations without titles/species_guess
            species_guess = obs.get("species_guess") or ""
            if not species_guess or not species_guess.strip() or species_guess.strip().lower() in ["unknown", "n/a", "unidentified"]:
                continue
            species_guess = species_guess.strip()
                
            try:
                # Get location coordinates
                location = obs.get("location")
                lat, lon = None, None
                if location:
                    try:
                        lat, lon = map(float, location.split(","))
                    except (ValueError, AttributeError):
                        pass
                
                formatted_results.append({
                    "id": obs.get("id", "N/A"),
                    "species_guess": species_guess,
                    "iconic_taxon_name": obs.get("taxon", {}).get("iconic_taxon_name", "Unknown") if obs.get("taxon") else "Unknown",
                    "photo_url": obs["photos"][0]["url"].replace("square", "medium") if obs.get("photos") and len(obs["photos"]) > 0 else None,
                    "observation_url": obs.get("uri", "#"),
                    "latitude": lat,
                    "longitude": lon
                })
            except Exception as e:
                print(f"Error formatting observation: {e}")
                continue
        
        return formatted_results
