document.addEventListener('DOMContentLoaded', () => {
  const tabBtns = document.querySelectorAll('.admin-tab-btn');
  const tabContents = document.querySelectorAll('.admin-tab-content');

  // Show the "Calendrier" tab by default
  document.getElementById('cal-tab').style.display = 'block';

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabContents.forEach(tc => tc.style.display = 'none');
      const target = btn.getAttribute('data-tab');
      document.getElementById(target).style.display = 'block';
    });
  });

  /* =============== CAL TAB =============== */
  const adminCalTitle      = document.getElementById('admin-cal-title');
  const adminMonthCalendar = document.getElementById('admin-month-calendar');
  const calAdminPrev       = document.querySelector('.cal-admin-prev');
  const calAdminNext       = document.querySelector('.cal-admin-next');
  const adminChosenDaySpan = document.getElementById('admin-chosen-day');
  const adminDayTable      = document.getElementById('admin-day-appointments-table').querySelector('tbody');
  const adminAddRdvBtn     = document.getElementById('admin-add-rdv-btn');
  const adminAddPopup      = document.getElementById('admin-add-rdv-popup');
  const adminAddForm       = document.getElementById('admin-add-rdv-form');
  const adminCancelAdd     = document.getElementById('admin-cancel-add');

  let calAdminMonthOffset = 0;
  let selectedAdminDayStr = null;

  function loadAdminCalendar() {
    adminMonthCalendar.innerHTML = '';

    const now = new Date();
    let displayYear  = now.getFullYear();
    let displayMonth = now.getMonth();
    let totalMonth = displayMonth + calAdminMonthOffset;

    while(totalMonth<0)  { totalMonth+=12; displayYear--; }
    while(totalMonth>11) { totalMonth-=12; displayYear++; }

    calAdminNext.disabled = (calAdminMonthOffset>=2);
    calAdminPrev.disabled = (calAdminMonthOffset<=0);

    const firstDayDate = new Date(displayYear, totalMonth, 1);
    let monthName = firstDayDate.toLocaleString('fr-FR',{month:'long',year:'numeric'});
    monthName = monthName.charAt(0).toUpperCase()+monthName.slice(1);
    adminCalTitle.textContent = monthName;

    const lastDay = new Date(displayYear, totalMonth+1,0).getDate();

    // headings
    const daysOfWeek = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
    const headingRow = document.createElement('div');
    headingRow.classList.add('month-cal-row');
    daysOfWeek.forEach(d=>{
      const cell = document.createElement('div');
      cell.classList.add('month-cal-cell','month-cal-header');
      cell.textContent = d;
      headingRow.appendChild(cell);
    });
    adminMonthCalendar.appendChild(headingRow);

    let offsetStart = new Date(displayYear, totalMonth, 1).getDay();
    if(offsetStart===0) offsetStart=7;
    const row1 = document.createElement('div');
    row1.classList.add('month-cal-row');

    for(let i=1; i<offsetStart; i++){
      const cell = document.createElement('div');
      cell.classList.add('month-cal-cell','month-cal-empty');
      row1.appendChild(cell);
    }
    let colCount = offsetStart-1;
    let currentRow = row1;

    // Create day list
    const dayList=[];
    for(let d=1; d<=lastDay; d++){
      const dd = d.toString().padStart(2,'0');
      const mm = (totalMonth+1).toString().padStart(2,'0');
      const yyyy=displayYear;
      dayList.push(`${yyyy}-${mm}-${dd}`);
    }

    // fetch dayCounts
    fetch('/api/admin/month-appointments',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ days: dayList })
    })
    .then(r=>r.json())
    .then(resp=>{
      const dayCounts = resp.dayCounts || {};

      for(let d=1; d<=lastDay; d++){
        if(colCount>=7){
          adminMonthCalendar.appendChild(currentRow);
          currentRow=document.createElement('div');
          currentRow.classList.add('month-cal-row');
          colCount=0;
        }
        const cell = document.createElement('div');
        cell.classList.add('month-cal-cell','month-cal-day','admin-cal-day');
        cell.style.height='70px'; // bigger cell

        // day number
        const dayNumber = document.createElement('div');
        dayNumber.textContent=d;
        cell.appendChild(dayNumber);

        // show dayCounts in new line if any
        const dd = d.toString().padStart(2,'0');
        const mm = (totalMonth+1).toString().padStart(2,'0');
        const yyyy=displayYear;
        const dayStr = `${yyyy}-${mm}-${dd}`;
        const count = dayCounts[dayStr]||0;
        if(count>0){
          const rdvLabel = document.createElement('div');
          rdvLabel.style.fontSize='14px';
          rdvLabel.style.marginTop='5px';
          rdvLabel.textContent = `${count} RDV`;
          cell.appendChild(rdvLabel);
        }

        // on click
        cell.addEventListener('click',()=>{
          selectedAdminDayStr=dayStr;
          adminChosenDaySpan.textContent=new Date(dayStr+"T00:00:00")
            .toLocaleDateString('fr-FR',{ weekday:'long', day:'numeric', month:'long', year:'numeric'});
          loadAdminDayAppointments(dayStr);
        });
        currentRow.appendChild(cell);
        colCount++;
      }

      if(colCount>0){
        while(colCount<7){
          const cell=document.createElement('div');
          cell.classList.add('month-cal-cell','month-cal-empty');
          currentRow.appendChild(cell);
          colCount++;
        }
        adminMonthCalendar.appendChild(currentRow);
      } else {
        adminMonthCalendar.appendChild(currentRow);
      }
    })
    .catch(err=>console.error(err));
  }

  calAdminPrev.addEventListener('click',()=>{
    if(calAdminMonthOffset>0){
      calAdminMonthOffset--;
      loadAdminCalendar();
    }
  });
  calAdminNext.addEventListener('click',()=>{
    if(calAdminMonthOffset<2){
      calAdminMonthOffset++;
      loadAdminCalendar();
    }
  });

  function loadAdminDayAppointments(dayStr){
    fetch(`/api/admin/day-appointments?day=${dayStr}`)
      .then(r=>r.json())
      .then(resp=>{
        const tBody=adminDayTable;
        tBody.innerHTML='';
        if(!resp||!Array.isArray(resp)||resp.length===0){
          tBody.innerHTML='<tr><td colspan="6">Aucun rendez-vous pour ce jour</td></tr>';
          return;
        }
        resp.forEach(rdv=>{
          const tr=document.createElement('tr');
          tr.innerHTML=`
            <td>${rdv.id}</td>
            <td>${rdv.title}</td>
            <td>${rdv.start}</td>
            <td>${rdv.end}</td>
            <td>${rdv.phone||''}</td>
            <td>
              <button class="delete-rdv-btn" data-id="${rdv.id}">Supprimer</button>
            </td>
          `;
          tBody.appendChild(tr);
        });
        document.querySelectorAll('.delete-rdv-btn').forEach(btn=>{
          btn.addEventListener('click',()=>{
            const id=btn.getAttribute('data-id');
            if(!confirm("Supprimer ce RDV ?")) return;
            fetch(`/api/admin/appointments/${id}`,{
              method:'DELETE'
            })
            .then(r=>r.json())
            .then(r2=>{
              if(r2.error) alert(r2.error);
              else loadAdminDayAppointments(dayStr);
            })
            .catch(err=>console.error(err));
          });
        });
      })
      .catch(err=>console.error(err));
  }

  // Add RDV from admin
  adminAddRdvBtn.addEventListener('click',()=>{
    if(!selectedAdminDayStr){
      alert("Sélectionnez d'abord un jour sur le calendrier.");
      return;
    }
    adminAddPopup.style.display='flex';
  });
  adminCancelAdd.addEventListener('click',()=>{
    adminAddPopup.style.display='none';
  });
  adminAddForm.addEventListener('submit',(e)=>{
    e.preventDefault();
    const formData=new FormData(e.target);
    fetch('/api/appointments',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        title: formData.get('title'),
        start: formData.get('start'),
        end:   formData.get('end'),
        phone: formData.get('phone')
      })
    })
    .then(r=>r.json())
    .then(resp=>{
      if(resp.error){
        alert("Erreur: "+resp.error);
      } else {
        alert("RDV créé avec succès !");
        adminAddPopup.style.display='none';
        if(selectedAdminDayStr){
          loadAdminDayAppointments(selectedAdminDayStr);
        }
        loadAdminCalendar();
      }
    })
    .catch(err=>console.error(err));
  });

  // ============ BLOCKS / VACATIONS =============
  function loadBlocks(){
    fetch('/api/admin/blocks')
      .then(r=>r.json())
      .then(rows=>{
        const tbody=document.querySelector('#blocks-table tbody');
        tbody.innerHTML='';
        rows.forEach(b=>{
          const tr=document.createElement('tr');
          tr.innerHTML=`
            <td>${b.id}</td>
            <td>${b.start}</td>
            <td>${b.end}</td>
            <td>${b.type}</td>
            <td>${b.reason||''}</td>
            <td>
              <button class="delete-block-btn" data-id="${b.id}">Supprimer</button>
            </td>
          `;
          tbody.appendChild(tr);
        });
        document.querySelectorAll('.delete-block-btn').forEach(btn=>{
          btn.addEventListener('click',()=>{
            const id=btn.getAttribute('data-id');
            if(!confirm("Supprimer ce blocage ?")) return;
            fetch(`/api/admin/blocks/${id}`,{
              method:'DELETE'
            })
            .then(r=>r.json())
            .then(resp=>{
              if(resp.error) alert(resp.error);
              else loadBlocks();
            })
            .catch(err=>console.error(err));
          });
        });
      })
      .catch(err=>console.error(err));
  }
  document.getElementById('block-form').addEventListener('submit',(e)=>{
    e.preventDefault();
    const formData=new FormData(e.target);
    fetch('/api/admin/block',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        start: formData.get('start'),
        end:   formData.get('end'),
        reason: formData.get('reason')||''
      })
    })
    .then(r=>r.json())
    .then(resp=>{
      if(resp.error) alert(resp.error);
      else {
        alert("Blocage ajouté");
        loadBlocks();
      }
    })
    .catch(err=>console.error(err));
  });
  document.getElementById('vacation-form').addEventListener('submit',(e)=>{
    e.preventDefault();
    const formData=new FormData(e.target);
    fetch('/api/admin/vacation',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        start: formData.get('start'),
        end:   formData.get('end'),
        reason: formData.get('reason')||'Vacances'
      })
    })
    .then(r=>r.json())
    .then(resp=>{
      if(resp.error) alert(resp.error);
      else {
        alert("Vacances ajoutées");
        loadBlocks();
      }
    })
    .catch(err=>console.error(err));
  });

  // ============ HOURS =============
  function loadHours(){
    fetch('/api/admin/hours')
      .then(r=>r.json())
      .then(rows=>{
        const tbody=document.querySelector('#hours-table tbody');
        tbody.innerHTML='';
        const jours=["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
        for(let d=1; d<=7; d++){
          const row = rows.find(rh=> +rh.day_of_week===d) || {};
          const tr=document.createElement('tr');
          tr.innerHTML=`
            <td>${jours[d%7]}</td>
            <td><input type="time" class="hour-start" value="${row.start||''}"/></td>
            <td><input type="time" class="hour-end" value="${row.end||''}"/></td>
            <td><button class="save-hour-btn" data-dow="${d}">Enregistrer</button></td>
          `;
          tbody.appendChild(tr);
        }
        document.querySelectorAll('.save-hour-btn').forEach(btn=>{
          btn.addEventListener('click',()=>{
            const dow=btn.getAttribute('data-dow');
            const tr=btn.parentElement.parentElement;
            const start=tr.querySelector('.hour-start').value;
            const end=tr.querySelector('.hour-end').value;
            fetch('/api/admin/hours',{
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ day_of_week:dow, start, end })
            })
            .then(r=>r.json())
            .then(resp=>{
              if(resp.error) alert(resp.error);
              else alert("Horaire sauvegardé");
            })
            .catch(err=>console.error(err));
          });
        });
      })
      .catch(err=>console.error(err));
  }

  // init
  loadAdminCalendar();
  loadBlocks();
  loadHours();
});
