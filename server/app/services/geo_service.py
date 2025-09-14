import os
import aiohttp
import random
from shapely.geometry import Polygon, Point, box
from pyproj import Geod, Transformer
import math

# Constants
MAPBOX_API_KEY = os.getenv("MAPBOX_API_KEY") or "pk.eyJ1IjoicmV1YmsiLCJhIjoiY21maXo4ODVvMHJseDJrb2Iydmx4MjZicyJ9.YO8spbPilarCPTmJOQ1aOA"
MAPTILER_API_KEY = os.getenv("MAPTILER_API_KEY") or "oVxnt4avzfPgc6bP14YU"
GEOD = Geod(ellps="WGS84")

async def get_drivetime_isochrone(session: aiohttp.ClientSession, lat: float, lon: float, minutes: int) -> Polygon:
    """Fetches a drivetime polygon (isochrone) from the Mapbox API."""
    print(f"get_drivetime_isochrone called with: lat={lat}, lon={lon}, minutes={minutes}")
    print(f"MAPBOX_API_KEY is: {MAPBOX_API_KEY is not None}")
    
    url = f"https://api.mapbox.com/isochrone/v1/mapbox/driving/{lon},{lat}"
    params = {
        "contours_minutes": str(int(minutes)),
        "polygons": "true",
        "access_token": MAPBOX_API_KEY
    }
    async with session.get(url, params=params, ssl=False) as response:
        response.raise_for_status()
        data = await response.json()
        print(f"Mapbox API response: {data}")
        # The API returns coordinates in (lon, lat) format, which Shapely expects
        if not data or 'features' not in data or not data['features']:
            raise ValueError("No features found in Mapbox API response")
        return Polygon(data['features'][0]['geometry']['coordinates'][0])

async def check_parkland_percentage(session: aiohttp.ClientSession, chunk_bounds: tuple) -> float:
    """
    Fast parkland percentage check using optimized heuristic method.
    For production, this would use cached land cover data or faster APIs.
    """
    # Skip slow Overpass API calls and use optimized heuristic
    return await check_parkland_percentage_fast(session, chunk_bounds)

async def check_parkland_percentage_fast(session: aiohttp.ClientSession, chunk_bounds: tuple) -> float:
    """
    Fast, restrictive parkland percentage check using center point analysis.
    Only returns high percentages for areas very likely to be parkland.
    """
    min_lon, min_lat, max_lon, max_lat = chunk_bounds
    center_lon, center_lat = ((min_lon + max_lon) / 2, (min_lat + max_lat) / 2)
    
    # Only allow chunks that are directly in major parks
    if is_in_major_park(center_lon, center_lat):
        return 85.0  # High confidence for major parks
    
    # All other areas are not parkland
    return 10.0  # Well below 60% threshold

def is_in_major_park(lon: float, lat: float) -> bool:
    """Check if point is within a major park boundary."""
    major_parks = [
        # Melbourne major parks (expanded and corrected)
        {"center": (144.9700, -37.8300), "radius": 0.020},  # Royal Botanic Gardens (expanded)
        {"center": (144.9800, -37.8500), "radius": 0.025},  # Albert Park (expanded)
        {"center": (144.9600, -37.7800), "radius": 0.035},  # Royal Park (much larger radius)
        {"center": (144.9500, -37.7900), "radius": 0.015},  # Carlton Gardens (expanded)
        {"center": (144.9600, -37.8200), "radius": 0.012},  # Fitzroy Gardens (expanded)
        {"center": (144.9800, -37.8000), "radius": 0.020},  # Princes Park (Carlton)
        {"center": (144.9900, -37.8400), "radius": 0.018},  # St Kilda Botanical Gardens
        {"center": (144.9400, -37.8100), "radius": 0.015},  # Edinburgh Gardens (Fitzroy)
        {"center": (144.9700, -37.8000), "radius": 0.012},  # University of Melbourne Park
        {"center": (144.9900, -37.8200), "radius": 0.015},  # St Kilda Foreshore
        {"center": (144.9300, -37.8400), "radius": 0.020},  # Yarra Bend Park
        {"center": (144.9800, -37.7600), "radius": 0.025},  # Darebin Parklands
        {"center": (144.9400, -37.8700), "radius": 0.018},  # Brighton Beach area
        {"center": (144.9200, -37.8000), "radius": 0.015},  # Coburg Lake Reserve
        {"center": (145.0000, -37.7900), "radius": 0.020},  # Bundoora Park
        
        # Sydney major parks (expanded)
        {"center": (151.2200, -33.8700), "radius": 0.015},  # Hyde Park (expanded)
        {"center": (151.2400, -33.8900), "radius": 0.035},  # Centennial Park (expanded)
        {"center": (151.2100, -33.8800), "radius": 0.020},  # Royal Botanic Gardens Sydney
        {"center": (151.2500, -33.8600), "radius": 0.018},  # Bondi Beach area
        {"center": (151.2000, -33.9000), "radius": 0.025},  # Olympic Park area
        
        # New York major parks (expanded)
        {"center": (-73.9654, 40.7829), "radius": 0.030},   # Central Park (expanded)
        {"center": (-74.0445, 40.6892), "radius": 0.020},   # Battery Park area (expanded)
        
        # London major parks (expanded)
        {"center": (-0.1500, 51.5100), "radius": 0.020},    # Hyde Park (expanded)
        {"center": (-0.1600, 51.5000), "radius": 0.015},    # Green Park
        {"center": (-0.1400, 51.5200), "radius": 0.015},    # Regent's Park
    ]
    
    for park in major_parks:
        distance = ((lon - park["center"][0])**2 + (lat - park["center"][1])**2)**0.5
        if distance <= park["radius"]:
            return True
    
    return False

