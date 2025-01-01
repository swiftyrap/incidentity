/***********************
 * GLOBAL VARIABLES
 ***********************/
let map;
let userMarker = null;
let currentPosition = null;
const markerClusterGroup = L.markerClusterGroup();

// For stats
let incidentsData = {};
let incidents = [];
let lineChart = null;

// For the verification & badge system
let currentUser = {
  id: 1,
  points: 0,
  badge: 'none'
};

// For share incident ID
let shareIncidentId = null;

/***********************
 * DOMContentLoaded
 ***********************/
document.addEventListener('DOMContentLoaded', () => {
  initMap([51.5074, -0.1278], 13); // London default
  initUI();
  watchLocation();
});

/***********************
 * INIT MAP
 ***********************/
function initMap(center, zoom) {
  map = L.map('map', { zoomControl: false }).setView(center, zoom);

  // Only 1 zoom button => top right
  L.control.zoom({ position: 'topright' }).addTo(map);

  // OSM tile layer
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // Add cluster group
  map.addLayer(markerClusterGroup);

  // Heatmap layer
  window.heat = L.heatLayer([], { radius: 25, blur: 15, maxZoom: 17 }).addTo(map);

  // user icon
  const userIconUrl = 'https://cdn-icons-png.flaticon.com/512/3177/3177361.png';
  userMarker = L.marker(center, {
    icon: L.icon({
      iconUrl: userIconUrl,
      iconSize: [36, 36],
      iconAnchor: [18, 36]
    })
  }).addTo(map);

  // Hide side panel on map click
  map.on('click', () => {
    hideSidePanel();
  });
}

/***********************
 * INIT UI
 ***********************/
