document.addEventListener('DOMContentLoaded', () => {

    // --- UTILITIES & API ---
    /**
     * Gère la réponse d'un appel fetch, en parsant le JSON et en gérant les erreurs HTTP.
     * @param {Response} response - L'objet Response de l'appel fetch.
     * @returns {Promise<any>} Une promesse qui résout avec le corps JSON en cas de succès, ou rejette avec l'erreur.
     */
    async function handleResponse(response) {
        const body = await response.json().catch(() => ({
            message: `Réponse invalide du serveur (statut ${response.status})`
        }));
        
        if (!response.ok) {
            console.error("Erreur API reçue:", body);
            return Promise.reject(body);
        }
        
        return body;
    }

    const api = {
        get: (url) => fetch(url).then(handleResponse),
        post: (url, data) => fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(handleResponse),
    };

    // --- STATE & DOM ELEMENTS ---
    const state = {
        services: [],
        chosenService: null,
        chosenDay: null,
        chosenSlot: null,
        calendarOffset: 0,
        currentStep: 1,
    };

    const elements = {
        servicesContainer: document.getElementById('services-container'),
        serviceListContainer: document.getElementById('service-list-container'),
        nextFiveSlotsContainer: document.getElementById('next-five-slots-container'),
        nextFiveSlotsList: document.getElementById('next-five-slots-list'),
        bookingContainer: document.getElementById('booking-container'),
        bookingServicesView: document.getElementById('booking-services'),
        bookingMain: document.getElementById('booking-main'),
        bookingCalendarView: document.getElementById('booking-calendar-view'),
        bookingSlotsView: document.getElementById('booking-slots-view'),
        calMonthYear: document.getElementById('cal-month-year'),
        calGrid: document.getElementById('cal-grid'),
        calPrevBtn: document.getElementById('cal-prev-month'),
        calNextBtn: document.getElementById('cal-next-month'),
        slotsContainer: document.getElementById('slots-container'),
        slotsSelectedDate: document.getElementById('slots-selected-date'),
        progressBar: document.getElementById('progress-bar'),
        progressSteps: document.querySelectorAll('.progress-step'),
        backToServicesBtn: document.getElementById('back-to-services-btn'),
        backToCalendarBtn: document.getElementById('back-to-calendar-btn'),
        modalContainer: document.getElementById('modal-container'),
    };
    
    // --- UI LOGIC ---

    function updateProgressBar(step) {
        state.currentStep = step;
        const totalSteps = elements.progressSteps.length;
        const percentage = totalSteps > 1 ? (step - 1) / (totalSteps - 1) * 100 : 0;
        
        if (elements.progressBar) {
            elements.progressBar.style.setProperty('--progress-width', `${percentage}%`);
        }

        elements.progressSteps.forEach(s => {
            const stepNum = parseInt(s.dataset.step, 10);
            s.classList.remove('active', 'completed');
            if (stepNum < state.currentStep) s.classList.add('completed');
            else if (stepNum === state.currentStep) s.classList.add('active');
        });
    }

    function showServicesView() {
        elements.bookingMain.classList.add('hidden');
        elements.bookingServicesView.classList.remove('hidden');
        updateProgressBar(1);
    }

    function showCalendarView() {
        elements.bookingMain.classList.remove('hidden');
        elements.bookingServicesView.classList.add('hidden');
        elements.bookingCalendarView.classList.remove('hidden');
        elements.bookingSlotsView.classList.add('hidden');
        loadAndDisplayNextFiveSlots();
        updateProgressBar(2);
        renderCalendar();
    }
    
    function showSlotsView() {
        elements.bookingCalendarView.classList.add('hidden');
        elements.bookingSlotsView.classList.remove('hidden');
        setTimeout(() => elements.bookingSlotsView.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }

    // --- MODAL MANAGEMENT & FORM VALIDATION ---
    
    function showConfirmationModal(slot) {
        updateProgressBar(3);
        state.chosenSlot = slot;
        const { title } = state.chosenService;
        const date = new Date(slot.start).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        const time = new Date(slot.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        elements.modalContainer.innerHTML = `
            <div class="modal-content">
              <h3>Confirmez votre rendez-vous</h3>
              <div id="modal-body">
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
              </div>
              <div id="modal-actions" class="form-actions">
                  <button id="modal-confirm-btn" class="modal-btn confirm">Confirmer</button>
                  <button id="modal-cancel-btn" class="modal-btn cancel">Annuler</button>
              </div>
            </div>`;
        elements.modalContainer.style.display = 'flex';
        
        const nameInput = document.getElementById('appointment-name');
        const phoneInput = document.getElementById('appointment-phone');

        nameInput.addEventListener('input', () => validateField(nameInput, /^[a-zA-Z\u00C0-\u017F\s'-]{2,}$/, 'name-error', 'Veuillez entrer un nom valide.'));
        phoneInput.addEventListener('input', () => validateField(phoneInput, /^(0[1-9])(?:[ _.-]?(\d{2})){4}$/, 'phone-error', 'Format de téléphone invalide (10 chiffres).'));

        document.getElementById('modal-confirm-btn').addEventListener('click', handleBookingSubmit);
        document.getElementById('modal-cancel-btn').addEventListener('click', () => { hideModal(); updateProgressBar(2); });
    }
    
    function validateField(input, regex, errorId, message) {
        const errorEl = document.getElementById(errorId);
        const isValid = input.value && regex.test(input.value.trim());
        errorEl.textContent = isValid ? '' : message;
        input.classList.toggle('invalid', !isValid);
        return isValid;
    }

    function validateFullForm() {
        const isNameValid = validateField(document.getElementById('appointment-name'), /^[a-zA-Z\u00C0-\u017F\s'-]{2,}$/, 'name-error', 'Veuillez entrer un nom valide.');
        const isPhoneValid = validateField(document.getElementById('appointment-phone'), /^(0[1-9])(?:[ _.-]?(\d{2})){4}$/, 'phone-error', 'Format de téléphone invalide (10 chiffres).');
        return isNameValid && isPhoneValid;
    }
    
    function showInfoModal(title, message, isSuccess = true) {
        elements.modalContainer.innerHTML = `
            <div class="modal-content">
              <h3>${title}</h3>
              <div id="modal-body"><p>${message}</p></div>
              <div id="modal-actions" class="form-actions">
                  <button id="modal-close-btn" class="modal-btn">Fermer</button>
              </div>
            </div>`;
        elements.modalContainer.style.display = 'flex';
        document.getElementById('modal-close-btn').addEventListener('click', () => {
            hideModal();
            if (isSuccess) resetBookingProcess();
        });
    }
    
    function hideModal() {
        elements.modalContainer.style.display = 'none';
    }
    
    function resetBookingProcess() {
        Object.assign(state, { chosenService: null, chosenDay: null, chosenSlot: null, calendarOffset: 0 });
        const selected = elements.serviceListContainer.querySelector('.service-item.selected');
        if (selected) selected.classList.remove('selected');
        showServicesView();
    }
    
    // --- BOOKING LOGIC ---
    function renderServicesList() {
        const renderTo = (container, template) => { if(container) container.innerHTML = template; };
        
        const serviceCardsHTML = state.services.map(s => `
            <div class="service-card">
                <div class="service-card-header">
                    <span class="service-card-title">${s.title}</span>
                    <span class="service-card-price">${s.price.toFixed(2)} €</span>
                </div>
                <div class="service-card-duration">Durée : ${s.duration} min</div>
            </div>`).join('');
        renderTo(elements.servicesContainer, serviceCardsHTML);
        
        const serviceItemsHTML = state.services.map(s => `
            <div class="service-item" data-id="${s.id}">
                <div>
                    <div class="service-title">${s.title}</div>
                    <div class="service-info">${s.duration} min · ${s.price.toFixed(2)} €</div>
                </div>
            </div>`).join('');
        renderTo(elements.serviceListContainer, serviceItemsHTML);
    }
    
    function renderCalendar() {
        const localBaseDate = new Date();
        localBaseDate.setHours(0, 0, 0, 0);
        const displayDate = new Date(localBaseDate.getFullYear(), localBaseDate.getMonth() + state.calendarOffset, 1);
        
        elements.calMonthYear.textContent = displayDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
        elements.calPrevBtn.disabled = state.calendarOffset <= 0;
        elements.calNextBtn.disabled = state.calendarOffset >= 2;
        
        const year = displayDate.getFullYear();
        const month = displayDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        elements.calGrid.innerHTML = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => `<div class="calendar-day-name">${d}</div>`).join('');
        
        const firstDayOfMonth = (new Date(year, month, 1).getDay() + 6) % 7; // Lundi = 0
        for (let i = 0; i < firstDayOfMonth; i++) elements.calGrid.insertAdjacentHTML('beforeend', '<div></div>');

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const currentDate = new Date(dateStr);
            const isPast = currentDate.setHours(0,0,0,0) < localBaseDate.getTime();
            const dow = currentDate.getDay();
            const isWeekend = dow === 0 || dow === 6;

            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            dayEl.textContent = day;

            if (isPast || isWeekend) {
                dayEl.classList.add('inactive');
            } else {
                dayEl.classList.add('available');
                dayEl.dataset.date = dateStr;
                if (dateStr === state.chosenDay) dayEl.classList.add('selected');
            }
            elements.calGrid.appendChild(dayEl);
        }
    }

    async function loadAndRenderTimeslots() {
        if (!state.chosenDay || !state.chosenService) return;
        renderCalendar();
        elements.slotsSelectedDate.textContent = new Date(state.chosenDay+"T12:00:00Z").toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        elements.slotsContainer.innerHTML = '<p class="slots-placeholder">Chargement...</p>';
        showSlotsView();

        try {
            const { slots } = await api.get(`/api/timeslots/day?date=${state.chosenDay}&serviceId=${state.chosenService.id}`);
            elements.slotsContainer.innerHTML = slots.length > 0
                ? slots.map(slot => `<button class="slot-btn" data-start="${slot.start}" data-end="${slot.end}">${new Date(slot.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</button>`).join('')
                : `<p class="slots-placeholder">Aucun créneau disponible ce jour.</p>`;
        } catch (error) {
            elements.slotsContainer.innerHTML = `<p class="slots-placeholder error">${error.message || 'Erreur de chargement.'}</p>`;
        }
    }
    
    async function loadAndDisplayNextFiveSlots() {
        if (!state.chosenService) return;
        elements.nextFiveSlotsContainer.classList.remove('hidden');
        elements.nextFiveSlotsList.innerHTML = '<p>Recherche des prochains créneaux...</p>';
        try {
            const { slots } = await api.get(`/api/timeslots/next-five?serviceId=${state.chosenService.id}`);
            elements.nextFiveSlotsList.innerHTML = (slots && slots.length > 0)
                ? slots.map(slot => {
                    const date = new Date(slot.start);
                    return `<button class="next-slot-item" data-start="${slot.start}" data-end="${slot.end}">${date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit'})}</button>`;
                }).join('')
                : '<p>Aucun créneau disponible prochainement.</p>';
        } catch (error) {
            elements.nextFiveSlotsList.innerHTML = `<p class="error">${error.message || 'Impossible de charger les créneaux.'}</p>`;
        }
    }

    async function handleBookingSubmit() {
        if (!validateFullForm()) return;
        const confirmButton = document.getElementById('modal-confirm-btn');
        confirmButton.disabled = true;
        confirmButton.textContent = 'Confirmation...';
        
        const data = { 
            title: document.getElementById('appointment-name').value, 
            phone: document.getElementById('appointment-phone').value, 
            start: state.chosenSlot.start, 
            end: state.chosenSlot.end,
            serviceName: state.chosenService.title,
            serviceId: state.chosenService.id,
        };
        
        try {
            await api.post('/api/appointments', data);
            updateProgressBar(4);
            const date = new Date(data.start).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
            const time = new Date(data.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            showInfoModal('Rendez-vous confirmé', `Votre rendez-vous pour la prestation "${state.chosenService.title}" le ${date} à ${time} est bien enregistré.`, true);
        } catch (error) {
            confirmButton.disabled = false;
            confirmButton.textContent = 'Confirmer';
            updateProgressBar(3);
            showInfoModal('Erreur de réservation', error.message || 'Impossible de prendre le rendez-vous. Veuillez réessayer.', false);
        }
    }
    
    // --- EVENT LISTENERS ---
    elements.serviceListContainer.addEventListener('click', (e) => {
        const serviceItem = e.target.closest('.service-item');
        if (!serviceItem) return;
        const serviceId = serviceItem.dataset.id;
        const currentSelected = elements.serviceListContainer.querySelector('.service-item.selected');
        if (currentSelected) currentSelected.classList.remove('selected');
        serviceItem.classList.add('selected');
        state.chosenService = state.services.find(s => s.id == serviceId);
        showCalendarView();
    });

    elements.calGrid.addEventListener('click', (e) => {
        if (e.target.matches('.calendar-day.available')) {
            state.chosenDay = e.target.dataset.date;
            loadAndRenderTimeslots();
        }
    });
    
    elements.slotsContainer.addEventListener('click', (e) => {
        if (e.target.matches('.slot-btn')) showConfirmationModal({ start: e.target.dataset.start, end: e.target.dataset.end });
    });
    
    elements.nextFiveSlotsList.addEventListener('click', e => {
        if (e.target.matches('.next-slot-item')) showConfirmationModal({ start: e.target.dataset.start, end: e.target.dataset.end });
    });

    elements.calPrevBtn.addEventListener('click', () => { if (state.calendarOffset > 0) { state.calendarOffset--; renderCalendar(); } });
    elements.calNextBtn.addEventListener('click', () => { if (state.calendarOffset < 2) { state.calendarOffset++; renderCalendar(); } });
    elements.backToServicesBtn.addEventListener('click', showServicesView);
    elements.backToCalendarBtn.addEventListener('click', showCalendarView);

    // --- INITIALIZATION ---
    function initializeCarousel() {
        const carousel = document.querySelector('.carousel-container');
        if (!carousel) return;
        const slides = carousel.querySelector('.carousel-slide');
        const images = carousel.querySelectorAll('.carousel-slide img');
        if (images.length <= 1) return;

        let currentIndex = 0;
        const dotsContainer = carousel.querySelector('.carousel-dots');
        dotsContainer.innerHTML = images.length > 1 ? Array.from(images, (_, i) => `<span class="carousel-dot" data-index="${i}"></span>`).join('') : '';
        const dots = dotsContainer.querySelectorAll('.carousel-dot');

        const updateCarousel = () => {
            slides.style.transform = `translateX(-${currentIndex * 100}%)`;
            dots.forEach(dot => dot.classList.toggle('active', parseInt(dot.dataset.index) === currentIndex));
        };
        
        carousel.querySelector('.carousel-btn.next').addEventListener('click', () => { currentIndex = (currentIndex + 1) % images.length; updateCarousel(); });
        carousel.querySelector('.carousel-btn.prev').addEventListener('click', () => { currentIndex = (currentIndex - 1 + images.length) % images.length; updateCarousel(); });
        dots.forEach(dot => dot.addEventListener('click', (e) => { currentIndex = parseInt(e.target.dataset.index); updateCarousel(); }));
        
        updateCarousel();
    }
    
    async function init() {
        try {
            state.services = await api.get('/api/services');
            renderServicesList();
        } catch (error) {
            const msg = `<p class="error" style="text-align:center; padding: 20px;">${error.message || 'Le module de réservation est indisponible pour le moment.'}</p>`;
            if (elements.bookingContainer) elements.bookingContainer.innerHTML = msg;
        }
        updateProgressBar(1);
        initializeCarousel();
    }
    
    init();
});
