// Initialize the map
const map = L.map('map');

// Add OpenStreetMap tiles
const openStreetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

map.locate({ setView: true, maxZoom: 16 });

// Initialize MarkerCluster Group
const markersCluster = L.markerClusterGroup();
map.addLayer(markersCluster);

let clickedLocation = null;
let tempMarker = null;

const incidentIcon = L.divIcon({
    className: 'incident-marker-icon',
    html: "<div style='background-color: red; width: 20px; height: 20px; border-radius: 50%;'></div>"
});

// Function to add a submitted incident marker
function addMarker(latlng, type, description, photoFile) {
    let photoURL = '';

    if (photoFile) {
        // Create a URL for the uploaded photo
        photoURL = URL.createObjectURL(photoFile);
    }

    const marker = L.marker(latlng, { icon: incidentIcon });
    let popupContent = `<b>Type:</b> ${type}<br><b>Description:</b> ${description}`;

    if (photoURL) {
        popupContent += `<br><img src="${photoURL}" alt="Incident Photo" style="width:100%; max-height:150px; margin-top:10px; border-radius:8px;">`;
    }

    marker.bindPopup(popupContent);
    markersCluster.addLayer(marker);
}

// Handle form submission
document.getElementById('incident-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const description = document.getElementById('description').value;
    const type = document.getElementById('type').value;
    const photoFile = document.getElementById('photo').files[0];

    if (clickedLocation) {
        addMarker(clickedLocation, type, description, photoFile);
        map.removeLayer(tempMarker);
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
        map.removeLayer(tempMarker);
    }
    clickedLocation = e.latlng;
    tempMarker = L.marker(e.latlng).addTo(map).bindPopup("Location selected").openPopup();
});
