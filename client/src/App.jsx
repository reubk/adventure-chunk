import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import axios from 'axios';
import './App.css';

// Set the public Mapbox access token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_PUBLIC_KEY;
const API_BASE_URL = 'http://localhost:8000';

function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(0); // Default to world center
  const [lat, setLat] = useState(0); // Default to world center
  const [zoom, setZoom] = useState(2);

  // Form state
  const [startAddress, setStartAddress] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [drivetime, setDrivetime] = useState(30);
  const [chunkSize, setChunkSize] = useState(1);
  const [taxaFilter, setTaxaFilter] = useState("");
  // Initialize selectedCategories from localStorage to survive HMR reloads
  const [selectedCategories, setSelectedCategories] = useState(() => {
    try {
      const saved = localStorage.getItem('adventure-chunk-categories');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.warn('Failed to load saved categories:', error);
      return [];
    }
  });

  // iNaturalist categories mapping
  const categories = [
    { value: "Aves", label: "Birds" },
    { value: "Amphibia", label: "Amphibians" },
    { value: "Reptilia", label: "Reptiles" },
    { value: "Mammalia", label: "Mammals" },
    { value: "Actinopterygii", label: "Ray-finned Fishes" },
    { value: "Mollusca", label: "Mollusks" },
    { value: "Arachnida", label: "Arachnids" },
    { value: "Insecta", label: "Insects" },
    { value: "Plantae", label: "Plants" },
    { value: "Fungi", label: "Fungi including Lichens" },
    { value: "Protozoa", label: "Protozoans" },
    { value: "Unknown", label: "Unknown" }
  ];

  // Handle category selection
  const handleCategoryChange = (categoryValue) => {
    const newCategories = selectedCategories.includes(categoryValue) 
      ? selectedCategories.filter(cat => cat !== categoryValue)
      : [...selectedCategories, categoryValue];
    
    setSelectedCategories(newCategories);
  };

  // Handle address autocomplete with debounce
  const handleAddressChange = async (e) => {
    const value = e.target.value;
    setStartAddress(value);
    
    if (value.length > 2) {
      // Clear previous timeout
      if (window.addressTimeout) {
        clearTimeout(window.addressTimeout);
      }
      
      // Set new timeout for debounced API call
      window.addressTimeout = setTimeout(async () => {
        try {
          const response = await axios.get(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json`, {
            params: { 
              access_token: mapboxgl.accessToken, 
              limit: 5,
              types: 'address,poi,place,locality,neighborhood'
            }
          });
          
          setAddressSuggestions(response.data.features.map(feature => ({
            id: feature.id,
            place_name: feature.place_name,
            center: feature.center
          })));
          setShowSuggestions(true);
        } catch (error) {
          console.error('Geocoding error:', error);
          setAddressSuggestions([]);
          setShowSuggestions(false);
        }
      }, 300); // 300ms debounce
    } else {
      setAddressSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectAddress = async (suggestion) => {
    setStartAddress(suggestion.place_name);
    setAddressSuggestions([]);
    setShowSuggestions(false);
    
    // Update map center to selected location
    if (map.current) {
      map.current.flyTo({
        center: suggestion.center,
        zoom: 12,
        duration: 1000
      });
    }
    
    // Automatically find chunks with observations if categories are selected
    if (selectedCategories.length > 0) {
      // Small delay to let the map animation finish
      setTimeout(() => {
        setMessage(`Auto-finding chunks with ${selectedCategories.join(', ')} observations...`);
        handleFindChunks();
      }, 1200);
    }
  };

  // App state
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [validChunks, setValidChunks] = useState([]);
  const [chosenChunk, setChosenChunk] = useState(null);
  const [observations, setObservations] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [selectedChunkBounds, setSelectedChunkBounds] = useState(null);

  // Save selectedCategories to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('adventure-chunk-categories', JSON.stringify(selectedCategories));
    } catch (error) {
      console.warn('Failed to save categories:', error);
    }
  }, [selectedCategories]);

  // Initialize the map
  useEffect(() => {
    if (map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: [lng, lat],
      zoom: zoom,
    });
  });

  // Function to add observation markers to the map
  // Export functions for chunk boundaries
  const exportChunkAsKML = (chunkBounds) => {
    const [min_lon, min_lat, max_lon, max_lat] = chunkBounds;
    
    const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Adventure Chunk - ${min_lat.toFixed(4)}, ${min_lon.toFixed(4)}</name>
    <description>Exported from Adventure Chunk</description>
    <Style id="chunkStyle">
      <LineStyle>
        <color>ff0000ff</color>
        <width>3</width>
      </LineStyle>
      <PolyStyle>
        <color>330000ff</color>
      </PolyStyle>
    </Style>
    <Placemark>
      <name>Adventure Chunk</name>
      <description>Chunk boundaries: ${min_lat.toFixed(6)}, ${min_lon.toFixed(6)} to ${max_lat.toFixed(6)}, ${max_lon.toFixed(6)}</description>
      <styleUrl>#chunkStyle</styleUrl>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              ${min_lon},${min_lat},0
              ${max_lon},${min_lat},0
              ${max_lon},${max_lat},0
              ${min_lon},${max_lat},0
              ${min_lon},${min_lat},0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;

    const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `adventure-chunk-${min_lat.toFixed(4)}-${min_lon.toFixed(4)}.kml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportChunkToGoogleMaps = (chunkBounds) => {
    const [min_lon, min_lat, max_lon, max_lat] = chunkBounds;
    const center_lat = (min_lat + max_lat) / 2;
    const center_lon = (min_lon + max_lon) / 2;
    
    // Create Google Maps URL with center point and zoom
    const googleMapsUrl = `https://www.google.com/maps/@${center_lat},${center_lon},16z`;
    window.open(googleMapsUrl, '_blank');
  };

  const copyChunkCoordinates = (chunkBounds) => {
    const [min_lon, min_lat, max_lon, max_lat] = chunkBounds;
    const coordText = `Adventure Chunk Coordinates:
Southwest: ${min_lat.toFixed(6)}, ${min_lon.toFixed(6)}
Northeast: ${max_lat.toFixed(6)}, ${max_lon.toFixed(6)}
Center: ${((min_lat + max_lat) / 2).toFixed(6)}, ${((min_lon + max_lon) / 2).toFixed(6)}`;
    
    navigator.clipboard.writeText(coordText).then(() => {
      alert('Coordinates copied to clipboard!');
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = coordText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Coordinates copied to clipboard!');
    });
  };

  const addObservationMarkers = (observations) => {
    // Remove existing observation markers
    if (map.current.getSource('observations')) {
      map.current.removeLayer('observations');
      map.current.removeSource('observations');
    }

    // Filter observations that have valid coordinates
    const validObservations = observations.filter(obs => 
      obs.latitude !== null && obs.longitude !== null
    );

    if (validObservations.length === 0) return;

    // Create GeoJSON for observations
    const observationsGeoJSON = {
      type: 'FeatureCollection',
      features: validObservations.map(obs => ({
        type: 'Feature',
        properties: {
          id: obs.id,
          species_guess: obs.species_guess,
          iconic_taxon_name: obs.iconic_taxon_name,
          photo_url: obs.photo_url,
          observation_url: obs.observation_url
        },
        geometry: {
          type: 'Point',
          coordinates: [obs.longitude, obs.latitude]
        }
      }))
    };

    // Add source and layer for observations
    map.current.addSource('observations', {
      type: 'geojson',
      data: observationsGeoJSON
    });

    map.current.addLayer({
      id: 'observations',
      type: 'circle',
      source: 'observations',
      paint: {
        'circle-radius': 6,
        'circle-color': '#ff6b35',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-opacity': 0.8
      }
    });

    // Add click handler for observation markers
    map.current.on('click', 'observations', (e) => {
      const coordinates = e.features[0].geometry.coordinates.slice();
      const properties = e.features[0].properties;

      // Create popup content
      const popupContent = `
        <div style="font-family: Arial, sans-serif; max-width: 200px;">
          <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #333;">
            ${properties.species_guess}
          </h3>
          <p style="margin: 0 0 5px 0; font-size: 12px; color: #666;">
            ${properties.iconic_taxon_name}
          </p>
          ${properties.photo_url ? `
            <img src="${properties.photo_url}" 
                 style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px; margin-bottom: 5px;" 
                 alt="${properties.species_guess}" />
          ` : ''}
          <a href="${properties.observation_url}" 
             target="_blank" 
             style="color: #007cbf; text-decoration: none; font-size: 12px;">
            View on iNaturalist →
          </a>
        </div>
      `;

      new mapboxgl.Popup()
        .setLngLat(coordinates)
        .setHTML(popupContent)
        .addTo(map.current);
    });

    // Change cursor on hover
    map.current.on('mouseenter', 'observations', () => {
      map.current.getCanvas().style.cursor = 'pointer';
    });

    map.current.on('mouseleave', 'observations', () => {
      map.current.getCanvas().style.cursor = '';
    });
  };

  // Function to highlight the selected chunk
  const highlightSelectedChunk = (chunkBounds) => {
    // Remove existing selected chunk highlight
    if (map.current.getSource('selected-chunk')) {
      map.current.removeLayer('selected-chunk-fill');
      map.current.removeLayer('selected-chunk-outline');
      map.current.removeSource('selected-chunk');
    }

    const [min_lon, min_lat, max_lon, max_lat] = chunkBounds;
    
    // Create GeoJSON for the selected chunk
    const selectedChunkGeoJSON = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [min_lon, min_lat],
          [max_lon, min_lat],
          [max_lon, max_lat],
          [min_lon, max_lat],
          [min_lon, min_lat]
        ]]
      }
    };

    // Add source and layers for selected chunk
    map.current.addSource('selected-chunk', {
      type: 'geojson',
      data: selectedChunkGeoJSON
    });

    // Add fill layer with bright highlight
    map.current.addLayer({
      id: 'selected-chunk-fill',
      type: 'fill',
      source: 'selected-chunk',
      paint: {
        'fill-color': '#ffff00', // Bright yellow
        'fill-opacity': 0.3
      }
    });

    // Add outline layer with strong border
    map.current.addLayer({
      id: 'selected-chunk-outline',
      type: 'line',
      source: 'selected-chunk',
      paint: {
        'line-color': '#ffff00', // Bright yellow
        'line-width': 3,
        'line-opacity': 0.8
      }
    });
  };

  // Function to add a GeoJSON source and layer to the map
  const addLayer = (id, data) => {
    if (map.current.getSource(id)) {
        map.current.getSource(id).setData(data);
    } else {
        map.current.addSource(id, { type: 'geojson', data });
        map.current.addLayer({
            id: `${id}-fill`,
            type: 'fill',
            source: id,
            paint: {
                'fill-color': id === 'chosen-chunk' ? '#f08' : '#0080ff',
                'fill-opacity': 0.5
            }
        });
        map.current.addLayer({
            id: `${id}-outline`,
            type: 'line',
            source: id,
            paint: {
                'line-color': '#fff',
                'line-width': 2
            }
        });
    }
  };

  const handleFindChunks = async () => {
    setIsLoading(true);
    setMessage("Geocoding your address...");
    setObservations([]);
    setChosenChunk(null);
    setValidChunks([]);
    setSelectedChunkBounds(null);

    try {
      if (!startAddress.trim()) {
        throw new Error("Please enter a location first.");
      }

      // 1. Geocode address to get lat/lon
      const geoResponse = await axios.get(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(startAddress)}.json`, {
        params: { access_token: mapboxgl.accessToken, limit: 1 }
      });
      if (!geoResponse.data.features.length) {
        throw new Error("Address not found. Please try another location.");
      }
      const [lon, lat] = geoResponse.data.features[0].center;

      // 2. Call our backend to find valid chunks
      setMessage(`Finding chunks within ${drivetime} mins...`);
      
      // Parse values with validation
      const parsedDrivetime = parseInt(drivetime);
      const parsedChunkSize = parseFloat(chunkSize);
      
      if (isNaN(parsedDrivetime) || parsedDrivetime <= 0) {
        throw new Error("Please enter a valid drivetime (positive number)");
      }
      if (parsedDrivetime > 60) {
        throw new Error("Drivetime cannot exceed 60 minutes due to API limitations");
      }
      if (isNaN(parsedChunkSize) || parsedChunkSize <= 0) {
        throw new Error("Please enter a valid chunk size (positive number)");
      }
      
      // Prepare the taxa filter
      const currentTaxaFilter = selectedCategories.length > 0 
        ? selectedCategories.join(',') 
        : (taxaFilter.trim() || null);

      const findChunksResponse = await axios.post(`${API_BASE_URL}/api/find-chunks`, {
        lat,
        lon,
        drivetime: parsedDrivetime,
        chunkSize: parsedChunkSize,
        taxaFilter: currentTaxaFilter
      });

      const chunks = findChunksResponse.data.chunks;
      setValidChunks(chunks);

      if (chunks.length === 0) {
        setMessage("No valid chunks found. Try increasing the drivetime or changing filters.");
        setIsLoading(false);
        return;
      }

      // 3. Display all valid chunks on the map
      const categoryText = selectedCategories.length > 0 
        ? ` with ${selectedCategories.join(', ')} observations` 
        : '';
      setMessage(`Found ${chunks.length} eligible chunks${categoryText}! Click any chunk to see observations, or "Roll for a Chunk!" to select one randomly. [Filter: ${currentTaxaFilter || 'none'}]`);
      
      // Clear any existing chunk layers and event handlers
      if (map.current.getSource('all-chunks')) {
        map.current.removeLayer('all-chunks-glow');
        map.current.removeLayer('all-chunks-fill');
        map.current.removeLayer('all-chunks-outline');
        map.current.removeSource('all-chunks');
        
        // Remove click handlers
        map.current.off('click', 'all-chunks-fill', handleChunkClick);
        map.current.off('mouseenter', 'all-chunks-fill');
        map.current.off('mouseleave', 'all-chunks-fill');
      }
      if (map.current.getSource('chosen-chunk')) {
        map.current.removeLayer('chosen-chunk-fill');
        map.current.removeLayer('chosen-chunk-outline');
        map.current.removeSource('chosen-chunk');
      }
      if (map.current.getSource('selected-chunk')) {
        map.current.removeLayer('selected-chunk-fill');
        map.current.removeLayer('selected-chunk-outline');
        map.current.removeSource('selected-chunk');
      }
      if (map.current.getSource('observations')) {
        map.current.removeLayer('observations');
        map.current.removeSource('observations');
      }
      
      // Clear any previous observations 
      setObservations([]);

      // Create GeoJSON for all chunks
      const allChunksGeoJSON = {
        type: 'FeatureCollection',
        features: chunks.map((chunk, index) => {
          const [min_lon, min_lat, max_lon, max_lat] = chunk;
          return {
            type: 'Feature',
            properties: { 
              id: index,
              min_lon: chunk[0],
              min_lat: chunk[1], 
              max_lon: chunk[2],
              max_lat: chunk[3]
            },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [min_lon, min_lat],
                [max_lon, min_lat],
                [max_lon, max_lat],
                [min_lon, max_lat],
                [min_lon, min_lat]
              ]]
            }
          };
        })
      };

      // Add all chunks to map with enhanced styling
      map.current.addSource('all-chunks', { type: 'geojson', data: allChunksGeoJSON });
      map.current.addLayer({
        id: 'all-chunks-fill',
        type: 'fill',
        source: 'all-chunks',
        paint: {
          'fill-color': '#00ff88', // Green for chunks with observations
          'fill-opacity': 0.4
        }
      });
      map.current.addLayer({
        id: 'all-chunks-outline',
        type: 'line',
        source: 'all-chunks',
        paint: {
          'line-color': '#fff',
          'line-width': 2
        }
      });
      
      // Add a subtle glow effect for chunks with observations
      map.current.addLayer({
        id: 'all-chunks-glow',
        type: 'line',
        source: 'all-chunks',
        paint: {
          'line-color': '#00ff88',
          'line-width': 4,
          'line-opacity': 0.3
        }
      });

      // Add click handler for chunks
      map.current.on('click', 'all-chunks-fill', handleChunkClick);
      map.current.on('mouseenter', 'all-chunks-fill', () => {
        map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', 'all-chunks-fill', () => {
        map.current.getCanvas().style.cursor = '';
      });

      // Fit map to show all chunks
      const bounds = chunks.reduce((acc, chunk) => {
        const [min_lon, min_lat, max_lon, max_lat] = chunk;
        return [
          [Math.min(acc[0][0], min_lon), Math.min(acc[0][1], min_lat)],
          [Math.max(acc[1][0], max_lon), Math.max(acc[1][1], max_lat)]
        ];
      }, [[180, 90], [-180, -90]]);
      
      map.current.fitBounds(bounds, { padding: 40 });

    } catch (error) {
      const errorMsg = error.response ? error.response.data.detail : error.message;
      
      // Provide helpful suggestions for rate limiting
      if (error.response?.status === 429 || errorMsg.includes('throttling')) {
        setMessage(`Rate limit exceeded. Try reducing the drivetime to 20-30 minutes or wait a moment before trying again.`);
      } else {
        setMessage(`Error: ${errorMsg}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChunkClick = async (e) => {
    // Get the clicked feature
    const feature = e.features[0];
    if (!feature) return;

    // Get the chunk bounds from the feature properties
    const props = feature.properties;
    if (!props || props.min_lon === undefined || props.min_lat === undefined || 
        props.max_lon === undefined || props.max_lat === undefined) {
      console.error('Missing chunk boundary properties:', props);
      return;
    }
    
    // Reconstruct chunkBounds array from individual properties
    const chunkBounds = [props.min_lon, props.min_lat, props.max_lon, props.max_lat];
    
    // Store the selected chunk bounds for export functionality
    setSelectedChunkBounds(chunkBounds);

    setIsLoading(true);
    setMessage("Loading observations for this chunk...");
    setObservations([]);

    try {
      // Use current selectedCategories or fallback to taxaFilter
      const taxaFilterValue = selectedCategories.length > 0 
        ? selectedCategories.join(',') 
        : (taxaFilter && taxaFilter.trim() || null);

      const payload = {
        chunkBounds: chunkBounds,
        taxaFilter: taxaFilterValue
      };
      
      // Call the new chunk observations endpoint with timeout
      const response = await axios.post(`${API_BASE_URL}/api/chunk-observations`, payload, {
        timeout: 30000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const observations = response.data.observations;
      setObservations(observations);

      // Add observation markers to the map
      addObservationMarkers(observations);

      // Highlight the selected chunk
      highlightSelectedChunk(chunkBounds);

      if (observations.length === 0) {
        setMessage("No observations found in this chunk for the selected categories.");
      } else {
        setMessage(`Found ${observations.length} observations in this chunk!`);
      }

    } catch (error) {
      console.error('=== ERROR LOADING CHUNK OBSERVATIONS ===');
      console.error('Full error:', error);
      console.error('Error response:', error.response);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      console.error('Request config:', error.config);
      console.error('Chunk bounds:', chunkBounds);
      console.error('Taxa filter:', taxaFilterValue);
      
      let errorMsg = 'Unknown error';
      if (error.response) {
        // Server responded with error status
        errorMsg = error.response.data?.detail || `Server error: ${error.response.status}`;
      } else if (error.request) {
        // Request was made but no response
        errorMsg = 'No response from server - check if backend is running';
      } else {
        // Something else happened
        errorMsg = error.message;
      }
      
      setMessage(`Error loading observations: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoll = async () => {
    if (validChunks.length === 0) {
      setMessage("Please find chunks first!");
      return;
    }

    setIsLoading(true);
    setMessage("Rolling for a chunk...");

    try {
      // Randomly select one chunk
      const randomChunkBounds = validChunks[Math.floor(Math.random() * validChunks.length)];
      setChosenChunk(randomChunkBounds);
      
      // Store the selected chunk bounds for export functionality
      setSelectedChunkBounds(randomChunkBounds);
      
      const [min_lon, min_lat, max_lon, max_lat] = randomChunkBounds;
      const chunkGeoJSON = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [min_lon, min_lat],
            [max_lon, min_lat],
            [max_lon, max_lat],
            [min_lon, max_lat],
            [min_lon, min_lat]
          ]]
        }
      };

      // Add chosen chunk layer
      addLayer('chosen-chunk', chunkGeoJSON);
      map.current.fitBounds([[min_lon, min_lat], [max_lon, max_lat]], { padding: 40 });

      // Fetch observations for the chosen chunk
      setMessage("Fetching iNaturalist observations...");
      const obsResponse = await axios.get(`${API_BASE_URL}/api/observations`, {
          params: {
              swlng: min_lon,
              swlat: min_lat,
              nelng: max_lon,
              nelat: max_lat,
              taxaFilter: selectedCategories.length > 0 ? selectedCategories.join(',') : (taxaFilter.trim() || null)
          }
      });
      setObservations(obsResponse.data.observations);
      
      // Add observation markers to the map
      addObservationMarkers(obsResponse.data.observations);
      
      // Highlight the selected chunk
      highlightSelectedChunk(randomChunkBounds);
      
      if (obsResponse.data.observations.length === 0) {
        setMessage(`No observations found in this chunk. Try rolling again or selecting different categories!`);
      } else {
        setMessage(`Found ${obsResponse.data.observations.length} observations in your chosen chunk!`);
      }

    } catch (error) {
      const errorMsg = error.response ? error.response.data.detail : error.message;
      setMessage(`Error: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {isLoading && <div className="loading-overlay">{message}</div>}
      
      <div className="sidebar controls-panel">
        <div className="header-with-info">
          <h2>Adventure Chunk</h2>
          <button 
            className="info-button"
            onClick={() => setShowInfo(true)}
            title="How to use Adventure Chunk"
          >
            ℹ️
          </button>
        </div>
        <div className="control-group">
          <label htmlFor="address">Your Location</label>
          <div className="address-input-container">
            <input 
              id="address" 
              type="text" 
              placeholder="Start typing an address anywhere in the world..."
              value={startAddress} 
              onChange={handleAddressChange}
              onFocus={() => showSuggestions && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            {showSuggestions && addressSuggestions.length > 0 && (
              <div className="address-suggestions">
                {addressSuggestions.map(suggestion => (
                  <div 
                    key={suggestion.id}
                    className="suggestion-item"
                    onClick={() => selectAddress(suggestion)}
                  >
                    {suggestion.place_name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="control-group">
          <label htmlFor="drivetime">Max Drivetime (minutes)</label>
          <input id="drivetime" type="number" min="1" max="60" value={drivetime} onChange={(e) => setDrivetime(e.target.value)} />
          <small style={{color: '#f0f0f0', fontSize: '12px', display: 'block', marginTop: '4px', textShadow: '1px 1px 2px rgba(0,0,0,0.7)'}}>
            Maximum 60 minutes due to API limitations
          </small>
        </div>
        <div className="control-group">
          <label htmlFor="chunkSize">Chunk Size (km²)</label>
          <input id="chunkSize" type="number" step="0.5" value={chunkSize} onChange={(e) => setChunkSize(e.target.value)} />
        </div>
        <div className="control-group">
          <label>Category Filter (Select multiple)</label>
          <div className="checkbox-grid">
            {categories.map(category => (
              <label key={category.value} className="checkbox-label">
                <input
                  type="checkbox"
                  value={category.value}
                  checked={selectedCategories.includes(category.value)}
                  onChange={() => handleCategoryChange(category.value)}
                />
                <span className="checkbox-text">{category.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="control-group">
          <label htmlFor="taxa">Custom Species/Taxa Filter (Optional)</label>
          <input 
            id="taxa" 
            type="text" 
            placeholder="e.g., Eucalyptus, specific species" 
            value={taxaFilter} 
            onChange={(e) => setTaxaFilter(e.target.value)}
            disabled={selectedCategories.length > 0}
          />
        </div>
        <button onClick={handleFindChunks} disabled={isLoading}>
          {isLoading ? 'Working...' : 'Find Chunks'}
        </button>
        <button onClick={handleRoll} disabled={isLoading || validChunks.length === 0}>
          {isLoading ? 'Working...' : 'Roll for a Chunk!'}
        </button>
        {!isLoading && message && <p>{message}</p>}
        
        {/* Export options for selected chunk */}
        {selectedChunkBounds && !isLoading && (
          <div className="export-options">
            <h4>Export Selected Chunk:</h4>
            <div className="export-buttons">
              <button 
                onClick={() => exportChunkAsKML(selectedChunkBounds)}
                className="export-btn"
                title="Download KML file for Google Earth, Google Maps, etc."
              >
                📄 Download KML
              </button>
              <button 
                onClick={() => exportChunkToGoogleMaps(selectedChunkBounds)}
                className="export-btn"
                title="Open in Google Maps"
              >
                🗺️ Open in Google Maps
              </button>
              <button 
                onClick={() => copyChunkCoordinates(selectedChunkBounds)}
                className="export-btn"
                title="Copy coordinates to clipboard"
              >
                📋 Copy Coordinates
              </button>
            </div>
          </div>
        )}
      </div>

      {observations.length > 0 && (
          <div className="sidebar results-panel">
              <h3>Observations in Chunk</h3>
              {observations.map(obs => (
                  <div key={obs.id} className="observation-card">
                      <img src={obs.photo_url} alt={obs.species_guess} />
                      <div className="observation-info">
                          <a href={obs.observation_url} target="_blank" rel="noopener noreferrer">
                              {obs.species_guess}
                          </a>
                          <span>{obs.iconic_taxon_name}</span>
                      </div>
                  </div>
              ))}
          </div>
      )}
      
      <div ref={mapContainer} className="map-container" />
      
      {showInfo && (
        <div className="info-modal-overlay" onClick={() => setShowInfo(false)}>
          <div className="info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="info-header">
              <h3>🗺️ How to Use Adventure Chunk</h3>
              <button className="close-button" onClick={() => setShowInfo(false)}>✕</button>
            </div>
            <div className="info-content">
              <h4>What is Adventure Chunk?</h4>
              <p>Adventure Chunk helps you discover interesting nature spots near you! It shows you square areas (chunks) within driving distance that have real wildlife observations from iNaturalist.</p>
              
              <h4>Quick Start Guide:</h4>
              <ol>
                <li><strong>Enter your location</strong> - Type any address and pick from the suggestions</li>
                <li><strong>Set your travel distance</strong> - How far are you willing to drive? (in minutes)</li>
                <li><strong>Choose chunk size</strong> - Pick your preferred exploration area size</li>
                <li><strong>Choose what you're interested in</strong> - Select categories like Birds, Plants, Fungi, etc.</li>
                <li><strong>Find chunks!</strong> - Click "Find Chunks" to see all available squares in your area</li>
                <li><strong>Explore!</strong> - Click any green square to see what's been spotted there, or hit "Roll for a Chunk!" for a surprise</li>
              </ol>
              
              <h4>What You'll See:</h4>
              <ul>
                <li><strong>Green squares</strong> = Areas with wildlife observations matching your interests</li>
                <li><strong>Yellow highlight</strong> = The chunk you've selected to explore</li>
                <li><strong>Orange dots</strong> = Exact locations where animals/plants were photographed</li>
                <li><strong>Click orange dots</strong> for photos and details!</li>
              </ul>
              
              <h4>Export to Your Phone:</h4>
              <ol>
                <li><strong>Select a chunk</strong> - Click any green square or roll for one</li>
                <li><strong>Download KML</strong> - Click "📄 Download KML" to get the boundary file</li>
                <li><strong>Share to your phone</strong> - Email or send the KML file to yourself</li>
                <li><strong>Open in Google Maps</strong> - Tap the KML file on your phone and choose "Open with Google Maps"</li>
                <li><strong>Navigate!</strong> - The chunk boundary will appear on your map for easy navigation</li>
              </ol>
              
              <h4>Pro Tips:</h4>
              <ul>
                <li>Start with a 30-minute drive time for good results</li>
                <li>Try different categories - you might discover something unexpected!</li>
                <li>Larger chunks are better for hiking, smaller ones for detailed exploration</li>
                <li>Check the iNaturalist links for more details about each species</li>
                <li>KML files also work with Apple Maps, GPS apps, and Google Earth!</li>
              </ul>
              
              <p><strong>Happy exploring!</strong></p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
