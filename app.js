/***********************
 * GLOBAL VARIABLES
 ***********************/
let map;
let userMarker = null;
let currentPosition = null;
const markerClusterGroup = L.markerClusterGroup();

// For stats
let incidentsData = {};  // e.g. { "2024-10": { "Brick Fall":2, "Rubbish...":1 }, "2024-12": {...} }
let incidents = [];
let incidentsVotes = []; // optional if you track up/down individually
let lineChart = null;

// For the verification & badge system
let currentUser = {
  id: 1,
  points: 0,   // for badges
  badge: 'none'
};

/***********************
 * DOMContentLoaded
 ***********************/
document.addEventListener('DOMContentLoaded', () => {
  // Initialize after DOM is ready
  initMap([53.8008, -1.5491], 13); // Leeds fallback
  initUI();
  watchLocation();     // tries geolocation
  watchOrientation();  // tries device orientation

  // Build or refresh timeline (initially empty)
  buildTimeline(incidents);
});

/***********************
 * INIT MAP
 ***********************/
function initMap(center, zoom) {
  map = L.map('map').setView(center, zoom);

  // OSM tile layer
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // Add cluster group
  map.addLayer(markerClusterGroup);

  // Optional: heatmap layer
  window.heat = L.heatLayer([], { radius: 25, blur: 15, maxZoom: 17 }).addTo(map);

  // Add user marker (rotated arrow icon if desired)
  const iconUrl = 'arrow.png'; // replace with your actual arrow icon
  userMarker = L.marker(center, {
    icon: L.icon({
      iconUrl,
      iconSize: [32, 32],
      className: 'user-arrow'
    }),
    rotationAngle: 0,
    rotationOrigin: 'center center'
  }).addTo(map);

  // Hide side panel if map is clicked
  map.on('click', () => {
    hideSidePanel();
  });

  // Rebuild "incidents in view" whenever map moves
  map.on('moveend', () => {
    updateIncidentsInView();
  });
}

/***********************
 * UI SETUP
 ***********************/
function initUI() {
  // Tabs
  document.getElementById('map-tab').addEventListener('click', showMapTab);
  document.getElementById('stats-tab').addEventListener('click', showStatsTab);

  // "Report Incident" button => open modal
  document
    .getElementById('report-btn')
    .addEventListener('click', openReportModal);

  // Side panel close
  document
    .getElementById('panel-close-btn')
    .addEventListener('click', hideSidePanel);

  // Modal "submit"
  document
    .getElementById('modal-submit-btn')
    .addEventListener('click', finalizeIncidentSubmission);

  // Search bar (Nominatim)
  document
    .getElementById('search-btn')
    .addEventListener('click', async () => {
      const query = document.getElementById('location-search').value;
      if (!query) return;

      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data && data.length > 0) {
          const { lat, lon } = data[0];
          map.setView([parseFloat(lat), parseFloat(lon)], 13);
        } else {
          alert('Location not found.');
        }
      } catch (err) {
        console.error(err);
        alert('Error searching location.');
      }
    });

  // Theme toggle
  document
    .getElementById('theme-toggle')
    .addEventListener('click', toggleTheme);
}

/***********************
 * TABS
 ***********************/
function showMapTab() {
  document.getElementById('map-tab').classList.add('active');
  document.getElementById('stats-tab').classList.remove('active');
  document.getElementById('map-container').style.display = 'block';
  document.getElementById('stats-container').style.display = 'none';
}
function showStatsTab() {
  document.getElementById('stats-tab').classList.add('active');
  document.getElementById('map-tab').classList.remove('active');
  document.getElementById('map-container').style.display = 'none';
  document.getElementById('stats-container').style.display = 'block';
  // Refresh stats
  buildDateFilter();
  loadStatisticsData();
}

/***********************
 * LOCATION WATCH
 ***********************/
function watchLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.watchPosition(
    (pos) => {
      currentPosition = [pos.coords.latitude, pos.coords.longitude];
      userMarker.setLatLng(currentPosition);
      map.setView(currentPosition, 13);
    },
    (err) => {
      console.warn('Geolocation error or permission denied:', err);
      // no further action -> remains at Leeds fallback
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}
function watchOrientation() {
  window.addEventListener(
    'deviceorientation',
    (evt) => {
      let heading = evt.alpha;
      if (typeof evt.webkitCompassHeading === 'number') {
        heading = evt.webkitCompassHeading;
      }
      if (userMarker && heading != null) {
        userMarker.setRotationAngle(heading);
      }
    },
    true
  );
}

/***********************
 * REPORT MODAL
 ***********************/
function openReportModal() {
  // Show Bootstrap 5 modal (manually or via data-bs-toggle)
  const modal = new bootstrap.Modal(document.getElementById('reportModal'), {});
  modal.show();
}

function finalizeIncidentSubmission() {
  // Hide modal
  const modalEl = document.getElementById('reportModal');
  const modal = bootstrap.Modal.getInstance(modalEl);
  modal.hide();

  if (!currentPosition) {
    alert('No location found. Incident cannot be pinned exactly.');
    // Optionally store offline or just return
    return;
  }

  const issueType = document.getElementById('issue-type').value;
  const photoFile = document.getElementById('photo-upload').files[0] || null;
  const now = new Date();

  // Build a "monthKey" for stats grouping: "YYYY-MM"
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthKey = `${year}-${month}`;

  // Construct new incident object
  const newIncident = {
    id: Date.now(),
    type: issueType,
    time: now.toLocaleString(),
    monthKey,
    lat: currentPosition[0],
    lng: currentPosition[1],
    photoURL: null,
    status: 'pending',   // brand new => pending verification
    verifiedCount: 0,
    flaggedCount: 0,
    votes: { up: 0, down: 0 }
  };

  // If photoFile exists, create local URL for display
  if (photoFile) {
    newIncident.photoURL = URL.createObjectURL(photoFile);
  }

  // Add to "incidents" array
  incidents.push(newIncident);

  // Update incidentsData for stats
  if (!incidentsData[monthKey]) {
    incidentsData[monthKey] = {};
  }
  if (!incidentsData[monthKey][issueType]) {
    incidentsData[monthKey][issueType] = 0;
  }
  incidentsData[monthKey][issueType]++;

  // Add a marker
  const marker = L.marker([newIncident.lat, newIncident.lng]);
  markerClusterGroup.addLayer(marker);
  marker.on('click', () => {
    showSidePanel(newIncident.id);
  });

  // Clear form
  document.getElementById('issue-type').selectedIndex = 0;
  document.getElementById('photo-upload').value = '';

  // Refresh timeline
  buildTimeline(incidents);

  // Refresh heatmap
  updateHeatmap();

  alert('Incident reported as Pending Verification.');
}

/***********************
 * SIDE PANEL
 ***********************/
function showSidePanel(incidentId) {
  const incident = incidents.find((i) => i.id === incidentId);
  if (!incident) return;

  let html = `<h3>${incident.type}<br><small>${incident.time}</small></h3>`;

  // Show status
  if (incident.status === 'pending') {
    html += `<p>Status: <span style="color:orange;">Pending Verification</span></p>`;
  } else if (incident.status === 'verified') {
    html += `<p>Status: <span style="color:green;">Verified</span></p>`;
  } else {
    html += `<p>Status: <span style="color:red;">Unverified</span></p>`;
  }

  // Photo
  if (incident.photoURL) {
    html += `<img src="${incident.photoURL}" style="width:100%; max-height:200px; object-fit:cover;" />`;
  }

  // Votes
  const vUp = incident.votes.up;
  const vDown = incident.votes.down;
  html += `<p>Up: ${vUp} / Down: ${vDown}</p>`;
  html += `<div class="vote-buttons">
             <button class="btn btn-outline-success btn-sm" onclick="voteUp(${incident.id})">
               <i class="fas fa-thumbs-up"></i>
             </button>
             <button class="btn btn-outline-danger btn-sm" onclick="voteDown(${incident.id})">
               <i class="fas fa-thumbs-down"></i>
             </button>
           </div>`;

  // Verification buttons (only if pending)
  if (incident.status === 'pending') {
    html += `
      <div style="margin-top:10px;">
        <button class="btn btn-sm btn-success" onclick="verifyIncident(${incident.id}, true)">Verify</button>
        <button class="btn btn-sm btn-warning" onclick="verifyIncident(${incident.id}, false)">Flag False</button>
      </div>`;
  }

  // Share on social media
  html += `<div style="margin-top:10px;">
             <button class="btn btn-sm btn-info" onclick="shareIncident(${incident.id})">
               Share Incident
             </button>
           </div>`;

  document.getElementById('panel-content').innerHTML = html;

  // Open side panel
  const panel = document.getElementById('side-panel');
  panel.classList.remove('panel-closed');
  panel.classList.add('panel-open');
}

function hideSidePanel() {
  const panel = document.getElementById('side-panel');
  panel.classList.remove('panel-open');
  panel.classList.add('panel-closed');
}

/***********************
 * VOTING & VERIFICATION
 ***********************/
function voteUp(incId) {
  const inc = incidents.find((i) => i.id === incId);
  inc.votes.up++;
  showSidePanel(incId);
}
function voteDown(incId) {
  const inc = incidents.find((i) => i.id === incId);
  inc.votes.down++;
  showSidePanel(incId);
}

// isVerified = true => user verifying
// isVerified = false => user flagged as false
function verifyIncident(incId, isVerified) {
  const inc = incidents.find((i) => i.id === incId);
  if (!inc) return;

  if (isVerified) {
    inc.verifiedCount++;
    currentUser.points += 5; // reward
  } else {
    inc.flaggedCount++;
    // maybe reduce points or no change
  }
  updateContributorBadge();

  // Check thresholds
  if (inc.verifiedCount >= 3) {
    inc.status = 'verified';
  } else if (inc.flaggedCount >= 2) {
    inc.status = 'unverified';
  }

  // Re-show side panel
  showSidePanel(incId);
  // Rebuild any lists or timeline
  updateIncidentsInView();
  buildTimeline(incidents);
}

/***********************
 * CONTRIBUTOR BADGE
 ***********************/
function updateContributorBadge() {
  // Example: 500+ => Bronze, 1000+ => Silver
  if (currentUser.points >= 1000) {
    currentUser.badge = 'Silver';
  } else if (currentUser.points >= 500) {
    currentUser.badge = 'Bronze';
  } else {
    currentUser.badge = 'none';
  }
  console.log(`User badge is now: ${currentUser.badge}`);
}

/***********************
 * HEATMAP
 ***********************/
function updateHeatmap() {
  const points = incidents.map((inc) => [inc.lat, inc.lng, 0.5]); // lat, lng, intensity
  heat.setLatLngs(points);
}

/***********************
 * RIGHT PANEL: Incidents in the Current Map Bounds
 ***********************/
function updateIncidentsInView() {
  const bounds = map.getBounds();
  const inView = incidents.filter((inc) => {
    return bounds.contains([inc.lat, inc.lng]);
  });
  renderIncidentsList(inView);
}

function renderIncidentsList(list) {
  const container = document.getElementById('incidents-in-view');
  container.innerHTML = '';
  list.forEach((inc) => {
    const div = document.createElement('div');
    div.innerHTML = `<strong>${inc.type}</strong><br>
                     <small>${inc.time}</small><br>
                     Status: ${inc.status}`;
    div.addEventListener('click', () => {
      showSidePanel(inc.id);
    });
    container.appendChild(div);
  });
}

/***********************
 * HORIZONTAL TIMELINE
 ***********************/
function buildTimeline(incidentsArray) {
  // Sort by ID (time-based)
  incidentsArray.sort((a, b) => a.id - b.id);
  const timeline = document.getElementById('timeline');
  timeline.innerHTML = '';
  incidentsArray.forEach((inc) => {
    const item = document.createElement('div');
    item.className = 'timeline-item';
    const dateStr = new Date(inc.id).toLocaleDateString();
    item.innerHTML = `<strong>${inc.type}</strong><br><small>${dateStr}</small>`;
    item.onclick = () => {
      map.setView([inc.lat, inc.lng], 15);
      showSidePanel(inc.id);
    };
    timeline.appendChild(item);
  });
}

/***********************
 * CHART.JS STATS
 ***********************/
function buildDateFilter() {
  const sel = document.getElementById('date-filter');
  sel.innerHTML = ''; // clear old

  // e.g. ["2024-12", "2024-10", ...]
  const allMonthKeys = Object.keys(incidentsData).sort().reverse();
  allMonthKeys.forEach((mKey) => {
    const opt = document.createElement('option');
    opt.value = mKey;
    opt.textContent = formatMonthKey(mKey);
    sel.appendChild(opt);
  });
}

function formatMonthKey(mKey) {
  // "2024-12" => "December 2024"
  const [y, m] = mKey.split('-');
  const year = parseInt(y, 10);
  const monthNum = parseInt(m, 10) - 1;
  const monthName = new Date(year, monthNum).toLocaleString('default', {
    month: 'long'
  });
  return `${monthName} ${year}`;
}

function loadStatisticsData() {
  const dateVal = document.getElementById('date-filter').value;
  if (!dateVal || !incidentsData[dateVal]) {
    document.getElementById('stats-info').textContent = 'No data.';
    document.getElementById('incident-list').innerHTML = '';
    if (lineChart) lineChart.destroy();
    return;
  }
  // Sum total
  const typeCounts = incidentsData[dateVal];
  let total = 0;
  Object.values(typeCounts).forEach((v) => (total += v));

  document.getElementById('stats-info').textContent = `${total} incidents reported in ${formatMonthKey(
    dateVal
  )}.`;

  // Build list of types sorted
  let sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  let listHTML = '';
  sorted.forEach(([type, count]) => {
    listHTML += `<div class="d-flex justify-content-between" style="border-bottom:1px solid #ccc; padding:5px 0;">
      <span>${type}</span>
      <strong>${count}</strong>
    </div>`;
  });
  document.getElementById('incident-list').innerHTML = listHTML;

  // Build or update line chart
  if (lineChart) lineChart.destroy();
  const ctx = document.getElementById('line-chart').getContext('2d');
  lineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [
        'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'
      ],
      datasets: [
        {
          label: `Incidents in ${formatMonthKey(dateVal)}`,
          data: Array(12).fill(0).map((_, i) => {
            // If the month index matches dateVal's month, use total
            const splitted = dateVal.split('-');
            const mm = parseInt(splitted[1], 10) - 1;
            return i === mm ? total : 0;
          }),
          borderColor: '#ff0060',
          backgroundColor: '#fecdd3',
          fill: true,
          tension: 0.2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          ticks: {
            // Force integer steps
            stepSize: 1,
            callback: function (value) {
              return Number.isInteger(value) ? value : null;
            }
          }
        }
      }
    }
  });
}

/***********************
 * SHARE INCIDENT (Social Media)
 ***********************/
function shareIncident(incId) {
  const inc = incidents.find((i) => i.id === incId);
  const shareText = `I just reported a '${inc.type}' at ${inc.time}! Check it out!`;
  // Example: share to Twitter
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
  window.open(url, '_blank');
}

/***********************
 * LIGHT/DARK THEME
 ***********************/
function toggleTheme() {
  const body = document.body;
  body.classList.toggle('dark-mode'); // minimal example
}

/***********************
 * (OPTIONAL) OFFLINE DRAFTING
 ***********************/
// You could store unsubmitted incidents in localStorage if no geolocation found, etc.
// This is just a placeholder if you want to implement later.
