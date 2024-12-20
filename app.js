// Initialize the map without a default view
const map = L.map('map');

// Add OpenStreetMap default tiles
const openStreetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Center the map on the user's current location when the site loads
map.locate({ setView: true, maxZoom: 16 });

// Initialize MarkerCluster Group
const markersCluster = L.markerClusterGroup();
map.addLayer(markersCluster);

// Array to store markers and their data
const markers = [];
let clickedLocation = null;
let tempMarker = null;

// Custom icons for different markers
const tempIcon = L.divIcon({
    className: 'temp-marker-icon',
    html: "<div style='background-color: blue; width: 20px; height: 20px; border-radius: 50%;'></div>"
});

const incidentIcon = L.divIcon({
    className: 'incident-marker-icon',
    html: "<div style='background-color: red; width: 20px; height: 20px; border-radius: 50%;'></div>"
});

// Chart.js instance
let incidentChart;

// Function to add a submitted incident marker
function addMarker(latlng, type, description) {
    const marker = L.marker(latlng, { icon: incidentIcon });
    marker.bindPopup(`<b>Type:</b> ${type}<br><b>Description:</b> ${description}`);
    markersCluster.addLayer(marker);
    markers.push({ latlng, type, description });
    updateDashboard();
}

// Handle form submission
document.getElementById('incident-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const description = document.getElementById('description').value;
    const type = document.getElementById('type').value;

    if (clickedLocation) {
        addMarker(clickedLocation, type, description);
        map.removeLayer(tempMarker); // Remove the temporary marker after submission
        clickedLocation = null;
        tempMarker = null;
    } else {
        alert("Please click on the map to select a location for the incident.");
    }

    e.target.reset();
});

// Allow users to click on the map to set the incident location
map.on('click', function (e) {
    if (tempMarker) {
        map.removeLayer(tempMarker); // Remove the previous temporary marker
    }
    clickedLocation = e.latlng;
    tempMarker = L.marker(e.latlng, { icon: tempIcon }).addTo(map).bindPopup("Location selected").openPopup();
});

// Update the dashboard with incident statistics
function updateDashboard() {
    const totalIncidents = markers.length;
    const typeCounts = { traffic: 0, crime: 0, hazard: 0 };

    markers.forEach(({ type }) => {
        if (typeCounts[type] !== undefined) {
            typeCounts[type]++;
        }
    });

    document.getElementById('total-incidents').innerText = totalIncidents;
    document.getElementById('traffic-count').innerText = typeCounts['traffic'];
    document.getElementById('crime-count').innerText = typeCounts['crime'];
    document.getElementById('hazard-count').innerText = typeCounts['hazard'];

    // Update Chart
    if (incidentChart) {
        incidentChart.destroy();
    }

    const ctx = document.getElementById('incidentChart').getContext('2d');
    incidentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Traffic', 'Crime', 'Hazard'],
            datasets: [{
                label: 'Incident Count',
                data: [typeCounts['traffic'], typeCounts['crime'], typeCounts['hazard']],
                backgroundColor: ['#007bff', '#dc3545', '#ffc107']
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Search for a location
document.getElementById('search-button').addEventListener('click', function () {
    const query = document.getElementById('search-input').value;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                const { lat, lon } = data[0];
                map.setView([lat, lon], 14);
            } else {
                alert("Location not found. Please try again.");
            }
        });
});
