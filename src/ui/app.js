/* ═══════════════════════════════════════════════════════════
   EpiPrishtina — Frontend Logic (Fully Functional)
   ═══════════════════════════════════════════════════════════ */

const API_BASE = 'http://localhost:8000';
const REFRESH_INTERVAL = 10000;

// ═══════════════ STATE ═══════════════

const state = {
    currentPage: 'dashboard',
    currentScenario: 'ai-optimized',
    currentLayer: 'both',
    selectedActions: new Set([0, 1, 2, 3, 4]),
    dashboardData: null,
    historyData: null,
};

// ═══════════════ CONFIG ═══════════════

const DISTRICTS_COORDS = {
    "Qendra": [42.6629, 21.1655],
    "Dardania": [42.6555, 21.1585],
    "Ulpiana": [42.6580, 21.1720],
    "Arbëria": [42.6700, 21.1480],
    "Kalabria": [42.6480, 21.1610],
    "Bregu i Diellit": [42.6520, 21.1780],
    "Sunny Hill": [42.6450, 21.1700],
    "Lakrishte": [42.6420, 21.1450],
    "Mat": [42.6580, 21.1350],
    "Tophane": [42.6680, 21.1620],
    "Vranjevc": [42.6720, 21.1750],
    "Kodra e Trimave": [42.6760, 21.1580],
    "Kolovica": [42.6820, 21.1780],
    "Sofali": [42.6450, 21.1900],
    "Bardhosh": [42.6900, 21.1500],
};

const RISK_COLORS = {
    CRITICAL: '#ff4757',
    HIGH: '#ff6348',
    MEDIUM: '#ffa502',
    LOW: '#2ed573',
    MINIMAL: '#6b7280',
};

// ═══════════════ MAP ═══════════════

let map, heatLayer, markersLayer, circleLayer;

function initMap() {
    map = L.map('map', {
        center: [42.6629, 21.1655],
        zoom: 13,
        zoomControl: true,
        attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
    }).addTo(map);

    heatLayer = null;
    markersLayer = L.layerGroup().addTo(map);
    circleLayer = L.layerGroup().addTo(map);
}

function updateHeatmap(hotspots) {
    if (heatLayer) {
        map.removeLayer(heatLayer);
        heatLayer = null;
    }

    if (!hotspots || hotspots.length === 0) return;

    const maxReports = Math.max(...hotspots.map(h => h.reports_7d || 0), 1);
    const heatPoints = [];

    hotspots.forEach(h => {
        const coords = DISTRICTS_COORDS[h.district];
        if (!coords) return;

        const reports = h.reports_7d || 0;
        const intensity = Math.min(reports / maxReports, 1.0);
        const numPoints = Math.max(10, Math.floor(intensity * 60));
        const spread = 0.015;

        for (let i = 0; i < numPoints; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const distance = Math.random() * spread;
            const lat = coords[0] + Math.cos(angle) * distance;
            const lon = coords[1] + Math.sin(angle) * distance;
            const pointIntensity = intensity * Math.pow(1 - distance / spread, 1.5);
            heatPoints.push([lat, lon, pointIntensity]);
        }
    });

    heatLayer = L.heatLayer(heatPoints, {
        radius: 50,
        blur: 40,
        maxZoom: 15,
        max: 1.0,
        minOpacity: 0.15,
        gradient: {
            0.0: '#2ed573',
            0.2: '#7bed9f',
            0.4: '#ffa502',
            0.6: '#ff6348',
            0.8: '#ff4757',
            1.0: '#8B0000',
        }
    });

    if (state.currentLayer === 'heatmap' || state.currentLayer === 'both') {
        heatLayer.addTo(map);
    }
}

