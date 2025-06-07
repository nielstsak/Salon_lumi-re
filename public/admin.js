document.addEventListener('DOMContentLoaded', () => {

    // --- API & UTILITIES ---
    const api = {
        get: async (url) => fetch(url).then(handleResponse),
        post: async (url, data) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(handleResponse),
        put: async (url, data) => fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(handleResponse),
        delete: async (url) => fetch(url, { method: 'DELETE' }).then(handleResponse),
    };

    async function handleResponse(response) {
        const json = await response.json();
        if (!response.ok) return Promise.reject(json);
        return json;
    }

    // --- MODAL MANAGEMENT ---
    const modalContainer = document.getElementById('modal-container');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalActions = document.getElementById('modal-actions');
    let onConfirmCallback = null;

    function showModal(title, message, type = 'info', onConfirm = null) {
        modalTitle.textContent = title;
        modalBody.innerHTML = `<p>${message}</p>`;
        onConfirmCallback = onConfirm;
        let buttons = '';
        if (type === 'confirm') {
            buttons = `<button id="modal-confirm-btn" class="modal-btn confirm">Confirmer</button><button id="modal-cancel-btn" class="modal-btn cancel">Annuler</button>`;
        } else {
            buttons = `<button id="modal-close-btn" class="modal-btn">Fermer</button>`;
        }
        modalActions.innerHTML = buttons;
        modalContainer.style.display = 'flex';
        
        if (type === 'confirm') {
            document.getElementById('modal-confirm-btn').addEventListener('click', () => {
                if (onConfirmCallback) onConfirmCallback();
                hideModal();
            });
            document.getElementById('modal-cancel-btn').addEventListener('click', hideModal);
        } else {
            document.getElementById('modal-close-btn').addEventListener('click', hideModal);
        }
    }
    function hideModal() { modalContainer.style.display = 'none'; }

    // --- TABS MANAGEMENT ---
    const tabBtns = document.querySelectorAll('.admin-tab-btn');
    const tabContents = document.querySelectorAll('.admin-tab-content');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.tab;
            if (!targetId) return;
            tabContents.forEach(tc => tc.style.display = 'none');
            tabBtns.forEach(b => b.classList.remove('active-tab'));
            document.getElementById(targetId).style.display = 'block';
            btn.classList.add('active-tab');
        });
    });
    if (tabBtns.length > 0) tabBtns[0].click();

    // ===============================================
    // =============== CALENDRIER TAB ================
    // ===============================================
    const adminState = { monthOffset: 0, selectedDay: new Date().toISOString().split('T')[0] };
    const adminCalTitle = document.getElementById('admin-cal-title');
    const adminMonthCalendar = document.getElementById('admin-month-calendar');
    const calAdminPrev = document.getElementById('cal-admin-prev');
    const calAdminNext = document.getElementById('cal-admin-next');
    const adminChosenDaySpan = document.getElementById('admin-chosen-day');
    const adminDayTableBody = document.getElementById('admin-day-appointments-table').querySelector('tbody');

    async function loadAdminCalendar() {
        const displayDate = new Date(new Date().getFullYear(), new Date().getMonth() + adminState.monthOffset, 1);
        adminCalTitle.textContent = displayDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
        calAdminNext.disabled = adminState.monthOffset >= 2;
        calAdminPrev.disabled = adminState.monthOffset <= -2;

        const year = displayDate.getFullYear(), month = displayDate.getMonth();
        const lastDay = new Date(year, month + 1, 0).getDate();
        const dayList = Array.from({ length: lastDay }, (_, i) => `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`);
        
        try {
            const { dayCounts } = await api.post('/api/admin/month-appointments', { days: dayList });
            adminMonthCalendar.innerHTML = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => `<div class="calendar-day-name">${d}</div>`).join('');
            const offset = new Date(year, month, 1).getDay() === 0 ? 6 : new Date(year, month, 1).getDay() - 1;
            for (let i = 0; i < offset; i++) adminMonthCalendar.insertAdjacentHTML('beforeend', '<div></div>');
            
            dayList.forEach(dayStr => {
                const cell = document.createElement('div');
                cell.className = 'calendar-day available';
                if (dayStr === adminState.selectedDay) cell.classList.add('selected');
                cell.textContent = new Date(dayStr + "T12:00:00").getDate();
                if (dayCounts[dayStr] > 0) cell.innerHTML += `<span class="rdv-count-label">${dayCounts[dayStr]}</span>`;
                cell.addEventListener('click', () => {
                    adminState.selectedDay = dayStr;
                    loadAdminDayAppointments();
                    loadAdminCalendar(); // Re-render to update selection style
                });
                adminMonthCalendar.appendChild(cell);
            });
        } catch (error) { showModal('Erreur', 'Impossible de charger les données du calendrier.'); }
    }
    
    async function loadAdminDayAppointments() {
        adminChosenDaySpan.textContent = new Date(adminState.selectedDay + "T12:00:00").toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        adminDayTableBody.innerHTML = `<tr><td colspan="6">Chargement...</td></tr>`;
        try {
            const appointments = await api.get(`/api/admin/day-appointments?day=${adminState.selectedDay}`);
            adminDayTableBody.innerHTML = appointments.length === 0
                ? '<tr><td colspan="6">Aucun rendez-vous pour ce jour.</td></tr>'
                : appointments.map(rdv => `<tr>
                    <td>${rdv.id}</td><td>${rdv.title}</td>
                    <td>${new Date(rdv.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>${new Date(rdv.end).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>${rdv.phone || ''}</td><td class="action-cell"><button class="delete-btn" data-id="${rdv.id}">Supprimer</button></td>
                   </tr>`).join('');
        } catch (error) { adminDayTableBody.innerHTML = '<tr><td colspan="6">Erreur de chargement des rendez-vous.</td></tr>'; }
    }

    calAdminPrev.addEventListener('click', () => { adminState.monthOffset--; loadAdminCalendar(); });
    calAdminNext.addEventListener('click', () => { adminState.monthOffset++; loadAdminCalendar(); });
    adminDayTableBody.addEventListener('click', e => {
        if (e.target.matches('.delete-btn')) {
            showModal('Confirmation', "Supprimer ce rendez-vous ? L'action est irréversible.", 'confirm', async () => {
                try { await api.delete(`/api/admin/appointments/${e.target.dataset.id}`); loadAdminDayAppointments(); loadAdminCalendar(); } 
                catch (err) { showModal('Erreur', err.message || 'La suppression a échoué.'); }
            });
        }
    });

    // --- SERVICES TAB ---
    const servicesTableBody = document.querySelector('#services-table tbody'), serviceForm = document.getElementById('service-form');
    async function loadServices() {
        try {
            servicesTableBody.innerHTML = (await api.get('/api/admin/services')).map(s => `<tr>
                <td>${s.title}</td><td>${s.duration} min</td><td>${s.price.toFixed(2)} €</td>
                <td class="action-cell"><button class="edit-btn" data-id="${s.id}">Modifier</button><button class="delete-btn" data-id="${s.id}">Supprimer</button></td>
            </tr>`).join('');
        } catch { showModal('Erreur', 'Impossible de charger les services.'); }
    }
    servicesTableBody.addEventListener('click', async e => {
        const id = e.target.dataset.id;
        if (e.target.matches('.edit-btn')) {
            const service = (await api.get('/api/admin/services')).find(s => s.id == id);
            if (!service) return;
            document.getElementById('service-form-title').textContent = "Modifier la prestation";
            serviceForm.elements.id.value = service.id;
            serviceForm.elements.title.value = service.title;
            serviceForm.elements.duration.value = service.duration;
            serviceForm.elements.price.value = service.price;
        } else if (e.target.matches('.delete-btn')) {
            showModal('Confirmation', "Supprimer cette prestation ?", 'confirm', async () => {
                try { await api.delete(`/api/admin/services/${id}`); loadServices(); } 
                catch (err) { showModal('Erreur', err.message || 'Suppression échouée.'); }
            });
        }
    });
    serviceForm.addEventListener('submit', async e => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        const id = data.id;
        const method = id ? 'put' : 'post';
        const url = id ? `/api/admin/services/${id}` : '/api/admin/services';
        try { await api[method](url, data); serviceForm.reset(); document.getElementById('service-form-title').textContent = "Ajouter une prestation"; loadServices(); } 
        catch (err) { showModal('Erreur', err.message || 'Enregistrement échoué.'); }
    });
    document.getElementById('service-form-cancel').addEventListener('click', () => {
        serviceForm.reset();
        document.getElementById('service-form-title').textContent = "Ajouter une prestation";
        serviceForm.elements.id.value = '';
    });


    // --- HOURS TAB ---
    const hoursTableBody = document.querySelector('#hours-table tbody');
    async function loadHours() {
        try {
            const hours = await api.get('/api/admin/hours');
            const jours = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
            hoursTableBody.innerHTML = Array.from({length: 7}, (_, i) => i + 1).map(d => {
                const rowData = hours.find(h => h.day_of_week === d) || {};
                return `<tr><td>${jours[d % 7]}</td>
                           <td><input type="time" class="hour-start" value="${rowData.start || ''}"/></td>
                           <td><input type="time" class="hour-end" value="${rowData.end || ''}"/></td>
                           <td><button class="modal-btn confirm" data-dow="${d}">Enregistrer</button></td></tr>`;
            }).join('');
        } catch { showModal('Erreur', 'Impossible de charger les horaires.'); }
    }
    hoursTableBody.addEventListener('click', async e => {
        if(e.target.matches('button')){
            const tr = e.target.closest('tr');
            try { await api.post('/api/admin/hours', { day_of_week: e.target.dataset.dow, start: tr.querySelector('.hour-start').value, end: tr.querySelector('.hour-end').value }); showModal('Succès', 'Horaire sauvegardé.'); } 
            catch (err) { showModal('Erreur', err.message || 'Sauvegarde échouée.'); }
        }
    });

    // --- BLOCKS TAB ---
    const blocksTableBody = document.querySelector('#blocks-table tbody');
    async function loadBlocks() {
        try {
            blocksTableBody.innerHTML = (await api.get('/api/admin/blocks')).map(b => `<tr>
                <td>${b.id}</td><td>${new Date(b.start).toLocaleString('fr-FR')}</td><td>${new Date(b.end).toLocaleString('fr-FR')}</td>
                <td>${b.type}</td><td>${b.reason || ''}</td><td><button class="delete-btn" data-id="${b.id}">Supprimer</button></td>
            </tr>`).join('');
        } catch { showModal('Erreur', 'Impossible de charger les blocages.'); }
    }
    document.getElementById('block-form').addEventListener('submit', async e => {
        e.preventDefault();
        try { await api.post('/api/admin/block', Object.fromEntries(new FormData(e.target))); showModal('Succès', 'Blocage ajouté.'); e.target.reset(); loadBlocks(); }
        catch (err) { showModal('Erreur', err.message || 'Ajout échoué.'); }
    });
    document.getElementById('vacation-form').addEventListener('submit', async e => {
        e.preventDefault();
        try { await api.post('/api/admin/vacation', Object.fromEntries(new FormData(e.target))); showModal('Succès', 'Vacances ajoutées.'); e.target.reset(); loadBlocks(); }
        catch (err) { showModal('Erreur', err.message || 'Ajout échoué.'); }
    });
    blocksTableBody.addEventListener('click', e => {
        if (e.target.matches('.delete-btn')) {
            showModal('Confirmation', "Supprimer ce blocage ?", 'confirm', async () => {
                try { await api.delete(`/api/admin/blocks/${e.target.dataset.id}`); loadBlocks(); }
                catch (err) { showModal('Erreur', err.message || 'Suppression échouée.'); }
            });
        }
    });

    // --- INITIALIZATION ---
    function init() {
        loadAdminCalendar();
        loadAdminDayAppointments();
        loadServices();
        loadHours();
        loadBlocks();
    }
    init();
});
