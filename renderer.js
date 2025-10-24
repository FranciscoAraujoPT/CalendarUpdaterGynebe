// renderer.js
document.addEventListener('DOMContentLoaded', () => {
    const specialties = [
        { id: 1, name: "Ginecologia/Obstetrícia" },
        { id: 2, name: "Pediatria" },
    ];
    const calendarTypes = [
        { key: "holidays", title: "Fechados", message: "Dias em que estamos fechados" },
        { key: "openExceptions", title: "Abertos Excecionalmente", message: "Dias em que estamos abertos apesar de ser feriado" }
    ];

    const specContainer = document.getElementById('specContainer');
    const addAllBtnClose = document.getElementById('addAllBtnClose');
    const addAllBtnOpen = document.getElementById('addAllBtnOpen')
    const saveBtn = document.getElementById('saveBtn');
    const holidayMsgInput = document.getElementById('holidayMsg');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const notificationEl = document.getElementById('notification');

    let selectedDates = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ---------------------
    // Auto-grow textarea
    // ---------------------
    holidayMsgInput.addEventListener('input', () => {
        holidayMsgInput.style.height = 'auto';
        holidayMsgInput.style.height = holidayMsgInput.scrollHeight + 'px';
    });

    // ---------------------
    // Logging helper
    // ---------------------
    async function log(message) {
        console.log(message);
        if (window.electronAPI?.logMessage) {
            await window.electronAPI.logMessage(message);
        }
    }

    // ---------------------
    // Notification helper
    // ---------------------
    function showNotification(message, isError = false) {
        notificationEl.textContent = message;
        notificationEl.className = 'notification' + (isError ? ' error' : '');
        notificationEl.style.display = 'block';
        setTimeout(() => { notificationEl.style.display = 'none'; }, 3000);
        log(`Notification: ${message}`);
    }

    // ---------------------
    // Create specialty cards
    // ---------------------
    function createSpecialtyCards() {
        const container = document.getElementById('specContainer');
        container.innerHTML = '';

        calendarTypes.forEach(type => {
            const section = document.createElement('section');
            section.classList.add('calendar-section');
            section.innerHTML = `<h2>${type.title}</h2><p>${type.message}</p>`;

            specialties.forEach(spec => {
                const card = document.createElement('div');
                card.classList.add('spec-card');
                card.innerHTML = `
                    <h3>${spec.name}</h3>
                    
                `;
                section.appendChild(card);

                const input = document.createElement('input');
                input.id = `${type.key}-${spec.id}`;
                input.type = "text";
                input.classList.add('calendar-input');
                input.placeholder = "Selecionar datas";
                input.readOnly = true;

                card.appendChild(input);

                // ensure structure exists
                selectedDates[type.key] = selectedDates[type.key] || {};
                selectedDates[type.key][spec.id] = selectedDates[type.key][spec.id] || [];

                flatpickr(input, {
                    mode: "multiple",
                    dateFormat: "Y-m-d",
                    minDate: "today",
                    onClose: function (selectedDates, dateStr, instance) {
                        const popup = document.querySelector('.date-popup-overlay');
                        if (popup) { instance.open(); }
                    },
                    onChange: function (selectedDatesArr, dateStr, instance) {
                        const lastSelected = instance.latestSelectedDateObj;
                        if (!lastSelected) return;

                        const year = lastSelected.getFullYear();
                        const month = (lastSelected.getMonth() + 1).toString().padStart(2, '0');
                        const day = lastSelected.getDate().toString().padStart(2, '0');
                        const formattedDate = `${year}-${month}-${day}`;

                        const stillSelected = selectedDatesArr.some(d =>
                            d.getFullYear() === lastSelected.getFullYear() &&
                            d.getMonth() === lastSelected.getMonth() &&
                            d.getDate() === lastSelected.getDate()
                        );

                        if (stillSelected) {
                            showDatePopup(type.key, spec.id, formattedDate, instance.calendarContainer);
                        } else {
                            removeDate(type.key, spec.id, formattedDate);
                            updateInputDisplay(type.key, spec.id);
                            const oldPopup = document.querySelector('.date-popup-overlay');
                            if (oldPopup) oldPopup.remove();
                        }
                    }
                });
            });

            container.appendChild(section);
        });
    }

    // ---------------------
    // Remove date from selectedDates
    // ---------------------
    function removeDate(type, specId, date) {
        if (!selectedDates[type]?.[specId]) return;
        selectedDates[type][specId] = selectedDates[type][specId].filter(d => !d.DataInicio.startsWith(date));
    }

    // ---------------------
    // Update text input display
    // ---------------------
    function updateInputDisplay(type, specId) {
        const input = document.getElementById(`${type}-${specId}`);
        if (!input) return;
        input.value = (selectedDates[type][specId] || []).map(d => {
            const di = d.DataInicio.split('T')[0];
            const ti = d.DataInicio.split('T')[1].slice(0, 5);
            const tf = d.DataFim.split('T')[1].slice(0, 5);
            return `${di} (${ti}-${tf})`;
        }).join(', ');
    }

    // ---------------------
    // Date popup overlay
    // ---------------------
    function showDatePopup(type, specId, date, calendarContainer) {
        const oldPopup = document.querySelector('.date-popup-overlay');
        if (oldPopup) oldPopup.remove();

        const overlay = document.createElement('div');
        overlay.className = 'date-popup-overlay';
        overlay.style.position = 'absolute';
        overlay.style.background = 'white';
        overlay.style.padding = '15px';
        overlay.style.borderRadius = '8px';
        overlay.style.boxShadow = '0 4px 15px rgba(0,0,0,0.25)';
        overlay.style.zIndex = 2000;

        const rect = calendarContainer.getBoundingClientRect();
        overlay.style.top = rect.bottom + window.scrollY + 'px';
        overlay.style.left = rect.left + window.scrollX + 'px';
        overlay.style.width = rect.width + 'px';

        const existing = selectedDates[type][specId].find(d => d.DataInicio.startsWith(date)) || {
            DataInicio: `${date}T00:00:00.000Z`,
            DataFim: `${date}T23:59:00.000Z`
        };
        let allDay = existing.DataInicio.endsWith("00:00:00.000Z") && existing.DataFim.endsWith("23:59:00.000Z");

        overlay.innerHTML = `
        <div style="margin-bottom:10px;"><strong>${date}</strong></div>
        <label><input type="checkbox" id="popupAllDay" ${allDay ? 'checked' : ''}> All day</label>
        <div style="margin-top:10px;">
            Start: <input type="time" id="popupStart" value="${existing.DataInicio.split('T')[1].slice(0, 5)}" ${allDay ? 'disabled' : ''}>
            End: <input type="time" id="popupEnd" value="${existing.DataFim.split('T')[1].slice(0, 5)}" ${allDay ? 'disabled' : ''}>
        </div>
        <button id="popupSave" style="margin-top:10px;">Save</button>
    `;
        document.body.appendChild(overlay);

        const chkAllDay = document.getElementById('popupAllDay');
        const startInput = document.getElementById('popupStart');
        const endInput = document.getElementById('popupEnd');
        const saveBtn = document.getElementById('popupSave');

        chkAllDay.addEventListener('change', () => {
            const disabled = chkAllDay.checked;
            startInput.disabled = disabled;
            endInput.disabled = disabled;
        });

        saveBtn.addEventListener('click', () => {
            const start = chkAllDay.checked ? "00:00" : startInput.value || "09:00";
            const end = chkAllDay.checked ? "23:59" : endInput.value || "17:00";
            const DataInicio = `${date}T${start}:00.000Z`;
            const DataFim = `${date}T${end}:00.000Z`;

            const idx = selectedDates[type][specId].findIndex(d => d.DataInicio.startsWith(date));
            if (idx !== -1) selectedDates[type][specId][idx] = { DataInicio, DataFim };
            else selectedDates[type][specId].push({ DataInicio, DataFim });

            updateInputDisplay(type, specId);
            overlay.remove();
        });

        // Close popup if click outside
        document.addEventListener('click', function handleClickOutside(e) {
            const calendar = calendarContainer;
            if (!calendar.contains(e.target) && !overlay.contains(e.target)) {
                // Apply default all-day if date exists but popup dismissed
                if (!selectedDates[type][specId].some(d => d.DataInicio.startsWith(date))) {
                    const DataInicio = `${date}T00:00:00.000Z`;
                    const DataFim = `${date}T23:59:00.000Z`;
                    selectedDates[type][specId].push({ DataInicio, DataFim });
                    updateInputDisplay(type, specId);
                }
                overlay.remove();
                document.removeEventListener('click', handleClickOutside);
            }
        });
    }

    // ---------------------
    // Add all blocked (holiday) dates to all specialties
    // ---------------------
    addAllBtnClose.addEventListener('click', () => {
        const allHolidays = selectedDates.holidays || {};
        const merged = Object.values(allHolidays).flat();

        specialties.forEach(spec => {
            selectedDates.holidays[spec.id] = JSON.parse(JSON.stringify(merged));

            // Update flatpickr
            const input = document.getElementById(`holidays-${spec.id}`);
            if (input && input._flatpickr) {
                const dateObjs = selectedDates.holidays[spec.id].map(d => new Date(d.DataInicio));
                input._flatpickr.setDate(dateObjs, true);
            }

            updateInputDisplay('holidays', spec.id);
        });

        log('Added all holiday dates to all specialties.');
    });


    // ---------------------
    // Add all open-exception dates to all specialties
    // ---------------------
    addAllBtnOpen.addEventListener('click', () => {
        const allOpen = selectedDates.openExceptions || {};
        const merged = Object.values(allOpen).flat();

        specialties.forEach(spec => {
            selectedDates.openExceptions[spec.id] = JSON.parse(JSON.stringify(merged));

            // Update flatpickr
            const input = document.getElementById(`openExceptions-${spec.id}`);
            if (input && input._flatpickr) {
                const dateObjs = selectedDates.openExceptions[spec.id].map(d => new Date(d.DataInicio));
                input._flatpickr.setDate(dateObjs, true);
            }

            updateInputDisplay('openExceptions', spec.id);
        });

        log('Added all open-exception dates to all specialties.');
    });

    // ---------------------
    // Save
    // ---------------------
    saveBtn.addEventListener('click', async () => {
        const holidaysMessage = holidayMsgInput.value || "Encontramo-nos em férias!";
        const calendarData = {
            holidays: selectedDates.holidays || {},
            openExceptions: selectedDates.openExceptions || {},
            holidaysMessage
        };
        loadingOverlay.classList.add('active');
        log('Saving calendar...');

        try {
            const result = await window.electronAPI.saveCalendar(calendarData, 'Update calendar');
            loadingOverlay.classList.remove('active');
            if (result.success) showNotification('Calendar saved successfully!');
            else showNotification('Error saving: ' + result.error, true);
        } catch (err) {
            loadingOverlay.classList.remove('active');
            showNotification('Error saving: ' + err.message, true);
            log('Error saving: ' + err.message);
        }
    });

    // ---------------------
    // Init
    // ---------------------
    async function init() {
        loadingOverlay.classList.add('active');
        window.electronAPI.onRepoLoading(msg => {
            loadingOverlay.classList.add('active');
            log('Repo loading: ' + msg);
        });

        createSpecialtyCards();

        window.electronAPI.onRepoSynced(calendar => {
            loadingOverlay.classList.remove('active');

            const rawHolidays = calendar.holidays || {};
            const rawOpens = calendar.openExceptions || {};
            const filtered = { holidays: {}, openExceptions: {} };

            for (const type of ['holidays', 'openExceptions']) {
                const source = type === 'holidays' ? rawHolidays : rawOpens;
                for (const [specId, days] of Object.entries(source)) {
                    filtered[type][specId] = days.filter(d => {
                        const date = new Date(d.DataInicio);
                        date.setHours(0, 0, 0, 0);
                        return date >= today;
                    });
                }
            }

            selectedDates = filtered;
            holidayMsgInput.value = calendar.holidaysMessage || '';

            calendarTypes.forEach(type => {
                specialties.forEach(spec => {
                    const input = document.getElementById(`${type.key}-${spec.id}`);
                    if (input && input._flatpickr) {
                        const dates = (selectedDates[type.key][spec.id] || []).map(d => new Date(d.DataInicio));
                        input._flatpickr.setDate(dates);
                        updateInputDisplay(type.key, spec.id);
                    }
                });
            });

            log('Repository synced and both holiday & open exception calendars loaded.');
        });

        window.electronAPI.onRepoSyncError(msg => {
            showNotification('Error syncing repo: ' + msg, true);
            log('Repo sync error: ' + msg);
        });

        await window.electronAPI.readyToReceive();
    }

    init();
});
