const map = L.map('map').setView([51.505, -0.09], 13);

// Add map tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

const markerClusterGroup = L.markerClusterGroup();
map.addLayer(markerClusterGroup);

let userMarker = null;

// Track User Location
navigator.geolocation.watchPosition(
    (position) => {
        const { latitude, longitude } = position.coords;

        if (userMarker) {
            userMarker.setLatLng([latitude, longitude]);
        } else {
            userMarker = L.circleMarker([latitude, longitude], {
                radius: 8,
                color: 'blue',
                fillColor: 'white',
                fillOpacity: 1,
            }).addTo(map);
        }

        map.setView([latitude, longitude], 13);
    },
    (error) => {
        console.error(error);
    },
    { enableHighAccuracy: true }
);

// Report Incident
document.getElementById('report-button').addEventListener('click', () => {
    const formModal = new bootstrap.Modal(document.getElementById('formModal'));
    formModal.show();

    document.getElementById('form-submit').onclick = () => {
        const issueType = document.getElementById('issue-type').value;
        const photoFile = document.getElementById('photo-upload').files[0];
        const marker = L.marker(map.getCenter());

        let popupContent = `<b>Issue Type:</b> ${issueType}`;
        if (photoFile) {
            const photoURL = URL.createObjectURL(photoFile);
            popupContent += `<br><img src="${photoURL}" alt="Incident Photo" style="width:100%; margin-top:10px;">`;
        }

        popupContent += `
            <br><button class="btn btn-success mt-2" onclick="shareOnWhatsApp('${issueType}')">Share on WhatsApp</button>
            <br><button class="btn btn-secondary mt-2" onclick="copyIncidentLink('${issueType}')">Copy Link</button>
        `;

        marker.bindPopup(popupContent).addTo(markerClusterGroup);
        formModal.hide();
    };
});

// WhatsApp Sharing Function
function shareOnWhatsApp(issueType) {
    const link = `https://wa.me/?text=Incident reported: ${issueType}`;
    window.open(link, '_blank');
}

// Copy Incident Link Function
function copyIncidentLink(issueType) {
    const link = `Incident Reported: ${issueType}`;
    navigator.clipboard.writeText(link).then(() => {
        alert('Incident link copied!');
    });
}

// Tab Switching
document.getElementById('map-tab').addEventListener('click', () => {
    document.getElementById('map-container').style.display = 'block';
    document.getElementById('stats-container').style.display = 'none';
    document.getElementById('map-tab').classList.add('active');
    document.getElementById('stats-tab').classList.remove('active');
});

document.getElementById('stats-tab').addEventListener('click', () => {
    document.getElementById('map-container').style.display = 'none';
    document.getElementById('stats-container').style.display = 'block';
    document.getElementById('stats-tab').classList.add('active');
    document.getElementById('map-tab').classList.remove('active');
});

// Populate Statistics
function loadStatistics() {
    const ctx = document.getElementById('incident-bar-chart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Brick Fall', 'Rubbish on Road', 'Water Leakage', 'Road Damage'],
            datasets: [{
                label: 'Number of Incidents',
                data: [12, 8, 5, 15],
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
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

document.getElementById('stats-tab').addEventListener('click', loadStatistics);