function updateMarkers(hotspots) {
    markersLayer.clearLayers();
    circleLayer.clearLayers();

    hotspots.forEach(h => {
        const coords = DISTRICTS_COORDS[h.district];
        if (!coords) return;

        const risk = h.risk_level || 'LOW';
        const color = RISK_COLORS[risk] || '#6b7280';
        const prob = (h.hotspot_probability * 100).toFixed(1);

        // Marker me ngjyrë
        L.circleMarker(coords, {
            radius: 8,
            color: 'white',
            weight: 2,
            fillColor: color,
            fillOpacity: 1,
        })
        .bindPopup(`
            <div style="font-family: Inter, sans-serif; min-width: 240px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                    <div style="width: 12px; height: 12px; border-radius: 50%; background: ${color}; box-shadow: 0 0 12px ${color};"></div>
                    <h3 style="margin: 0; color: ${color}; font-size: 16px;">${h.district}</h3>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #9ca3af;">Niveli i rrezikut:</span>
                        <span style="color: ${color}; font-weight: 700;">${risk}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #9ca3af;">Probabiliteti:</span>
                        <span style="font-weight: 700;">${prob}%</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #9ca3af;">Raporte (7d):</span>
                        <span style="font-weight: 700;">${h.reports_7d || 0}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #9ca3af;">Konfirmuar:</span>
                        <span style="font-weight: 700;">${h.confirmed_7d || 0}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #9ca3af;">Popullsia:</span>
                        <span style="font-weight: 700;">${h.population.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        `)
        .addTo(circleLayer);

        // Label me emrin e lagjes
        L.marker(coords, {
            icon: L.divIcon({
                className: 'district-label',
                html: `<div style="
                    color: white;
                    font-size: 10px;
                    font-weight: 700;
                    text-shadow: 0 0 4px #000, 0 0 4px #000, 0 0 8px #000;
                    white-space: nowrap;
                    letter-spacing: 0.5px;
                ">${h.district}</div>`,
                iconSize: [80, 14],
                iconAnchor: [40, -12],
            })
        }).addTo(markersLayer);
    });
}

function updateMap(hotspots) {
    updateHeatmap(hotspots);
    updateMarkers(hotspots);
}

// ═══════════════ CHARTS ═══════════════

let predictionChart, historyChart;
let sparklines = {};

function initPredictionChart() {
    const ctx = document.getElementById('predictionChart').getContext('2d');
    
    const scenarios = getScenarioData();
    
    if (predictionChart) predictionChart.destroy();

    predictionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: scenarios.labels,
            datasets: [
                {
                    label: 'Pa ndërhyrje',
                    data: scenarios.noIntervention,
                    borderColor: '#ff4757',
                    backgroundColor: 'rgba(255, 71, 87, 0.08)',
                    borderWidth: 2.5,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    fill: true,
                },
                {
                    label: 'Me masa',
                    data: scenarios.withMeasures,
                    borderColor: '#2ed573',
                    backgroundColor: 'rgba(46, 213, 115, 0.08)',
                    borderWidth: 2.5,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    fill: true,
                },
                {
                    label: 'Objektivi',
                    data: scenarios.target,
                    borderColor: '#00d4ff',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [6, 6],
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    fill: false,
                },
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#131938',
                    borderColor: '#1e2655',
                    borderWidth: 1,
                    titleColor: '#e8eaf6',
                    bodyColor: '#e8eaf6',
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: true,
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(30, 38, 85, 0.4)', drawBorder: false },
                    ticks: { color: '#6b7280', font: { size: 10 }, maxTicksLimit: 8 }
                },
                y: {
                    grid: { color: 'rgba(30, 38, 85, 0.4)', drawBorder: false },
                    ticks: { 
                        color: '#6b7280', 
                        font: { size: 10 },
                        callback: (v) => v >= 1000 ? (v/1000).toFixed(0) + 'K' : v
                    }
                }
            }
        }
    });
}

