// Initialize the map and set a default view (centered on New York City)
const map = L.map('map').setView([40.7128, -74.0060], 13);

// Add OpenStreetMap tiles to the map
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

// Initialize MarkerCluster Group with custom options
const markersCluster = L.markerClusterGroup({
    maxClusterRadius: 50,           // Distance within which points are clustered (in pixels)
    spiderfyOnMaxZoom: true,        // Show individual markers when zoomed in
    showCoverageOnHover: false,     // Disable the highlight of the cluster area when hovered
    zoomToBoundsOnClick: true       // Zoom to cluster bounds when clicking on a cluster
});

// Add the cluster group to the map
map.addLayer(markersCluster);

// Array to store markers with type information
const markers = [];

// Variable to store the clicked marker location
let clickedMarker = null;

// Handle form submission to add markers with incident details
const form = document.getElementById('incident-form');
form.addEventListener('submit', function (e) {
    e.preventDefault();

    const description = document.getElementById('description').value;
    const type = document.getElementById('type').value;

    if (clickedMarker) {
        // Customize marker color based on incident type
        const icon = getCustomIcon(type);
        clickedMarker.setIcon(icon);

        // Bind popup with the description and type to the marker
        clickedMarker.bindPopup(`<b>Type:</b> ${type}<br><b>Description:</b> ${description}`).openPopup();

        // Add the marker to the cluster group and the markers array
        markersCluster.addLayer(clickedMarker);
        markers.push({ marker: clickedMarker, type });

        // Reset the clicked marker
        clickedMarker = null;
    } else {
        alert("Please click on the map to set the incident location.");
    }

    // Clear the form input fields
    form.reset();
});

// Allow users to click on the map to set the incident location
map.on('click', function (e) {
    if (clickedMarker) {
        // Remove the previous marker if it exists
        map.removeLayer(clickedMarker);
    }

    // Add a new marker at the clicked location with a custom color for selection
    clickedMarker = L.marker(e.latlng, { icon: getCustomIcon('selected') }).addTo(map).bindPopup("Selected Location").openPopup();
});

// Filter incidents based on type
const filterSelect = document.getElementById('filter-type');
filterSelect.addEventListener('change', function () {
    const selectedType = filterSelect.value;

    // Clear the current cluster group
    markersCluster.clearLayers();

    // Re-add markers that match the selected type
    markers.forEach(({ marker, type }) => {
        if (selectedType === 'all' || type === selectedType) {
            markersCluster.addLayer(marker);
        }
    });
});

// Detect user location and center the map
const locateButton = document.getElementById('locate-button');
locateButton.addEventListener('click', function () {
    map.locate({ setView: true, maxZoom: 16 });
});

// Handle successful location detection
map.on('locationfound', function (e) {
    L.marker(e.latlng, { icon: getCustomIcon('user') }).addTo(map).bindPopup("You are here!").openPopup();
});

// Handle location detection errors
map.on('locationerror', function () {
    alert("Unable to access your location. Please ensure location services are enabled.");
});

// Function to create custom icons based on type
function getCustomIcon(type) {
    let color;
    switch (type) {
        case 'traffic':
            color = 'blue';
            break;
        case 'crime':
            color = 'red';
            break;
        case 'hazard':
            color = 'orange';
            break;
        case 'user':
            color = 'green';
            break;
        case 'selected':
            color = 'purple';
            break;
        default:
            color = 'gray';
    }

    return L.divIcon({
        className: `custom-marker-${color}`,
        html: `<div style='background-color: ${color}; width: 16px; height: 16px; border-radius: 50%;'></div>`
    });
}
