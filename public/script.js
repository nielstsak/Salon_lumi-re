document.addEventListener('DOMContentLoaded', () => {

    // --- API & UTILITIES ---
    const api = {
        get: async (url) => fetch(url).then(handleResponse),
        post: async (url, data) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(handleResponse),
    };

    async function handleResponse(response) {
        const json = await response.json();
        if (!response.ok) return Promise.reject(json);
        return json;
    }

    // --- STATE MANAGEMENT ---
    const state = {
        services: [],
        chosenService: null,
        chosenDay: null,
        calendarOffset: 0,
    };

    // --- DOM ELEMENTS ---
    const serviceListContainer = document.getElementById('service-list-container');
    const bookingMain = document.getElementById('booking-main');
    const calMonthYear = document.getElementById('cal-month-year');
    const calGrid = document.getElementById('cal-grid');
    const calPrevBtn = document.getElementById('cal-prev-month');
    const calNextBtn = document.getElementById('cal-next-month');
    const slotsContainer = document.getElementById('slots-container');
    const slotsSelectedDate = document.getElementById('slots-selected-date');
    const tarifsContainer = document.getElementById('tarifs-container');
    
    // Modal Elements
    const modalContainer = document.getElementById('modal-container');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalActions = document.getElementById('modal-actions');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    let onConfirmCallback = null;

    // --- MODAL LOGIC ---
    function showConfirmationModal(slot) {
        state.chosenSlot = slot;
        const { title } = state.chosenService;
        const date = new Date(slot.start).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        const time = new Date(slot.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        modalTitle.textContent = 'Confirmez votre rendez-vous';
        modalBody.innerHTML = `
            <p style="margin-bottom: 20px;">
                <strong>Prestation:</strong> ${title}<br>
                <strong>Date:</strong> ${date} à ${time}
            </p>
            <form id="booking-confirmation-form" novalidate>
              <div>
                <label for="appointment-name">Votre Nom :</label>
                <input type="text" id="appointment-name" name="title" required autocomplete="name" />
                <div class="input-error" id="name-error"></div>
              </div>
              <div>
                <label for="appointment-phone">Votre Téléphone :</label>
                <input type="tel" id="appointment-phone" name="phone" required autocomplete="tel" placeholder="Ex: 0612345678" />
                <div class="input-error" id="phone-error"></div>
              </div>
            </form>
        `;
        modalActions.innerHTML = `
            <button id="modal-confirm-btn" class="modal-btn confirm">Confirmer</button>
            <button id="modal-cancel-btn" class="modal-btn cancel">Annuler</button>
        `;
        modalContainer.style.display = 'flex';

        // Re-attach listeners for new buttons
        document.getElementById('modal-confirm-btn').addEventListener('click', () => {
             if (onConfirmCallback) onConfirmCallback();
        });
        document.getElementById('modal-cancel-btn').addEventListener('click', hideModal);
        
        onConfirmCallback = handleBookingSubmit;
    }
    
    function showInfoModal(title, message) {
        modalTitle.textContent = title;
        modalBody.innerHTML = `<p>${message}</p>`;
        modalActions.innerHTML = `<button id="modal-close-btn" class="modal-btn">Fermer</button>`;
        modalContainer.style.display = 'flex';
        document.getElementById('modal-close-btn').addEventListener('click', hideModal);
    }
    
    function hideModal() {
        modalContainer.style.display = 'none';
        onConfirmCallback = null;
    }
    
    // --- FORM VALIDATION ---
    function validateForm() {
        const nameInput = document.getElementById('appointment-name');
        const phoneInput = document.getElementById('appointment-phone');
        const nameError = document.getElementById('name-error');
        const phoneError = document.getElementById('phone-error');
        
        let isValid = true;

        // Name validation: letters, spaces, hyphens, and accented characters
        const nameRegex = /^[a-zA-Z\u00C0-\u017F\s'-]+$/;
        if (!nameInput.value || !nameRegex.test(nameInput.value.trim())) {
            nameError.textContent = 'Veuillez entrer un nom valide.';
            isValid = false;
        } else {
            nameError.textContent = '';
        }

        // Phone validation: French phone number format (10 digits starting with 0)
        const phoneRegex = /^(0[1-9])(?:[ _.-]?(\d{2})){4}$/;
        if (!phoneInput.value || !phoneRegex.test(phoneInput.value)) {
            phoneError.textContent = 'Format de téléphone invalide (10 chiffres).';
            isValid = false;
        } else {
            phoneError.textContent = '';
        }

        return isValid;
    }

    // --- BOOKING LOGIC ---
    function renderServices() {
        serviceListContainer.innerHTML = state.services.map(s => `
            <div class="service-item" data-id="${s.id}">
                <div>
                    <div class="service-title">${s.title}</div>
                    <div class="service-info">${s.duration} min · ${s.price.toFixed(2)} €</div>
                </div>
            </div>
        `).join('');
    }
    
    serviceListContainer.addEventListener('click', (e) => {
        const serviceItem = e.target.closest('.service-item');
        if (!serviceItem) return;

        document.querySelectorAll('.service-item').forEach(item => item.classList.remove('selected'));
        serviceItem.classList.add('selected');

        state.chosenService = state.services.find(s => s.id == serviceItem.dataset.id);
        bookingMain.classList.remove('hidden');
        renderCalendar();
    });

    function renderCalendar() {
        // ... (Logic from previous version is correct)
        const baseDate = new Date();
        const displayDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + state.calendarOffset, 1);
        calMonthYear.textContent = displayDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
        calPrevBtn.disabled = state.calendarOffset <= 0;
        calNextBtn.disabled = state.calendarOffset >= 2;
        const year = displayDate.getFullYear();
        const month = displayDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        calGrid.innerHTML = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => `<div class="calendar-day-name">${d}</div>`).join('');
        const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
        for (let i = 0; i < offset; i++) {
            calGrid.insertAdjacentHTML('beforeend', '<div></div>');
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const dow = currentDate.getDay();
            let classes = "calendar-day";
            if (currentDate < today || dow === 0 || dow === 6) {
                classes += " inactive";
            } else {
                classes += " available";
            }
            if(state.chosenDay && currentDate.toDateString() === state.chosenDay.toDateString()){
                classes += " selected";
            }
            const dayEl = document.createElement('div');
            dayEl.className = classes;
            dayEl.textContent = day;
            if (!dayEl.classList.contains('inactive')) {
                dayEl.addEventListener('click', () => {
                    state.chosenDay = currentDate;
                    renderCalendar(); // Re-render to show selection
                    loadAndRenderTimeslots();
                });
            }
            calGrid.appendChild(dayEl);
        }
    }

    async function loadAndRenderTimeslots() {
        const dateStr = state.chosenDay.toISOString().split('T')[0];
        slotsSelectedDate.textContent = state.chosenDay.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        slotsContainer.innerHTML = '<p class="slots-placeholder">Chargement...</p>';

        try {
            const { slots } = await api.get(`/api/timeslots/day?date=${dateStr}&serviceId=${state.chosenService.id}`);
            slotsContainer.innerHTML = slots.length > 0
                ? slots.map(slot => `<button class="slot-btn" data-start="${slot.start}" data-end="${slot.end}">${new Date(slot.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</button>`).join('')
                : `<p class="slots-placeholder">Aucun créneau disponible.</p>`;
        } catch (error) {
            slotsContainer.innerHTML = `<p class="slots-placeholder error">Erreur de chargement.</p>`;
        }
    }

    slotsContainer.addEventListener('click', (e) => {
        if(e.target.matches('.slot-btn')){
            showConfirmationModal({ start: e.target.dataset.start, end: e.target.dataset.end });
        }
    });

    async function handleBookingSubmit() {
        if (!validateForm()) return;

        const form = document.getElementById('booking-confirmation-form');
        const data = {
            title: form.elements.title.value.trim(),
            phone: form.elements.phone.value.replace(/[\s.-]/g, ''),
            start: state.chosenSlot.start,
            end: state.chosenSlot.end,
        };
        
        try {
            await api.post('/api/appointments', data);
            hideModal();
            setTimeout(() => showInfoModal('Confirmation', 'Votre rendez-vous est enregistré !<br>À bientôt.'), 10);
            
            state.chosenDay = null;
            renderCalendar();
            slotsContainer.innerHTML = '<p class="slots-placeholder">Sélectionnez un jour pour voir les créneaux.</p>';

        } catch (error) {
            hideModal();
            setTimeout(() => showInfoModal('Erreur', error.message || 'Impossible de prendre le rendez-vous.'), 10);
        }
    }
    
    calPrevBtn.addEventListener('click', () => { state.calendarOffset--; renderCalendar(); });
    calNextBtn.addEventListener('click', () => { state.calendarOffset++; renderCalendar(); });

    // --- CAROUSEL LOGIC ---
    // (Logic from previous version is correct and implemented in the HTML/CSS)

    // --- INITIAL LOAD ---
    async function init() {
        try {
            state.services = await api.get('/api/services');
            renderServices();
            tarifsContainer.innerHTML = `<table class="tarif-table">${state.services.map(s => `<tr><td>${s.title}</td><td class="price-cell">${s.price.toFixed(2)} €</td></tr>`).join('')}</table>`;
        } catch (error) {
            // Handle error...
        }
    }
    
    init();
});