function getScenarioData() {
    const labels = Array.from({length: 31}, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d.toLocaleDateString('sq-AL', { day: 'numeric', month: 'short' });
    });

    // Skenarë të ndryshëm
    let noIntervention, withMeasures, target;
    
    if (state.currentScenario === 'no-intervention') {
        noIntervention = labels.map((_, i) => 
            Math.round(8000 * Math.exp(0.10 * i) / (1 + Math.exp(0.10 * (i - 22))))
        );
        withMeasures = noIntervention.map(v => v * 0.75);
        target = noIntervention.map(v => v * 0.5);
    } else if (state.currentScenario === 'partial') {
        noIntervention = labels.map((_, i) => 
            Math.round(6000 * Math.exp(0.09 * i) / (1 + Math.exp(0.09 * (i - 24))))
        );
        withMeasures = noIntervention.map(v => v * 0.65);
        target = noIntervention.map(v => v * 0.4);
    } else {
        noIntervention = labels.map((_, i) => 
            Math.round(4000 * Math.exp(0.12 * i) / (1 + Math.exp(0.12 * (i - 20))))
        );
        withMeasures = labels.map((_, i) => 
            Math.round(4000 * Math.exp(0.06 * i) / (1 + Math.exp(0.06 * (i - 28))))
        );
        target = labels.map((_, i) => 
            Math.round(Math.min(5000, 4000 * Math.exp(0.03 * i)))
        );
    }

    return { labels, noIntervention, withMeasures, target };
}

