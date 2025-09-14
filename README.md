# Adventure Chunk

Adventure Chunk shows you squares of land within driving distance that have real wildlife observations from iNaturalist.

## What it does

You enter your address and how far you're willing to drive, then it shows you chunks of land where people have actually spotted interesting wildlife. You can filter by what you're interested in (birds, plants, fungi, etc.) and either browse the map or have it randomly pick a chunk for you to explore.

The tool pulls real observation data from iNaturalist, so you know there's actually stuff to see in each area. When you click on a chunk, it shows you what's been photographed there and where exactly those photos were taken.

## Try it out

The app is live at: **https://your-domain.com** (update this when you set up your domain)

## Using it

1. Type in your address
2. Set how far you want to drive (max 60 minutes due to mapbox free tier api constrictions)
3. Pick your chunk size - bigger chunks for hiking, smaller for detailed exploration
4. Choose what you're interested in from the checkboxes
5. Click "Find Chunks" to see all the areas, or "Roll for a Chunk" for a random pick
6. Click any green square to see what's been spotted there
7. Use the export buttons to download boundaries for your phone

## Technical stuff

The backend is Python with FastAPI. It uses Mapbox for the driving distance calculations and generates a grid of squares within that area. When you want to see observations, it hits the iNaturalist API to get real data.

The frontend is React with Mapbox GL JS for the map. Everything's designed to work fast - it only makes API calls when you actually want to see observations, not during the initial chunk discovery.

## Why I built it this way

I wanted something that would work globally and show real data, not just parks from a static database. iNaturalist has observations from everywhere, and by using actual driving distances instead of straight lines, you get realistic adventure options.

The chunk export feature lets you download boundaries to your phone so you can navigate to the area offline.

## Rate limiting note

iNaturalist has rate limits, so if you're getting throttle errors, try:
- Smaller driving distances
- Larger chunk sizes
- More specific category filters

The tool includes caching and batching to minimize API calls, but very large searches might still hit limits.