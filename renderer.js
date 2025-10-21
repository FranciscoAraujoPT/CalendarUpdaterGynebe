// renderer.js
document.addEventListener('DOMContentLoaded', () => {
    const specialties = [
        { id: 1, name: "Ginecologia/Obstetrícia" },
        { id: 2, name: "Pediatria" },
    ];

    const specContainer = document.getElementById('specContainer');
    const addAllBtn = document.getElementById('addAllBtn');
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
        specContainer.innerHTML = '';

        specialties.forEach(spec => {
            const card = document.createElement('div');
            card.classList.add('spec-card');
            card.innerHTML = `
                <h3>${spec.name}</h3>
                <input type="text" class="calendar-input" id="calendar-${spec.id}" placeholder="Select dates" readonly>
            `;
            specContainer.appendChild(card);
            selectedDates[spec.id] = selectedDates[spec.id] || [];

            flatpickr(`#calendar-${spec.id}`, {
                mode: "multiple",
                dateFormat: "Y-m-d",
                minDate: "today",
                clickOpens: true, // default, opens when input clicked
                onClose: function (selectedDates, dateStr, instance) {
                    // Prevent closing if the date popup is still open
                    const popup = document.querySelector('.date-popup-overlay');
                    if (popup) {
                        instance.open(); // reopen the calendar if popup exists
                    }
                },
                onChange: function (selectedDatesArr, dateStr, instance) {
                    const lastSelected = instance.latestSelectedDateObj;
                    if (!lastSelected) return;

                    // Use local date to avoid UTC shifts
                    const year = lastSelected.getFullYear();
                    const month = (lastSelected.getMonth() + 1).toString().padStart(2, '0');
                    const day = lastSelected.getDate().toString().padStart(2, '0');
                    const formattedDate = `${year}-${month}-${day}`;

                    const stillSelected = selectedDatesArr.some(d => {
                        return d.getFullYear() === lastSelected.getFullYear() &&
                            d.getMonth() === lastSelected.getMonth() &&
                            d.getDate() === lastSelected.getDate();
                    });

                    if (stillSelected) {
                        showDatePopup(spec.id, formattedDate, instance.calendarContainer);
                    } else {
                        removeDate(spec.id, formattedDate);
                        const existingPopup = document.querySelector('.date-popup-overlay');
                        if (existingPopup) existingPopup.remove();
                        updateInputDisplay(spec.id);
                    }
                }
            });

        });

        log('Specialty cards created.');
    }

    // ---------------------
    // Remove date from selectedDates
    // ---------------------
    function removeDate(specId, date) {
        if (!selectedDates[specId]) return;
        selectedDates[specId] = selectedDates[specId].filter(d => !d.DataInicio.startsWith(date));
    }

    // ---------------------
    // Update text input display
    // ---------------------
    function updateInputDisplay(specId) {
        const input = document.getElementById(`calendar-${specId}`);
        if (!input) return;
        input.value = (selectedDates[specId] || []).map(d => {
            const di = d.DataInicio.split('T')[0];
            const ti = d.DataInicio.split('T')[1].slice(0, 5);
            const tf = d.DataFim.split('T')[1].slice(0, 5);
            return `${di} (${ti}-${tf})`;
        }).join(', ');
    }

    // ---------------------
    // Date popup overlay
    // ---------------------
    function showDatePopup(specId, date, calendarContainer) {
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

        const existing = selectedDates[specId].find(d => d.DataInicio.startsWith(date)) || {
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

            const idx = selectedDates[specId].findIndex(d => d.DataInicio.startsWith(date));
            if (idx !== -1) selectedDates[specId][idx] = { DataInicio, DataFim };
            else selectedDates[specId].push({ DataInicio, DataFim });

            updateInputDisplay(specId);

            overlay.remove();
        });

        // Close popup only if click outside BOTH calendar and popup
        document.addEventListener('click', function handleClickOutside(e) {
            const calendar = calendarContainer;
            if (!calendar.contains(e.target) && !overlay.contains(e.target)) {
                overlay.remove();
                document.removeEventListener('click', handleClickOutside);
            }
        });
    }

    // ---------------------
    // Add all dates to all specialties
    // ---------------------
    addAllBtn.addEventListener('click', () => {
        const allDates = Object.values(selectedDates).flat();
        specialties.forEach(spec => {
            selectedDates[spec.id] = JSON.parse(JSON.stringify(allDates));
            updateInputDisplay(spec.id);
        });
        log('Added all selected dates to all specialties.');
    });

    // ---------------------
    // Save
    // ---------------------
    saveBtn.addEventListener('click', async () => {
        const holidaysMessage = holidayMsgInput.value || "Encontramo-nos em férias!";
        const calendarData = { holidays: selectedDates, holidaysMessage };
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
            const filtered = {};

            for (const [specId, days] of Object.entries(rawHolidays)) {
                filtered[specId] = days.filter(d => {
                    const date = new Date(d.DataInicio);
                    date.setHours(0, 0, 0, 0);
                    return date >= today;
                });
            }

            selectedDates = filtered;
            holidayMsgInput.value = calendar.holidaysMessage || '';

            specialties.forEach(spec => {
                const input = document.getElementById(`calendar-${spec.id}`);
                if (input && input._flatpickr) {
                    const dates = (selectedDates[spec.id] || []).map(d => new Date(d.DataInicio));
                    input._flatpickr.setDate(dates);
                    updateInputDisplay(spec.id);
                }
            });

            log('Repository synced and filtered calendar loaded.');
        });

        window.electronAPI.onRepoSyncError(msg => {
            showNotification('Error syncing repo: ' + msg, true);
            log('Repo sync error: ' + msg);
        });

        await window.electronAPI.readyToReceive();
    }

    init();
});
