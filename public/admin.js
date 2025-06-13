document.addEventListener('DOMContentLoaded', () => {
    console.log("CLIENT-LOG: Initialisation du script administrateur.");

    // --- API UTILITY ---
    const api = {
        get: (url) => fetch(url).then(handleResponse),
        put: (url, data) => fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(handleResponse),
        delete: (url) => fetch(url, { method: 'DELETE' }).then(handleResponse),
        post: (url, data) => fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(handleResponse)
    };

    async function handleResponse(response) {
        const text = await response.text();
        const data = text ? JSON.parse(text) : {};
        if (!response.ok) {
            console.error('API Error Response:', data);
            return Promise.reject(data); // Rejette avec le message d'erreur de l'API
        }
        return data;
    }

    // --- MODAL MANAGEMENT ---
    const modalContainer = document.getElementById('modal-container');
    function showModal(title, message, type = 'info', onConfirm = null) {
        modalContainer.innerHTML = `
            <div class="modal-content">
              <h3 id="modal-title">${title}</h3>
              <div id="modal-body"><p>${message}</p></div>
              <div id="modal-actions" class="form-actions">
                ${type === 'confirm'
                  ? `<button id="modal-confirm-btn" class="modal-btn confirm">Confirmer</button>
                     <button id="modal-cancel-btn" class="modal-btn cancel">Annuler</button>`
                  : `<button id="modal-close-btn" class="modal-btn">Fermer</button>`
                }
              </div>
            </div>
        `;
        modalContainer.style.display = 'flex';
        
        const closeModal = () => modalContainer.style.display = 'none';
        
        const confirmBtn = document.getElementById('modal-confirm-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        const closeBtn = document.getElementById('modal-close-btn');

        if (confirmBtn) confirmBtn.onclick = () => { if (onConfirm) onConfirm(); closeModal(); };
        if (cancelBtn) cancelBtn.onclick = closeModal;
        if (closeBtn) closeBtn.onclick = closeModal;
    }
    
    // --- UI ELEMENTS & STATE ---
    const elements = {
        tabs: document.querySelectorAll('.admin-tab-btn'),
        contents: document.querySelectorAll('.admin-tab-content'),
        kpiAppointments: document.getElementById('kpi-daily-appointments'),
        kpiRevenue: document.getElementById('kpi-daily-revenue'),
        dailyChartCanvas: document.getElementById('daily-appointments-chart'),
        servicesChartCanvas: document.getElementById('service-distribution-chart'),
        calendarContainer: document.getElementById('calendar-container'),
        servicesTableBody: document.querySelector('#services-table tbody'),
        serviceForm: document.getElementById('service-form'),
        serviceFormTitle: document.getElementById('service-form-title'),
        serviceFormCancelBtn: document.getElementById('service-form-cancel'),
        hoursTableBody: document.querySelector('#hours-table tbody'),
        blocksTableBody: document.querySelector('#blocks-table tbody'),
        blockForm: document.getElementById('block-form'),
    };

    let dailyChart, servicesChart, calendar;

    // --- LOGIC FUNCTIONS BY TAB ---

    async function loadDashboard() {
        try {
            const [kpis, chartData] = await Promise.all([
                api.get('/api/admin/kpis/daily'),
                api.get('/api/admin/charts/weekly-overview')
            ]);
            elements.kpiAppointments.textContent = kpis.appointmentCount;
            elements.kpiRevenue.textContent = `${kpis.estimatedRevenue.toFixed(2)} €`;
            renderDailyAppointmentsChart(chartData.dailyAppointments);
            renderServiceDistributionChart(chartData.serviceDistribution);
        } catch (error) {
            showModal('Erreur Dashboard', error.message || 'Impossible de charger les données du tableau de bord.');
        }
    }

    function renderDailyAppointmentsChart({ labels, data }) {
        if (!elements.dailyChartCanvas) return;
        if (dailyChart) dailyChart.destroy();
        dailyChart = new Chart(elements.dailyChartCanvas.getContext('2d'), {
            type: 'bar', data: { labels, datasets: [{ label: 'RDV par jour', data, backgroundColor: 'rgba(212, 116, 99, 0.6)' }] },
            options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
        });
    }

    function renderServiceDistributionChart({ labels, data }) {
        if (!elements.servicesChartCanvas) return;
        if (servicesChart) servicesChart.destroy();
        servicesChart = new Chart(elements.servicesChartCanvas.getContext('2d'), {
            type: 'pie', data: { labels, datasets: [{ data, backgroundColor: ['#d47463', '#e8a89a', '#f5cec7', '#f2ebe9', '#6c757d', '#495057'] }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function initializeCalendar() {
        if (!elements.calendarContainer || !window.FullCalendar) return;
        calendar = new FullCalendar.Calendar(elements.calendarContainer, {
            initialView: 'timeGridWeek', locale: 'fr',
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
            editable: true, events: '/api/admin/appointments',
            slotMinTime: '09:00:00', slotMaxTime: '20:00:00',
            eventDrop: handleEventMove, eventResize: handleEventMove,
            eventClick: (info) => {
                showModal('Supprimer RDV?', `Voulez-vous vraiment supprimer le RDV de "${info.event.title}"?`, 'confirm', async () => {
                    try {
                        await api.delete(`/api/admin/appointments/${info.event.id}`);
                        info.event.remove();
                        showModal('Succès', 'Rendez-vous supprimé.');
                    } catch (err) {
                        showModal('Erreur', err.message || 'Impossible de supprimer le rendez-vous.');
                    }
                });
            }
        });
    }
    
    async function handleEventMove({ event, revert }) {
        showModal('Confirmer le changement ?', `Déplacer ce RDV ?`, 'confirm', async () => {
            try {
                await api.put(`/api/admin/appointments/${event.id}/move`, { start: event.start.toISOString(), end: event.end.toISOString() });
                showModal('Succès', 'Rendez-vous déplacé.');
            } catch (err) {
                showModal('Erreur', `La mise à jour a échoué: ${err.message}.`);
                revert();
            }
        });
    }
    
    async function loadServices() {
        try {
            const services = await api.get('/api/admin/services');
            elements.servicesTableBody.innerHTML = services.map(s => `<tr>
                <td>${s.title}</td><td>${s.duration} min</td><td>${s.price.toFixed(2)} €</td>
                <td class="action-cell">
                    <button class="edit-btn modal-btn" data-id="${s.id}">Modifier</button>
                    <button class="delete-btn modal-btn cancel" data-id="${s.id}">Supprimer</button>
                </td>
            </tr>`).join('');
        } catch(err) {
            elements.servicesTableBody.innerHTML = `<tr><td colspan="4" class="error">Erreur de chargement des services: ${err.message}</td></tr>`;
        }
    }

    function resetServiceForm() {
        elements.serviceForm.reset();
        elements.serviceForm.elements.id.value = '';
        elements.serviceFormTitle.textContent = "Ajouter une prestation";
    }

    async function loadHours() {
        try {
            const hours = await api.get('/api/admin/hours');
            const jours = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
            elements.hoursTableBody.innerHTML = Array.from({length: 7}, (_, i) => {
                const day = i + 1;
                const rowData = hours.find(h => h.day_of_week === day) || {};
                return `<tr><td>${jours[day]}</td>
                           <td><input type="time" class="hour-start" value="${rowData.start || ''}"/></td>
                           <td><input type="time" class="hour-end" value="${rowData.end || ''}"/></td>
                           <td><button class="modal-btn confirm" data-dow="${day}">Enregistrer</button></td></tr>`;
            }).join('');
        } catch(err) {
            elements.hoursTableBody.innerHTML = `<tr><td colspan="4" class="error">Erreur de chargement des horaires.</td></tr>`;
        }
    }
    
    async function loadBlocks() {
        try {
            const blocks = await api.get('/api/admin/blocks');
            elements.blocksTableBody.innerHTML = blocks.map(b => `<tr>
                <td>${b.id}</td><td>${new Date(b.start).toLocaleString('fr-FR')}</td><td>${new Date(b.end).toLocaleString('fr-FR')}</td>
                <td>${b.type}</td><td>${b.reason || ''}</td>
                <td><button class="delete-btn modal-btn cancel" data-id="${b.id}">Supprimer</button></td></tr>`
            ).join('');
        } catch(err) {
            elements.blocksTableBody.innerHTML = `<tr><td colspan="6" class="error">Erreur de chargement des blocages.</td></tr>`;
        }
    }

    // --- EVENT LISTENERS SETUP ---
    function setupEventListeners() {
        elements.tabs.forEach(btn => {
            btn.addEventListener('click', () => {
                elements.contents.forEach(content => content.style.display = 'none');
                elements.tabs.forEach(t => t.classList.remove('active-tab'));
                
                const targetId = btn.dataset.tab;
                document.getElementById(targetId).style.display = 'block';
                btn.classList.add('active-tab');

                if (targetId === 'planning-tab' && calendar) {
                    setTimeout(() => calendar.render(), 10); // Léger délai pour assurer le rendu correct
                }
            });
        });

        elements.servicesTableBody.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            if (e.target.matches('.edit-btn')) {
                try {
                    const service = await api.get(`/api/admin/services/${id}`);
                    elements.serviceFormTitle.textContent = "Modifier la prestation";
                    elements.serviceForm.elements.id.value = service.id;
                    elements.serviceForm.elements.title.value = service.title;
                    elements.serviceForm.elements.duration.value = service.duration;
                    elements.serviceForm.elements.price.value = service.price;
                } catch (err) {
                    showModal('Erreur', `Impossible de charger le service: ${err.message}`);
                }
            } else if (e.target.matches('.delete-btn')) {
                showModal('Confirmation', "Voulez-vous vraiment supprimer cette prestation ?", 'confirm', async () => {
                    try {
                        const result = await api.delete(`/api/admin/services/${id}`);
                        await loadServices();
                        showModal('Succès', result.message);
                    } catch (err) {
                        showModal('Erreur', err.message);
                    }
                });
            }
        });
        
        elements.serviceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            const id = data.id;
            const method = id ? 'put' : 'post';
            const url = id ? `/api/admin/services/${id}` : '/api/admin/services';
            
            try {
                const result = await api[method](url, data);
                resetServiceForm();
                await loadServices();
                showModal('Succès', result.message);
            } catch (err) {
                showModal('Erreur', err.message);
            }
        });

        elements.serviceFormCancelBtn.addEventListener('click', resetServiceForm);

        elements.hoursTableBody.addEventListener('click', async (e) => {
            if(e.target.matches('button')){
                const tr = e.target.closest('tr');
                const data = { 
                    day_of_week: e.target.dataset.dow, 
                    start: tr.querySelector('.hour-start').value || null, 
                    end: tr.querySelector('.hour-end').value || null
                };
                try {
                    const result = await api.post('/api/admin/hours', data); 
                    showModal('Succès', result.message); 
                } catch (err) {
                    showModal('Erreur', err.message);
                }
            }
        });

        elements.blockForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.target));
            try {
                const result = await api.post('/api/admin/block', data);
                showModal('Succès', result.message);
                e.target.reset();
                await loadBlocks();
            } catch (err) {
                showModal('Erreur', err.message);
            }
        });

        elements.blocksTableBody.addEventListener('click', (e) => {
            if (e.target.matches('.delete-btn')) {
                showModal('Confirmation', "Voulez-vous vraiment supprimer ce blocage ?", 'confirm', async () => {
                    try {
                        const result = await api.delete(`/api/admin/blocks/${e.target.dataset.id}`);
                        await loadBlocks();
                        showModal('Succès', result.message);
                    } catch (err) {
                        showModal('Erreur', err.message);
                    }
                });
            }
        });
    }

    // --- INITIALIZATION ---
    function init() {
        initializeCalendar();
        setupEventListeners();
        
        // Charger les données pour tous les onglets
        loadDashboard();
        loadServices();
        loadHours();
        loadBlocks();

        // Afficher le premier onglet par défaut
        if(elements.tabs.length > 0) {
            elements.tabs[0].click();
        }
    }
    
    init();
});