function initSparklines() {
    const configs = [
        { id: 'sparkline-active', color: '#ff4757' },
        { id: 'sparkline-recovered', color: '#2ed573' },
        { id: 'sparkline-deaths', color: '#9ca3af' },
        { id: 'sparkline-rt', color: '#ffa502' },
    ];

    configs.forEach(({ id, color }) => {
        const el = document.getElementById(id);
        if (!el) return;

        if (sparklines[id]) sparklines[id].destroy();

        const data = Array.from({length: 20}, () => Math.random() * 100);

        sparklines[id] = new Chart(el, {
            type: 'line',
            data: {
                labels: Array.from({length: 20}, (_, i) => i),
                datasets: [{
                    data,
                    borderColor: color,
                    borderWidth: 1.5,
                    tension: 0.4,
                    pointRadius: 0,
                    fill: {
                        target: 'origin',
                        above: color + '20',
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: { x: { display: false }, y: { display: false } },
                elements: { line: { borderCapStyle: 'round' } }
            }
        });
    });
}

// ═══════════════ DATA FETCHING ═══════════════

async function fetchDashboard() {
    try {
        const res = await fetch(`${API_BASE}/api/dashboard`);
        if (!res.ok) throw new Error('API error');
        return await res.json();
    } catch (e) {
        console.error('Dashboard error:', e);
        showNotification('Gabim në lidhje me API', 'error');
        return null;
    }
}

async function fetchSimulationHistory() {
    try {
        const res = await fetch(`${API_BASE}/api/simulation/history`);
        if (!res.ok) throw new Error('API error');
        return await res.json();
    } catch (e) {
        console.error('History error:', e);
        return null;
    }
}

async function submitCitizenReport(report) {
    try {
        const res = await fetch(`${API_BASE}/api/reports/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(report),
        });
        if (!res.ok) throw new Error('API error');
        return await res.json();
    } catch (e) {
        console.error('Report error:', e);
        return null;
    }
}

// ═══════════════ UI UPDATE ═══════════════

function updateUI(data) {
    if (!data) return;
    
    state.dashboardData = data;

    // Update stat cards
    if (data.simulation) {
        const sim = data.simulation;
        
        const activeEl = document.querySelector('.stat-value.danger');
        if (activeEl) activeEl.textContent = sim.real_active.toLocaleString();
        
        const rtEl = document.querySelector('.stat-value.warning');
        if (rtEl) rtEl.textContent = sim.rt.toFixed(2);
        
        // Deaths
        const deathsEls = document.querySelectorAll('.stat-value');
        if (deathsEls[2]) deathsEls[2].textContent = sim.real_deaths.toLocaleString();
    }

    // Update map
    if (data.hotspots) {
        updateMap(data.hotspots);
        updateHotspotsList(data.hotspots);
    }

    // Update timestamp
    const lastUpdate = document.getElementById('last-update');
    if (lastUpdate) {
        lastUpdate.textContent = new Date().toLocaleTimeString('sq-AL', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
}

function updateHotspotsList(hotspots) {
    // Nuk kemi listë në dashboard-in e ri, por mund të shtojmë
    // Për momentin, thjesht log
    console.log('Hotspots updated:', hotspots.length);
}

// ═══════════════ INTERACTIONS ═══════════════

function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            const page = item.dataset.page;
            const title = item.querySelector('span:last-child').textContent;
            
            state.currentPage = page;
            
            const titleEl = document.getElementById('page-title');
            if (titleEl) titleEl.textContent = title;
            
            showNotification(`Naviguar në: ${title}`, 'info');
        });
    });
}

function initMapControls() {
    document.querySelectorAll('.map-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.map-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const layer = btn.dataset.layer;
            state.currentLayer = layer;

            // Hiq të gjitha layer-at
            if (heatLayer) map.removeLayer(heatLayer);
            markersLayer.clearLayers();
            circleLayer.clearLayers();

            // Shto sipas zgjedhjes
            if (state.dashboardData && state.dashboardData.hotspots) {
                if (layer === 'heatmap' || layer === 'both') {
                    updateHeatmap(state.dashboardData.hotspots);
                }
                if (layer === 'markers' || layer === 'both') {
                    updateMarkers(state.dashboardData.hotspots);
                }
            }

            showNotification(`Layer: ${layer}`, 'info');
        });
    });
}

function initScenarioSelector() {
    const select = document.getElementById('scenario-select');
    if (!select) return;

    select.addEventListener('change', (e) => {
        state.currentScenario = e.target.value;
        
        // Rillogarit grafikun
        initPredictionChart();
        
        // Update scenario cards
        updateScenarioCards();
        
        showNotification(`Skenari: ${e.target.options[e.target.selectedIndex].text}`, 'success');
    });
}

function updateScenarioCards() {
    const scenarios = {
        'no-intervention': {
            a: { cases: 80000, peak: '5 Maj', deaths: 3200, overload: 98 },
            b: { cases: 60000, peak: '10 Maj', deaths: 2100, overload: 78 },
            c: { cases: 42000, peak: '17 Maj', deaths: 1200, overload: 52 },
        },
        'partial': {
            a: { cases: 60000, peak: '5 Maj', deaths: 2400, overload: 88 },
            b: { cases: 35000, peak: '12 Maj', deaths: 1400, overload: 62 },
            c: { cases: 22000, peak: '20 Maj', deaths: 700, overload: 38 },
        },
        'current': {
            a: { cases: 42310, peak: '5 Maj', deaths: 1870, overload: 94 },
            b: { cases: 28450, peak: '10 Maj', deaths: 1120, overload: 63 },
            c: { cases: 18540, peak: '17 Maj', deaths: 420, overload: 32 },
        },
        'ai-optimized': {
            a: { cases: 42310, peak: '5 Maj', deaths: 1870, overload: 94 },
            b: { cases: 28450, peak: '10 Maj', deaths: 1120, overload: 63 },
            c: { cases: 12000, peak: '25 Maj', deaths: 280, overload: 18 },
        },
    };

    const data = scenarios[state.currentScenario] || scenarios['current'];
    const cards = document.querySelectorAll('.scenario-card');

    if (cards.length >= 3) {
        // Update card A
        const cardA = cards[0];
        cardA.querySelectorAll('.metric-value')[0].textContent = data.a.cases.toLocaleString();
        cardA.querySelectorAll('.metric-value')[1].textContent = data.a.peak;
        cardA.querySelectorAll('.metric-value')[2].textContent = data.a.deaths.toLocaleString();
        cardA.querySelectorAll('.metric-value')[3].textContent = data.a.overload + '%';
        cardA.querySelector('.bar-fill').style.width = data.a.overload + '%';

        // Update card B
        const cardB = cards[1];
        cardB.querySelectorAll('.metric-value')[0].textContent = data.b.cases.toLocaleString();
        cardB.querySelectorAll('.metric-value')[1].textContent = data.b.peak;
        cardB.querySelectorAll('.metric-value')[2].textContent = data.b.deaths.toLocaleString();
        cardB.querySelectorAll('.metric-value')[3].textContent = data.b.overload + '%';
        cardB.querySelector('.bar-fill').style.width = data.b.overload + '%';

        // Update card C
        const cardC = cards[2];
        cardC.querySelectorAll('.metric-value')[0].textContent = data.c.cases.toLocaleString();
        cardC.querySelectorAll('.metric-value')[1].textContent = data.c.peak;
        cardC.querySelectorAll('.metric-value')[2].textContent = data.c.deaths.toLocaleString();
        cardC.querySelectorAll('.metric-value')[3].textContent = data.c.overload + '%';
        cardC.querySelector('.bar-fill').style.width = data.c.overload + '%';
    }
}

function initActionItems() {
    document.querySelectorAll('.action-item').forEach((item, idx) => {
        item.style.cursor = 'pointer';
        
        item.addEventListener('click', () => {
            const check = item.querySelector('.action-check');
            
            if (state.selectedActions.has(idx)) {
                state.selectedActions.delete(idx);
                check.style.color = '#6b7280';
                check.textContent = '○';
            } else {
                state.selectedActions.add(idx);
                check.style.color = '#2ed573';
                check.textContent = '✓';
            }
        });
    });
}

function initRefreshButton() {
    const btn = document.getElementById('refresh-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> Duke rifreskuar...';
        
        const data = await fetchDashboard();
        updateUI(data);
        
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = '<span>↻</span> Rifresko';
            showNotification('Të dhënat u rifreskuan', 'success');
        }, 500);
    });
}

function initGeneratePlanButton() {
    const btn = document.getElementById('generate-plan');
    if (!btn) return;

    btn.addEventListener('click', () => {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> Duke gjeneruar plan...';

        setTimeout(() => {
            // Gjenero plan masash
            const actions = state.selectedActions.size;
            const impact = Math.round(actions * 4.5);
            
            showNotification(
                `✓ Plan masash u gjenerua! ${actions} veprime, reduktim i pritur: -${impact}% raste të reja`,
                'success'
            );

            // Update scenario cards me planin e ri
            updateScenarioCards();

            btn.disabled = false;
            btn.innerHTML = '✨ Gjenero plan masash (AI)';
        }, 1500);
    });
}

function initCitizenReportForm() {
    // Formulari i qytetarit (në mobile app)
    const form = document.getElementById('citizen-report-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const report = {
            report_type: 'symptom',
            symptoms: [],
            severity: 3,
            area: 'Dardania',
            age_range: '30-44',
        };

        const result = await submitCitizenReport(report);
        if (result) {
            showNotification('Raporti u dërgua me sukses!', 'success');
        } else {
            showNotification('Gabim gjatë dërgimit', 'error');
        }
    });
}

// ═══════════════ NOTIFICATIONS ═══════════════

function showNotification(message, type = 'info') {
    const colors = {
        success: '#2ed573',
        error: '#ff4757',
        warning: '#ffa502',
        info: '#00d4ff',
    };

    const icons = {
        success: '✓',
        error: '✗',
        warning: '⚠',
        info: 'ℹ',
    };

    // Krijo toast
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #131938;
        border: 1px solid ${colors[type]};
        border-left: 4px solid ${colors[type]};
        color: #e8eaf6;
        padding: 14px 20px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.3s ease;
        max-width: 400px;
    `;
    
    toast.innerHTML = `
        <span style="color: ${colors[type]}; font-size: 16px;">${icons[type]}</span>
        <span>${message}</span>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Shto animacionet CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);

// ═══════════════ INIT ═══════════════

async function init() {
    console.log('🦠 EpiPrishtina — Initializing...');

    initMap();
    initNavigation();
    initMapControls();
    initScenarioSelector();
    initActionItems();
    initRefreshButton();
    initGeneratePlanButton();
    initCitizenReportForm();
    initPredictionChart();
    initSparklines();

    // Ngarko të dhënat fillestare
    const data = await fetchDashboard();
    updateUI(data);

    // Auto-refresh
    setInterval(async () => {
        const data = await fetchDashboard();
        updateUI(data);
    }, REFRESH_INTERVAL);

    console.log('✓ Ready');
}

window.addEventListener('DOMContentLoaded', init);