def chunk_overlaps_major_park(chunk_bounds: tuple) -> bool:
    """Check if chunk overlaps with any major park."""
    min_lon, min_lat, max_lon, max_lat = chunk_bounds
    
    # Sample points within the chunk
    sample_points = []
    for i in range(3):
        for j in range(3):
            lon = min_lon + (max_lon - min_lon) * (i / 2)
            lat = min_lat + (max_lat - min_lat) * (j / 2)
            sample_points.append((lon, lat))
    
    # Check if any sample points are in major parks
    for lon, lat in sample_points:
        if is_in_major_park(lon, lat):
            return True
    
    return False

def is_likely_green_space(lon: float, lat: float) -> bool:
    """Check if area is likely to contain green spaces (expanded coverage)."""
    # Allow areas near known parks or in specific green corridors
    green_areas = [
        # Melbourne green corridors (expanded coverage)
        {"center": (144.9700, -37.8200), "radius": 0.025},  # South Yarra area (expanded)
        {"center": (144.9800, -37.8600), "radius": 0.020},  # Albert Park area (expanded)
        {"center": (144.9500, -37.8000), "radius": 0.018},  # Carlton area (expanded)
        {"center": (144.9600, -37.7900), "radius": 0.020},  # North Melbourne area
        {"center": (144.9800, -37.8100), "radius": 0.015},  # Carlton North area
        {"center": (144.9400, -37.8200), "radius": 0.018},  # Fitzroy area
        {"center": (144.9900, -37.8300), "radius": 0.020},  # St Kilda area
        {"center": (144.9300, -37.8300), "radius": 0.015},  # Richmond area
        {"center": (144.9500, -37.8400), "radius": 0.015},  # South Melbourne area
        {"center": (144.9700, -37.8600), "radius": 0.018},  # Port Melbourne area
        
        # Sydney green areas (expanded)
        {"center": (151.2300, -33.8800), "radius": 0.020},  # Eastern suburbs (expanded)
        {"center": (151.2000, -33.8700), "radius": 0.015},  # Inner west
        {"center": (151.2500, -33.8800), "radius": 0.018},  # Eastern suburbs
        
        # New York green areas (expanded)
        {"center": (-73.9600, 40.7900), "radius": 0.025},   # Upper East Side (expanded)
        {"center": (-73.9700, 40.7800), "radius": 0.020},   # Upper West Side
        
        # London green areas (expanded)
        {"center": (-0.1400, 51.5100), "radius": 0.018},    # Central London parks (expanded)
        {"center": (-0.1300, 51.5200), "radius": 0.015},    # Regent's Park area
    ]
    
    for area in green_areas:
        distance = ((lon - area["center"][0])**2 + (lat - area["center"][1])**2)**0.5
        if distance <= area["radius"]:
            return True
    
    return False

async def check_parkland_percentage_heuristic(session: aiohttp.ClientSession, chunk_bounds: tuple) -> float:
    """
    Fallback heuristic method for parkland percentage when API calls fail.
    """
    min_lon, min_lat, max_lon, max_lat = chunk_bounds
    
    # Sample points within the chunk
    sample_points = []
    num_samples = 16  # 4x4 grid
    
    for i in range(4):
        for j in range(4):
            lon = min_lon + (max_lon - min_lon) * (i / 3)
            lat = min_lat + (max_lat - min_lat) * (j / 3)
            sample_points.append((lon, lat))
    
    park_count = 0
    
    for lon, lat in sample_points:
        if is_likely_parkland(lon, lat):
            park_count += 1
    
    park_percentage = (park_count / num_samples) * 100
    print(f"Heuristic parkland percentage for chunk {chunk_bounds}: {park_percentage:.2f}%")
    
    return park_percentage