function initUI() {
  // Tabs
  document.getElementById('map-tab').addEventListener('click', showMapTab);
  document.getElementById('stats-tab').addEventListener('click', showStatsTab);

  // Report button
  document.getElementById('report-btn').addEventListener('click', openReportModal);

  // Side panel close
  document.getElementById('panel-close-btn').addEventListener('click', hideSidePanel);

  // Submit incident
  document.getElementById('modal-submit-btn').addEventListener('click', finalizeIncidentSubmission);

  // Account in the dropdown => show account modal
  document.getElementById('account-btn').addEventListener('click', () => {
    const modal = new bootstrap.Modal(document.getElementById('accountModal'), {});
    modal.show();
  });

  // Account placeholder actions
  document.getElementById('register-btn').addEventListener('click', () => {
    document.getElementById('account-message').textContent = 'Registration successful!';
    document.getElementById('account-message').style.display = 'block';
  });
  document.getElementById('login-btn').addEventListener('click', () => {
    document.getElementById('account-message').textContent = 'Logged in successfully!';
    document.getElementById('account-message').style.display = 'block';
  });

  // Search
  document.getElementById('search-btn').addEventListener('click', async () => {
    const query = document.getElementById('location-search').value;
    if (!query) return;

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
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
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  // Share modal buttons
  document.getElementById('share-instagram').addEventListener('click', () => shareInstagram());
  document.getElementById('share-facebook').addEventListener('click', () => shareFacebook());
  document.getElementById('share-snapchat').addEventListener('click', () => shareSnapchat());
  document.getElementById('share-whatsapp').addEventListener('click', () => shareWhatsapp());
  document.getElementById('share-twitter').addEventListener('click', () => shareTwitter());
  document.getElementById('copy-incident-link').addEventListener('click', () => copyIncidentLink());
}

/***********************
 * TABS
 ***********************/
function showMapTab() {
  // highlight Map
  document.getElementById('map-tab').classList.add('active');
  document.getElementById('stats-tab').classList.remove('active');

  document.getElementById('map-container').style.display = 'block';
  document.getElementById('stats-container').style.display = 'none';

  hideSidePanel();
}

function showStatsTab() {
  // highlight Stats
  document.getElementById('stats-tab').classList.add('active');
  document.getElementById('map-tab').classList.remove('active');

  document.getElementById('map-container').style.display = 'none';
  document.getElementById('stats-container').style.display = 'block';

  hideSidePanel();
  buildDateFilter();
  loadStatisticsData();
}

/***********************
 * LOCATION WATCH
 ***********************/
function watchLocation() {
  if (!navigator.geolocation) {
    console.warn('Geolocation not supported.');
    return;
  }
  navigator.geolocation.watchPosition(
    (pos) => {
      currentPosition = [pos.coords.latitude, pos.coords.longitude];
      userMarker.setLatLng(currentPosition);
      map.setView(currentPosition, 13);
    },
    (err) => {
      console.warn('Geolocation error or denied:', err);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

/***********************
 * REPORT MODAL
 ***********************/
function openReportModal() {
  const modal = new bootstrap.Modal(document.getElementById('reportModal'), {});
  modal.show();
}

function finalizeIncidentSubmission() {
  const modalEl = document.getElementById('reportModal');
  const modal = bootstrap.Modal.getInstance(modalEl);
  modal.hide();

  if (!currentPosition) {
    alert('No location found. Incident cannot be pinned exactly.');
    return;
  }

  const issueType = document.getElementById('issue-type').value;
  const files = document.getElementById('photo-upload').files;
  const fileURLs = [];

  for (let f of files) {
    fileURLs.push(URL.createObjectURL(f));
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthKey = `${year}-${month}`;

  const newIncident = {
    id: Date.now(),
    type: issueType,
    time: now.toLocaleString(),
    monthKey,
    lat: currentPosition[0],
    lng: currentPosition[1],
    photoURLs: fileURLs,
    status: 'pending',
    verifiedCount: 0,
    flaggedCount: 0,
    likes: 0
  };

  // push
  incidents.push(newIncident);

  // stats data
  if (!incidentsData[monthKey]) {
    incidentsData[monthKey] = {};
  }
  if (!incidentsData[monthKey][issueType]) {
    incidentsData[monthKey][issueType] = 0;
  }
  incidentsData[monthKey][issueType]++;

  // add marker
  const marker = L.marker([newIncident.lat, newIncident.lng]);
  markerClusterGroup.addLayer(marker);
  marker.on('click', () => {
    showSidePanel(newIncident.id);
  });

  // clear form
  document.getElementById('issue-type').selectedIndex = 0;
  document.getElementById('photo-upload').value = '';

  updateHeatmap();
}

/***********************
 * SIDE PANEL
 ***********************/
function showSidePanel(incidentId) {
  const incident = incidents.find((i) => i.id === incidentId);
  if (!incident) return;

  let html = `<h5 style="margin-bottom:4px;">${incident.type}</h5>
              <small>${incident.time}</small>`;

  // status
  if (incident.status === 'pending') {
    html += `<p style="margin-top:4px;">Status: <span style="color:orange;">Pending Verification</span></p>`;
  } else if (incident.status === 'verified') {
    html += `<p style="margin-top:4px;">Status: <span style="color:green;">Verified</span></p>`;
  } else {
    html += `<p style="margin-top:4px;">Status: <span style="color:red;">Unverified</span></p>`;
  }

  // multiple photos
  if (incident.photoURLs && incident.photoURLs.length > 0) {
    incident.photoURLs.forEach((src) => {
      html += `<img src="${src}" alt="Incident Photo"/>`;
    });
  }

  // like & share
  html += `<div class="like-share-row">
             <button class="btn btn-outline-secondary btn-sm" onclick="likeIncident(${incident.id})">
               <i class="fa-regular fa-thumbs-up"></i> (${incident.likes})
             </button>
             <button class="btn btn-outline-secondary btn-sm" onclick="openShareModal(${incident.id})">
               <i class="fa-solid fa-share-nodes"></i>
             </button>
           </div>`;

  // verify row
  if (incident.status === 'pending') {
    html += `<div class="verify-row">
               <button class="btn btn-sm btn-success" onclick="verifyIncident(${incident.id}, true)">Verify</button>
               <button class="btn btn-sm btn-warning" onclick="verifyIncident(${incident.id}, false)">Flag False</button>
             </div>`;
  }

  document.getElementById('panel-content').innerHTML = html;
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
 * LIKE, VERIFY
 ***********************/
function likeIncident(incId) {
  const inc = incidents.find((i) => i.id === incId);
  if (!inc) return;
  inc.likes++;
  showSidePanel(incId);
}

function verifyIncident(incId, isVerified) {
  const inc = incidents.find((i) => i.id === incId);
  if (!inc) return;

  if (isVerified) {
    inc.verifiedCount++;
    currentUser.points += 5;
  } else {
    inc.flaggedCount++;
  }
  updateContributorBadge();

  if (inc.verifiedCount >= 3) {
    inc.status = 'verified';
  } else if (inc.flaggedCount >= 2) {
    inc.status = 'unverified';
  }
  showSidePanel(incId);
}

/***********************
 * CONTRIBUTOR BADGE
 ***********************/
function updateContributorBadge() {
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
  const points = incidents.map((inc) => [inc.lat, inc.lng, 0.5]);
  heat.setLatLngs(points);
}

/***********************
 * SHARE MODAL
 ***********************/
function openShareModal(incId) {
  shareIncidentId = incId;
  const modal = new bootstrap.Modal(document.getElementById('shareModal'), {});
  modal.show();
}

function shareInstagram() {
  const inc = incidents.find((i) => i.id === shareIncidentId);
  if (!inc) return;
  const shareText = `I just reported an incident! Location: ${inc.lat}, ${inc.lng}.`;
  window.open(`https://www.instagram.com/?text=${encodeURIComponent(shareText)}`, '_blank');
}

function shareFacebook() {
  const inc = incidents.find((i) => i.id === shareIncidentId);
  if (!inc) return;
  const shareText = `I just reported an incident! Location: ${inc.lat}, ${inc.lng}.`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareText)}`;
  window.open(fbUrl, '_blank');
}

function shareSnapchat() {
  const inc = incidents.find((i) => i.id === shareIncidentId);
  if (!inc) return;
  const shareText = `Snapchat share is tricky on web.\nLocation: ${inc.lat}, ${inc.lng}`;
  alert(shareText);
}

function shareWhatsapp() {
  const inc = incidents.find((i) => i.id === shareIncidentId);
  if (!inc) return;
  const shareText = `I just reported an incident! Location: ${inc.lat}, ${inc.lng}.`;
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
  window.open(url, '_blank');
}

function shareTwitter() {
  const inc = incidents.find((i) => i.id === shareIncidentId);
  if (!inc) return;
  const shareText = `I just reported an incident! Location: ${inc.lat}, ${inc.lng}.`;
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
  window.open(url, '_blank');
}

function copyIncidentLink() {
  const inc = incidents.find((i) => i.id === shareIncidentId);
  if (!inc) return;
  const linkText = `Incident: ${inc.type} at [${inc.lat}, ${inc.lng}]`;
  navigator.clipboard.writeText(linkText).then(() => {
    alert('Incident link copied!');
  });
}

/***********************
 * LIGHT/DARK THEME
 ***********************/
function toggleTheme() {
  document.body.classList.toggle('dark-mode');
}

/***********************
 * STATS
 ***********************/
function buildDateFilter() {
  const sel = document.getElementById('date-filter');
  sel.innerHTML = '';

  const allMonthKeys = Object.keys(incidentsData).sort().reverse();
  allMonthKeys.forEach((mKey) => {
    const opt = document.createElement('option');
    opt.value = mKey;
    opt.textContent = formatMonthKey(mKey);
    sel.appendChild(opt);
  });
}

function formatMonthKey(mKey) {
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
    if (lineChart) lineChart.destroy();
    document.getElementById('incident-list').innerHTML = '';
    return;
  }

  const typeCounts = incidentsData[dateVal];
  let total = 0;
  Object.values(typeCounts).forEach((v) => (total += v));

  let sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  let listHTML = '';
  sorted.forEach(([type, count]) => {
    listHTML += `<div class="d-flex justify-content-between" style="border-bottom:1px solid #ccc; padding:5px 0;">
      <span>${type}</span>
      <strong>${count}</strong>
    </div>`;
  });
  document.getElementById('incident-list').innerHTML = listHTML;

  if (lineChart) lineChart.destroy();
  const ctx = document.getElementById('line-chart').getContext('2d');
  lineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
      datasets: [
        {
          label: `Incidents in ${formatMonthKey(dateVal)}`,
          data: Array(12).fill(0).map((_, i) => {
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
