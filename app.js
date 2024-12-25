/***********************************************
 *  GLOBALS & INITIAL SETUP
 ***********************************************/
let map;
let userMarker = null;
let currentPosition = null;
const markerClusterGroup = L.markerClusterGroup();

// For chart data
let incidentsData = {};
// For storing full incident objects
let incidents = [];
// For storing up/down votes
let incidentsVotes = {};
// For referencing the chart (so we can re-create)
let incidentChart = null;

/***********************************************
 *  INIT MAP & GEOLOCATION
 ***********************************************/
navigator.geolocation.getCurrentPosition(
  (pos) => {
    const { latitude, longitude } = pos.coords;
    currentPosition = [latitude, longitude];

    // Initialize map at user's location
    map = L.map('map').setView(currentPosition, 15);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Add cluster group
    map.addLayer(markerClusterGroup);

    // Create user marker with rotated marker plugin
    const userIcon = L.icon({
      iconUrl: 'arrow.png', // ensure arrow.png is in your folder
      iconSize: [32, 32],
    });
    userMarker = L.marker(currentPosition, {
      icon: userIcon,
      rotationAngle: 0,
      rotationOrigin: 'center center'
    }).addTo(map);

    // Also watch for position changes
    watchLocationUpdates();

    // Listen for device orientation (to rotate user marker)
    enableDeviceOrientation();
  },
  (err) => {
    console.error('Geolocation error:', err);
    // Fallback if no location
    initMapFallback();
  },
  { enableHighAccuracy: true }
);

function initMapFallback() {
  map = L.map('map').setView([53.8, -1.5], 10); // fallback near Leeds
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  map.addLayer(markerClusterGroup);

  watchLocationUpdates();
  enableDeviceOrientation();
}

function watchLocationUpdates() {
  navigator.geolocation.watchPosition(
    (pos) => {
      currentPosition = [pos.coords.latitude, pos.coords.longitude];
      if (userMarker) {
        userMarker.setLatLng(currentPosition);
      }
    },
    (error) => console.log('watchPosition error:', error),
    { enableHighAccuracy: true }
  );
}

/***********************************************
 *  DEVICE ORIENTATION -> ROTATE MARKER
 ***********************************************/
function enableDeviceOrientation() {
  window.addEventListener('deviceorientation', (event) => {
    let heading = event.alpha;
    // iOS might use webkitCompassHeading
    if (typeof event.webkitCompassHeading === 'number') {
      heading = event.webkitCompassHeading;
    }
    if (userMarker && heading != null) {
      userMarker.setRotationAngle(heading);
    }
  }, true);
}

/***********************************************
 *  TAB SWITCHING
 ***********************************************/
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

  loadStatistics();
});

/***********************************************
 *  REPORT INCIDENT (MODAL)
 ***********************************************/
document.getElementById('report-button').addEventListener('click', () => {
  const formModal = new bootstrap.Modal(document.getElementById('formModal'));
  formModal.show();
});

document.getElementById('form-submit').onclick = () => {
  if (!currentPosition) {
    alert('Unable to detect your current location. Please enable location services.');
    return;
  }

  const issueType = document.getElementById('issue-type').value;
  const photoFile = document.getElementById('photo-upload').files[0];

  // Generate unique ID
  const incidentId = 'incident-' + Date.now();
  incidentsVotes[incidentId] = { up: 0, down: 0 };

  // Update stats data
  if (!incidentsData[issueType]) {
    incidentsData[issueType] = 0;
  }
  incidentsData[issueType] += 1;

  const reportedTime = new Date().toLocaleString();

  // Build incident object
  const incObj = {
    id: incidentId,
    type: issueType,
    time: reportedTime,
    lat: currentPosition[0],
    lng: currentPosition[1],
    photoURL: null
  };

  // If a photo is provided
  if (photoFile) {
    incObj.photoURL = URL.createObjectURL(photoFile);
  }

  // Add to incidents array
  incidents.push(incObj);

  // Create marker
  const marker = L.marker([incObj.lat, incObj.lng]);
  markerClusterGroup.addLayer(marker);

  // On marker click, show side panel
  marker.on('click', () => {
    showIncidentPanel(incObj);
  });

  // Close modal
  const formModal = bootstrap.Modal.getInstance(document.getElementById('formModal'));
  formModal.hide();
};

