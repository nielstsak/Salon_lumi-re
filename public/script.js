document.addEventListener('DOMContentLoaded', function() {

  /* ============ STEP 1: Choose Service ============ */
  const step1        = document.getElementById('step1');
  const serviceList  = document.getElementById('service-list');

  /* ============ STEP 2: Monthly Calendar ============ */
  const step2        = document.getElementById('step2');
  const monthTitle   = document.getElementById('month-title');
  const monthCalendar= document.getElementById('month-calendar');
  const calPrevBtn   = document.querySelector('.cal-prev-month');
  const calNextBtn   = document.querySelector('.cal-next-month');
  const sameDayMsg   = document.getElementById('same-day-message');

  /* ============ STEP 2b: Day Timeslots ============ */
  const step2b       = document.getElementById('step2b');
  const selectedDateSpan = document.getElementById('selected-date');
  const timeslotsContainer = document.getElementById('timeslots-container');

  /* ============ STEP 3: Confirmation ============ */
  const step3        = document.getElementById('step3');
  const chosenServiceNameSpan = document.getElementById('chosen-service-name');
  const chosenDateSpan   = document.getElementById('chosen-date');
  const chosenTimeSpan   = document.getElementById('chosen-time');
  const bookingForm      = document.getElementById('booking-form');

  const loadingSpinner   = document.getElementById('loading-spinner');
  const errorMessage     = document.getElementById('error-message');

  let allServices    = [];
  let chosenService  = null;
  let chosenDay      = null;
  let chosenStart    = null;
  let chosenEnd      = null;
  let selectedMonthOffset = 0;

  // Load services
  fetch('/api/services')
    .then(r => r.json())
    .then(data => {
      allServices = data;
      serviceList.innerHTML = '';
      data.forEach(s => {
        const div = document.createElement('div');
        div.classList.add('service-item');
        div.innerHTML = `
          <div>
            <div class="service-title">${s.title}</div>
            <div class="service-info">${s.duration}min · à partir de ${s.price} €</div>
          </div>
          <button class="choose-service-btn">Choisir</button>
        `;
        div.querySelector('.choose-service-btn').addEventListener('click', () => {
          chosenService = s;
          goToStep2();
        });
        serviceList.appendChild(div);
      });
    })
    .catch(err => {
      console.error(err);
      serviceList.innerHTML = "<p>Impossible de charger les prestations.</p>";
    });

  function goToStep2() {
    step1.style.display = 'none';
    step2.style.display = 'block';
    step2b.style.display= 'none';
    step3.style.display = 'none';
    selectedMonthOffset = 0;
    loadMonthCalendar();
  }

  // ================== LOAD MONTH CALENDAR ==================
  function loadMonthCalendar() {
    monthCalendar.innerHTML = '';
    errorMessage.style.display='none';
    loadingSpinner.style.display='block';
    sameDayMsg.style.display='none';

    const baseDate = new Date();
    let displayYear  = baseDate.getFullYear();
    let displayMonth = baseDate.getMonth();

    let totalMonth = displayMonth + selectedMonthOffset;
    while(totalMonth<0)  { totalMonth+=12; displayYear--; }
    while(totalMonth>11) { totalMonth-=12; displayYear++; }

    calNextBtn.disabled = (selectedMonthOffset>=2);
    calPrevBtn.disabled = (selectedMonthOffset<=0);

    let firstDayDate = new Date(displayYear, totalMonth, 1);
    let monthName = firstDayDate.toLocaleString('fr-FR', { month:'long', year:'numeric' });
    monthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    monthTitle.textContent = `${monthName}`;

    const lastDayOfMonth = new Date(displayYear, totalMonth+1, 0).getDate();

    // headings
    const daysOfWeek = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
    const headingRow = document.createElement('div');
    headingRow.classList.add('month-cal-row');
    daysOfWeek.forEach(dayText => {
      const cell = document.createElement('div');
      cell.classList.add('month-cal-cell','month-cal-header');
      cell.textContent = dayText;
      headingRow.appendChild(cell);
    });
    monthCalendar.appendChild(headingRow);

    let offsetStart = new Date(displayYear, totalMonth, 1).getDay(); 
    if(offsetStart===0) offsetStart=7;
    const row1 = document.createElement('div');
    row1.classList.add('month-cal-row');

    for(let i=1; i<offsetStart; i++){
      const emptyCell = document.createElement('div');
      emptyCell.classList.add('month-cal-cell','month-cal-empty');
      row1.appendChild(emptyCell);
    }
    let currentColCount = offsetStart-1;
    let currentRow = row1;
    const today = new Date(); today.setHours(0,0,0,0);

    for(let d=1; d<=lastDayOfMonth; d++){
      if(currentColCount>=7){
        monthCalendar.appendChild(currentRow);
        currentRow = document.createElement('div');
        currentRow.classList.add('month-cal-row');
        currentColCount=0;
      }
      const dayCell = document.createElement('div');
      dayCell.classList.add('month-cal-cell','month-cal-day');
      dayCell.textContent = d;

      const dayDate = new Date(displayYear, totalMonth, d);
      dayDate.setHours(0,0,0,0);
      const dow = dayDate.getDay()||7; 
      if(dayDate<today) {
        dayCell.classList.add('day-past');
      } else if(dow===6||dow===7) {
        dayCell.classList.add('day-closed');
      }

      dayCell.addEventListener('click', () => {
        // unselect all
        document.querySelectorAll('.month-cal-day.selected-day')
          .forEach(el=>el.classList.remove('selected-day'));

        // select
        dayCell.classList.add('selected-day');
        chosenDay = dayDate;
        loadTimeslotsForDay(dayDate);
      });

      currentRow.appendChild(dayCell);
      currentColCount++;
    }
    if(currentColCount>0){
      while(currentColCount<7){
        const emptyCell = document.createElement('div');
        emptyCell.classList.add('month-cal-cell','month-cal-empty');
        currentRow.appendChild(emptyCell);
        currentColCount++;
      }
      monthCalendar.appendChild(currentRow);
    } else {
      monthCalendar.appendChild(currentRow);
    }
    loadingSpinner.style.display='none';
  }

  calPrevBtn.addEventListener('click', () => {
    if(selectedMonthOffset>0){
      selectedMonthOffset--;
      loadMonthCalendar();
    }
  });
  calNextBtn.addEventListener('click', () => {
    if(selectedMonthOffset<2){
      selectedMonthOffset++;
      loadMonthCalendar();
    }
  });

  // ================== LOAD TIMESLOTS FOR DAY ==================
  function loadTimeslotsForDay(dateObj) {
    step2b.style.display='block';
    step3.style.display='none';
    errorMessage.style.display='none';
    timeslotsContainer.innerHTML='';

    selectedDateSpan.textContent = dateObj.toLocaleDateString('fr-FR',{
      weekday:'long', day:'numeric', month:'long', year:'numeric'
    });

    const dayOfWeek = dateObj.getDay()||7;
    const now=new Date(); now.setHours(0,0,0,0);
    if(dateObj.getTime()===now.getTime()){
      // same day => show message
      sameDayMsg.style.display='block';
      timeslotsContainer.innerHTML='Aucun créneau en ligne pour aujourd\'hui';
      return;
    } else {
      sameDayMsg.style.display='none';
    }
    if(dayOfWeek===6||dayOfWeek===7) {
      timeslotsContainer.innerHTML='<p>Jour de fermeture.</p>';
      return;
    }
    if(dateObj<now){
      timeslotsContainer.innerHTML='<p>Cette date est passée.</p>';
      return;
    }

    loadingSpinner.style.display='block';

    const yyyy = dateObj.getFullYear();
    const mm   = (dateObj.getMonth()+1).toString().padStart(2,'0');
    const dd   = dateObj.getDate().toString().padStart(2,'0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    fetch(`/api/timeslots/day?date=${dateStr}&serviceId=${chosenService.id}`)
      .then(r=>r.json())
      .then(resp=>{
        loadingSpinner.style.display='none';
        if(resp.error){
          errorMessage.textContent = "Erreur : " + resp.error;
          errorMessage.style.display='block';
          return;
        }
        if(!Array.isArray(resp.slots)||resp.slots.length===0){
          timeslotsContainer.innerHTML='<p>Aucun créneau disponible pour cette journée.</p>';
          return;
        }
        resp.slots.forEach(slot=>{
          const btn=document.createElement('button');
          btn.classList.add('slot-btn');
          const st=new Date(slot.start);
          btn.textContent=st.toLocaleTimeString('fr-FR',{hour:'2-digit', minute:'2-digit'});
          btn.addEventListener('click',()=>{
            chosenStart=slot.start;
            chosenEnd =slot.end;
            goToStep3();
          });
          timeslotsContainer.appendChild(btn);
        });
      })
      .catch(err=>{
        loadingSpinner.style.display='none';
        console.error(err);
        errorMessage.textContent='Erreur lors du chargement des créneaux.';
        errorMessage.style.display='block';
      });
  }

  // ================== STEP 3: Confirmation ==================
  function goToStep3() {
    step1.style.display='none';
    step2.style.display='none';
    step2b.style.display='none';
    step3.style.display='block';

    chosenServiceNameSpan.textContent = chosenService.title;
    const dObj = new Date(chosenStart);
    chosenDateSpan.textContent = dObj.toLocaleDateString('fr-FR', {
      weekday:'long', day:'numeric', month:'long', year:'numeric'
    });
    chosenTimeSpan.textContent = dObj.toLocaleTimeString('fr-FR',{
      hour:'2-digit', minute:'2-digit'
    });
  }

  bookingForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const title=document.getElementById('appointment-title').value.trim();
    const phone=document.getElementById('appointment-phone').value.trim();

    fetch('/api/appointments',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ title, start: chosenStart, end:chosenEnd, phone })
    })
    .then(r=>r.json())
    .then(resp=>{
      if(resp.error){
        alert("Erreur: "+resp.error);
      } else {
        alert("Votre rendez-vous est enregistré !\nA bientôt.");
        window.location.reload();
      }
    })
    .catch(err=>{
      alert("Erreur serveur, veuillez réessayer.");
      console.error(err);
    });
  });

  /* ================== EXPO CAROUSEL ================== */
  const expoContainer=document.querySelector('.expo-container');
  if(expoContainer){
    const expoImages=expoContainer.querySelectorAll('img');
    const expoPrev=expoContainer.querySelector('.expo-prev');
    const expoNext=expoContainer.querySelector('.expo-next');
    let expoDotsContainer=expoContainer.querySelector('.expo-dots-container');
    if(!expoDotsContainer){
      expoDotsContainer=document.createElement('div');
      expoDotsContainer.classList.add('expo-dots-container');
      expoContainer.appendChild(expoDotsContainer);
    }
    let expoIndex=0;
    expoImages.forEach((img,i)=>{
      img.style.display=(i===0)? 'block':'none';
      const dot=document.createElement('span');
      dot.classList.add('expo-dot');
      if(i===0) dot.classList.add('active-expo-dot');
      dot.addEventListener('click',()=>showExpoImage(i));
      expoDotsContainer.appendChild(dot);
    });
    const expoDots=expoDotsContainer.querySelectorAll('.expo-dot');

    function showExpoImage(i){
      expoImages.forEach((img, idx)=>{
        img.style.display=(idx===i)? 'block':'none';
        expoDots[idx].classList.toggle('active-expo-dot', idx===i);
      });
      expoIndex=i;
    }
    let expoInterval=setInterval(()=>{
      expoIndex=(expoIndex+1) % expoImages.length;
      showExpoImage(expoIndex);
    },4000);
    expoPrev.addEventListener('click',()=>{
      clearInterval(expoInterval);
      expoIndex=(expoIndex-1+expoImages.length)%expoImages.length;
      showExpoImage(expoIndex);
    });
    expoNext.addEventListener('click',()=>{
      clearInterval(expoInterval);
      expoIndex=(expoIndex+1)%expoImages.length;
      showExpoImage(expoIndex);
    });
  }
});