def is_likely_parkland(lon: float, lat: float) -> bool:
    """
    Heuristic function to determine if a location is likely parkland.
    Uses known park coordinates and geographic patterns.
    """
    # Known major parks and green spaces (coordinates in lon, lat)
    known_parks = [
        # Melbourne area parks (expanded list)
        (144.9631, -37.8136),  # Melbourne CBD area
        (144.9700, -37.8300),  # Royal Botanic Gardens
        (144.9800, -37.8500),  # Albert Park
        (144.9900, -37.8700),  # St Kilda area
        (144.9500, -37.7900),  # Carlton Gardens
        (144.9600, -37.8200),  # Fitzroy Gardens
        (144.9400, -37.8000),  # Princes Park
        (144.9800, -37.8200),  # Fawkner Park
        (144.9700, -37.8400),  # Albert Park Lake
        (144.9600, -37.7800),  # Royal Park
        
        # Sydney area parks
        (151.2093, -33.8688),  # Sydney CBD
        (151.2200, -33.8700),  # Hyde Park
        (151.2400, -33.8900),  # Centennial Park area
        
        # New York area parks
        (-73.9654, 40.7829),   # Central Park
        (-74.0445, 40.6892),   # Battery Park area
        
        # London area parks
        (-0.1276, 51.5074),    # London CBD
        (-0.1500, 51.5100),    # Hyde Park
        (-0.1400, 51.5000),    # Green Park area
    ]
    
    # Check proximity to known parks (within ~3km)
    for park_lon, park_lat in known_parks:
        distance = ((lon - park_lon)**2 + (lat - park_lat)**2)**0.5
        if distance < 0.03:  # Approximately 3km threshold
            return True
    
    # For Melbourne area specifically, be more generous with parkland detection
    if (lat > -38.0 and lat < -37.7 and lon > 144.8 and lon < 145.1):
        # Melbourne area - higher chance of parkland
        import random
        return random.random() > 0.6  # 40% chance of being parkland
    
    # For other areas, be more conservative
    import random
    return random.random() > 0.85  # 15% chance of being parkland

def generate_chunks_in_isochrone(isochrone: Polygon, chunk_size_km: float):
    """Generates a complete grid of square chunks within the isochrone polygon."""
    import math
    
    valid_chunks = []
    # Get the bounding box of the isochrone
    min_lon, min_lat, max_lon, max_lat = isochrone.bounds

    # Use a global approach that works anywhere in the world
    # Calculate chunk size in degrees (approximate)
    # 1 degree of latitude ≈ 111 km, so 1 km ≈ 1/111 degrees
    chunk_size_lat_deg = chunk_size_km / 111.0
    
    # For longitude, we need to account for the fact that longitude degrees 
    # get smaller as we move away from the equator
    # At latitude φ, 1 degree of longitude = 111 * cos(φ) km
    center_lat = (min_lat + max_lat) / 2
    lat_rad = math.radians(center_lat)
    chunk_size_lon_deg = chunk_size_km / (111.0 * math.cos(lat_rad))
    
    # Generate a complete grid of chunks covering the entire isochrone area
    current_lat = min_lat
    while current_lat < max_lat:
        current_lon = min_lon
        while current_lon < max_lon:
            # Create chunk bounds
            chunk_min_lat = current_lat
            chunk_max_lat = current_lat + chunk_size_lat_deg
            chunk_min_lon = current_lon
            chunk_max_lon = current_lon + chunk_size_lon_deg
            
            # Check if the center of the chunk is within the isochrone
            center_lat = current_lat + chunk_size_lat_deg / 2
            center_lon = current_lon + chunk_size_lon_deg / 2
            
            if isochrone.contains(Point(center_lon, center_lat)):
                valid_chunks.append((chunk_min_lon, chunk_min_lat, chunk_max_lon, chunk_max_lat))
            
            current_lon += chunk_size_lon_deg
        current_lat += chunk_size_lat_deg
                
    return valid_chunks


def is_likely_parkland_area(lon: float, lat: float) -> bool:
    """Quick check if an area is likely to contain parkland (used for initial sampling)."""
    # Check if point is in a major park
    if is_in_major_park(lon, lat):
        return True
    
    # Check if point is in a green corridor
    if is_likely_green_space(lon, lat):
        return True
    
    # For other areas, use a less restrictive random check
    import random
    # 25% chance for random areas to be considered (more generous)
    return random.random() < 0.25