/***********************************************
 *  STATISTICS (Chart.js)
 ***********************************************/
function loadStatistics() {
  if (incidentChart) {
    incidentChart.destroy();
  }
  const ctx = document.getElementById('incident-bar-chart').getContext('2d');
  const labels = Object.keys(incidentsData);
  const data = Object.values(incidentsData);

  incidentChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Number of Incidents',
          data: data,
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
          barPercentage: 0.3,
          categoryPercentage: 0.5,
          maxBarThickness: 30
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            precision: 0
          }
        }
      }
    }
  });
}

/***********************************************
 *  SIDE PANEL LOGIC
 ***********************************************/
const incidentPanel = document.getElementById('incident-panel');
const incidentContent = document.getElementById('incident-content');
const closePanelBtn = document.getElementById('close-panel-btn');

closePanelBtn.addEventListener('click', () => {
  hideIncidentPanel();
});

function showIncidentPanel(incident) {
  const incId = incident.id;
  const votes = incidentsVotes[incId];
  const upCount = votes ? votes.up : 0;
  const downCount = votes ? votes.down : 0;

  let html = `
    <h3>${incident.type}</h3>
    <p><small>Reported: ${incident.time}</small></p>
  `;

  if (incident.photoURL) {
    // Force it to show the resized image (the CSS handles max-height)
    html += `
      <a href="${incident.photoURL}" target="_blank" rel="noopener noreferrer">
        <img src="${incident.photoURL}" alt="Incident Photo" />
      </a>
    `;
  }

  html += `
    <p>Up: ${upCount} / Down: ${downCount}
      <button class="btn btn-outline-success btn-sm" onclick="voteUp('${incId}')">
        <i class="fas fa-thumbs-up"></i>
      </button>
      <button class="btn btn-outline-danger btn-sm" onclick="voteDown('${incId}')">
        <i class="fas fa-thumbs-down"></i>
      </button>
    </p>
    <div>
      <button class="btn btn-secondary btn-sm" onclick="shareOnWhatsApp('${incident.type}')">
        <i class="fab fa-whatsapp"></i>
      </button>
      <button class="btn btn-secondary btn-sm" onclick="shareOnFacebook('${incident.type}')">
        <i class="fab fa-facebook-f"></i>
      </button>
      <button class="btn btn-secondary btn-sm" onclick="shareOnInstagram('${incident.type}')">
        <i class="fab fa-instagram"></i>
      </button>
      <button class="btn btn-secondary btn-sm" onclick="copyIncidentLink('${incident.type}')">
        <i class="fas fa-link"></i>
      </button>
    </div>
  `;

  incidentContent.innerHTML = html;

  // Slide panel in
  incidentPanel.classList.remove('panel-closed');
  incidentPanel.classList.add('panel-open');
}

function hideIncidentPanel() {
  incidentPanel.classList.remove('panel-open');
  incidentPanel.classList.add('panel-closed');
}

/***********************************************
 *  VOTING & SHARING
 ***********************************************/
function voteUp(incidentId) {
  incidentsVotes[incidentId].up++;
  const inc = incidents.find((i) => i.id === incidentId);
  showIncidentPanel(inc); // re-show so counts update
}
function voteDown(incidentId) {
  incidentsVotes[incidentId].down++;
  const inc = incidents.find((i) => i.id === incidentId);
  showIncidentPanel(inc);
}

// SHARE
function shareOnWhatsApp(issueType) {
  const link = `https://wa.me/?text=Incident reported: ${issueType}`;
  window.open(link, '_blank');
}
function shareOnFacebook(issueType) {
  const shareUrl = encodeURIComponent(`Incident reported: ${issueType}`);
  const fbLink = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;
  window.open(fbLink, '_blank');
}
function shareOnInstagram(issueType) {
  window.open('https://www.instagram.com/', '_blank');
}
function copyIncidentLink(issueType) {
  const text = `Incident Reported: ${issueType}`;
  navigator.clipboard.writeText(text).then(() => {
    alert('Incident link copied!');
  });
}
