/***********************************************
 *  GLOBALS & INITIAL SETUP
 ***********************************************/
let map;           // We'll init this after we get location
let userMarker;     // Circle marker for the user
let currentPosition;
const markerClusterGroup = L.markerClusterGroup();

// For tracking incidents in chart
let incidentsData = {};   
// For votes: { "incidentId": { up: 0, down: 0 } }
let incidentsVotes = {}; 

// Chart reference so we can destroy/recreate
let incidentChart = null;


/***********************************************
 *  INITIALIZE MAP *AFTER* GETTING LOCATION
 ***********************************************/

// 1) Try to get user’s location once
navigator.geolocation.getCurrentPosition(
  (position) => {
    const { latitude, longitude } = position.coords;
    currentPosition = [latitude, longitude];

    // Create the map at the user's location
    map = L.map('map').setView(currentPosition, 15);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    map.addLayer(markerClusterGroup);

    // Place user marker
    userMarker = L.circleMarker(currentPosition, {
      radius: 8,
      color: 'blue',
      fillColor: 'white',
      fillOpacity: 1
    }).addTo(map);

    // 2) Then also watch for changes to position
    watchLocationUpdates();
  },
  (err) => {
    console.error('Location error:', err);
    // If user denies location or an error occurs,
    // fallback to some default location
    initMapWithFallback();
  },
  { enableHighAccuracy: true }
);

// If user denies geolocation or it fails, just show a default city
function initMapWithFallback() {
  map = L.map('map').setView([51.505, -0.09], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  map.addLayer(markerClusterGroup);

  watchLocationUpdates();
}

// Listen for position changes
function watchLocationUpdates() {
  navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      currentPosition = [latitude, longitude];

      // If we haven't placed userMarker yet, do so now
      if (!userMarker) {
        userMarker = L.circleMarker(currentPosition, {
          radius: 8,
          color: 'blue',
          fillColor: 'white',
          fillOpacity: 1
        }).addTo(map);
      } else {
        userMarker.setLatLng(currentPosition);
      }
    },
    (error) => console.log('watchPosition error:', error),
    { enableHighAccuracy: true }
  );
}

/***********************************************
 *  REPORT INCIDENT BUTTON -> SHOW MODAL
 ***********************************************/
document.getElementById('report-button').addEventListener('click', () => {
  const formModal = new bootstrap.Modal(document.getElementById('formModal'));
  formModal.show();
});

/***********************************************
 *  SUBMIT INCIDENT
 ***********************************************/
document.getElementById('form-submit').onclick = () => {
  if (!currentPosition) {
    alert('Unable to detect your current location. Please enable location services.');
    return;
  }

  const issueType = document.getElementById('issue-type').value;
  const photoFile = document.getElementById('photo-upload').files[0];
  const marker = L.marker(currentPosition);

  // Unique ID for this incident
  const incidentId = 'incident-' + Date.now();
  // Initialize votes
  incidentsVotes[incidentId] = { up: 0, down: 0 };

  // Update incidentsData for the chart
  if (!incidentsData[issueType]) {
    incidentsData[issueType] = 0;
  }
  incidentsData[issueType] += 1;

  // Time reported
  const reportedTime = new Date().toLocaleString();

  // Build popup content
  let popupContent = `
    <b>${issueType}</b><br/>
    <small><i>Time Reported: ${reportedTime}</i></small>
    <br/>
  `;

  // Photo if present
  if (photoFile) {
    const photoURL = URL.createObjectURL(photoFile);
    // Make image a bit smaller (80% width)
    popupContent += `
      <img src="${photoURL}" alt="Incident Photo" style="width:80%; margin-top:5px;" />
    `;
  }

  // Votes
  popupContent += `
    <div id="${incidentId}-votes" style="margin-top:5px;">
      Up: 0 / Down: 0
    </div>
    <button class="btn btn-outline-success btn-sm" onclick="voteUp('${incidentId}')">
      Vote Up
    </button>
    <button class="btn btn-outline-danger btn-sm" onclick="voteDown('${incidentId}')">
      Vote Down
    </button>
    <hr style="margin:5px 0;"/>

    <button class="btn btn-success btn-sm" onclick="shareOnWhatsApp('${issueType}')">
      Share on WhatsApp
    </button>
    <button class="btn btn-secondary btn-sm" onclick="copyIncidentLink('${issueType}')">
      Copy Link
    </button>
  `;

  // Bind the popup
  marker.bindPopup(popupContent, {
    autoPan: true,
    autoPanPadding: [20, 20], // less padding so it's more "centered"
    maxWidth: 220,            // Make container narrower
    className: 'incident-popup' // we’ll style in CSS
  });

  // Add to cluster
  marker.addTo(markerClusterGroup);

  // Show popup immediately
  marker.openPopup();

  // Center the popup vertically
  marker.on('popupopen', () => {
    setTimeout(() => {
      // Center map on marker
      map.setView(marker.getLatLng(), map.getZoom(), { animate: true });
      // Then pan up ~1/4 screen
      setTimeout(() => {
        map.panBy([0, -map.getSize().y / 4], {
          animate: true,
          duration: 0.5
        });
      }, 300);
    }, 100);
  });

  // Hide modal
  const formModal = bootstrap.Modal.getInstance(document.getElementById('formModal'));
  formModal.hide();
};

/***********************************************
 *  VOTE UP / DOWN
 ***********************************************/
function voteUp(incidentId) {
  incidentsVotes[incidentId].up++;
  updateVoteDisplay(incidentId);
}

function voteDown(incidentId) {
  incidentsVotes[incidentId].down++;
  updateVoteDisplay(incidentId);
}

function updateVoteDisplay(incidentId) {
  const { up, down } = incidentsVotes[incidentId];
  const votesElem = document.getElementById(`${incidentId}-votes`);
  if (votesElem) {
    votesElem.innerHTML = `Up: ${up} / Down: ${down}`;
  }
}

/***********************************************
 *  SHARING FUNCTIONS
 ***********************************************/
function shareOnWhatsApp(issueType) {
  const link = `https://wa.me/?text=Incident reported: ${issueType}`;
  window.open(link, '_blank');
}

function copyIncidentLink(issueType) {
  const text = `Incident Reported: ${issueType}`;
  navigator.clipboard.writeText(text).then(() => {
    alert('Incident link copied!');
  });
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
 *  LOAD STATISTICS
 ***********************************************/
function loadStatistics() {
  // Destroy old chart if present
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
