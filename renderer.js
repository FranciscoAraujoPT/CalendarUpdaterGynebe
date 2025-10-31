// renderer.js
document.addEventListener('DOMContentLoaded', () => {
    const specialties = [
        { id: 1, name: "Ginecologia/Obstetrícia" },
        { id: 2, name: "Pediatria" },
    ];

    const calendarTypes = [
        { key: "holidays", title: "Fechados", message: "Dias em que estamos fechados." },
        { key: "openExceptions", title: "Abertos Excecionalmente", message: "Dias em que estamos abertos apesar de ser feriado." }
    ];

    const locations = ["Porto", "SantoTirso"];
    let currentLocation = "Porto";

    const specContainer = document.getElementById('specContainer');
    const addAllBtnClose = document.getElementById('addAllBtnClose');
    const addAllBtnOpen = document.getElementById('addAllBtnOpen');
    const saveBtn = document.getElementById('saveBtn');
    const holidayMsgInput = document.getElementById('holidayMsg');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const notificationEl = document.getElementById('notification');

    let selectedDates = {
        holidays: {},
        openExceptions: { Porto: {}, SantoTirso: {} }
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let ignoreNextFlatpickrChange = false;

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
        if (window.electronAPI?.logMessage) await window.electronAPI.logMessage(message);
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
    // Remove date
    // ---------------------
    function removeDate(type, specId, date) {
        let arr = type === 'openExceptions'
            ? selectedDates.openExceptions[currentLocation][specId]
            : selectedDates.holidays[specId];
        if (!arr) return;
        arr = arr.filter(d => !d.DataInicio.startsWith(date));
        if (type === 'openExceptions') selectedDates.openExceptions[currentLocation][specId] = arr;
        else selectedDates.holidays[specId] = arr;
    }

    // ---------------------
    // Update input display
    // ---------------------
    function updateInputDisplay(type, specId) {
        const input = document.getElementById(`${type}-${specId}`);
        if (!input) return;

        const arr = type === 'openExceptions'
            ? selectedDates.openExceptions[currentLocation][specId] || []
            : selectedDates.holidays[specId] || [];

        input.value = arr.map(d => {
            const di = d.DataInicio.split('T')[0];
            const ti = d.DataInicio.split('T')[1].slice(0, 5);
            const tf = d.DataFim.split('T')[1].slice(0, 5);
            return `${di} (${ti}-${tf})`;
        }).join(', ');
    }

    // ---------------------
    // Show date popup
    // ---------------------
    function showDatePopup(type, specId, date, inputEl) {
        const oldPopup = document.querySelector('.date-popup-overlay');
        if (oldPopup) oldPopup.remove();
        if (!inputEl) return;

        const rect = inputEl.getBoundingClientRect();
        const overlay = document.createElement('div');
        overlay.className = 'date-popup-overlay';
        overlay.style.position = 'absolute';
        overlay.style.top = rect.bottom + window.scrollY + 'px';
        overlay.style.left = rect.left + window.scrollX + 'px';
        overlay.style.width = rect.width + 'px';
        overlay.style.background = 'white';
        overlay.style.padding = '15px';
        overlay.style.borderRadius = '8px';
        overlay.style.boxShadow = '0 4px 15px rgba(0,0,0,0.25)';
        overlay.style.zIndex = 2000;

        const arr = type === 'openExceptions'
            ? selectedDates.openExceptions[currentLocation][specId] || []
            : selectedDates.holidays[specId] || [];

        const existing = arr.find(d => d.DataInicio.startsWith(date)) || {
            DataInicio: `${date}T00:00:00.000Z`,
            DataFim: `${date}T23:59:00.000Z`
        };
        const allDay = existing.DataInicio.endsWith("00:00:00.000Z") && existing.DataFim.endsWith("23:59:00.000Z");

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

            const idx = arr.findIndex(d => d.DataInicio.startsWith(date));
            if (idx !== -1) arr[idx] = { DataInicio, DataFim };
            else arr.push({ DataInicio, DataFim });

            if (type === 'openExceptions') selectedDates.openExceptions[currentLocation][specId] = arr;
            else selectedDates.holidays[specId] = arr;

            updateInputDisplay(type, specId);
            overlay.remove();
        });

        function handleClickOutside(e) {
            if (!inputEl.contains(e.target) && !overlay.contains(e.target)) {
                overlay.remove();
                document.removeEventListener('click', handleClickOutside);
            }
        }
        document.addEventListener('click', handleClickOutside);
    }

    // ---------------------
    // Create specialty cards
    // ---------------------
    function createSpecialtyCards() {
        specContainer.innerHTML = '';

        const locDiv = document.createElement('div');
        locDiv.classList.add('location-selector');
        locDiv.innerHTML = `
            <label for="locationSelect">Localização:</label>
            <select id="locationSelect">
                ${locations.map(loc => `<option value="${loc}" ${loc === currentLocation ? 'selected' : ''}>${loc}</option>`).join('')}
            </select>
        `;
        specContainer.appendChild(locDiv);

        const newSelect = locDiv.querySelector('#locationSelect');
        newSelect.addEventListener('change', () => {
            currentLocation = newSelect.value;
            createSpecialtyCards();
            updateUIFromSelectedDates();
        });

        calendarTypes.forEach(type => {
            const section = document.createElement('section');
            section.classList.add('calendar-section');
            section.innerHTML = `<h2>${type.title}</h2><p>${type.message}</p>`;

            specialties.forEach(spec => {
                if (currentLocation === "SantoTirso" && spec.id === 2 && type.key === "openExceptions") return;

                const card = document.createElement('div');
                card.classList.add('spec-card');
                card.innerHTML = `<h3>${spec.name}</h3>`;
                section.appendChild(card);

                const input = document.createElement('input');
                input.id = `${type.key}-${spec.id}`;
                input.type = "text";
                input.classList.add('calendar-input');
                input.placeholder = "Selecionar datas";
                input.readOnly = true;
                card.appendChild(input);

                if (type.key === 'openExceptions') {
                    selectedDates.openExceptions[currentLocation][spec.id] = selectedDates.openExceptions[currentLocation][spec.id] || [];
                } else {
                    selectedDates.holidays[spec.id] = selectedDates.holidays[spec.id] || [];
                }

                flatpickr(input, {
                    mode: "multiple",
                    dateFormat: "Y-m-d",
                    minDate: "today",
                    onChange: function (selectedDatesArr, dateStr, instance) {
                        if (ignoreNextFlatpickrChange) return;

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

                        const oldPopup = document.querySelector('.date-popup-overlay');
                        if (oldPopup) oldPopup.remove();

                        if (stillSelected) {
                            showDatePopup(type.key, spec.id, formattedDate, instance.input);
                        } else {
                            removeDate(type.key, spec.id, formattedDate);
                            updateInputDisplay(type.key, spec.id);
                        }
                    }
                });
            });

            specContainer.appendChild(section);
        });
    }

    // ---------------------
    // Update UI from selectedDates
    // ---------------------
    function updateUIFromSelectedDates() {
        calendarTypes.forEach(type => {
            specialties.forEach(spec => {
                if (currentLocation === "SantoTirso" && spec.id === 2 && type.key === "openExceptions") return;

                const input = document.getElementById(`${type.key}-${spec.id}`);
                if (!input || !input._flatpickr) return;

                const arr = type.key === 'openExceptions'
                    ? selectedDates.openExceptions[currentLocation][spec.id] || []
                    : selectedDates.holidays[spec.id] || [];

                ignoreNextFlatpickrChange = true;
                input._flatpickr.setDate(arr.map(d => new Date(d.DataInicio)), true);
                ignoreNextFlatpickrChange = false;

                updateInputDisplay(type.key, spec.id);
            });
        });
    }

    // ---------------------
    // Add all buttons
    // ---------------------
    addAllBtnClose.addEventListener('click', () => {
        const merged = Object.values(selectedDates.holidays).flat();
        specialties.forEach(spec => {
            selectedDates.holidays[spec.id] = JSON.parse(JSON.stringify(merged));
            const input = document.getElementById(`holidays-${spec.id}`);
            if (input && input._flatpickr) {
                ignoreNextFlatpickrChange = true;
                input._flatpickr.setDate(merged.map(d => new Date(d.DataInicio)), true);
                ignoreNextFlatpickrChange = false;
            }
            updateInputDisplay('holidays', spec.id);
        });
        log('Added all holiday dates to all specialties.');
    });

    addAllBtnOpen.addEventListener('click', () => {
        const merged = Object.values(selectedDates.openExceptions[currentLocation] || {}).flat();
        specialties.forEach(spec => {
            if (currentLocation === "SantoTirso" && spec.id === 2) return;
            selectedDates.openExceptions[currentLocation][spec.id] = JSON.parse(JSON.stringify(merged));
            const input = document.getElementById(`openExceptions-${spec.id}`);
            if (input && input._flatpickr) {
                ignoreNextFlatpickrChange = true;
                input._flatpickr.setDate(merged.map(d => new Date(d.DataInicio)), true);
                ignoreNextFlatpickrChange = false;
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
        const calendarData = { holidays: selectedDates.holidays, openExceptions: selectedDates.openExceptions, holidaysMessage };
        loadingOverlay.classList.add('active');
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
    // Repo synced
    // ---------------------
    window.electronAPI.onRepoSynced(calendar => {
        loadingOverlay.classList.remove('active');
        const rawHolidays = calendar.holidays || {};
        const rawOpens = calendar.openExceptions || {};
        const filtered = { holidays: {}, openExceptions: { Porto: {}, SantoTirso: {} } };

        for (const type of ['holidays', 'openExceptions']) {
            const source = type === 'holidays' ? rawHolidays : rawOpens;
            if (type === 'holidays') {
                for (const [specId, days] of Object.entries(source)) {
                    filtered.holidays[specId] = days.filter(d => new Date(d.DataInicio) >= today);
                }
            } else {
                for (const loc of locations) {
                    filtered.openExceptions[loc] = filtered.openExceptions[loc] || {};
                    for (const [specId, days] of Object.entries(source[loc] || {})) {
                        filtered.openExceptions[loc][specId] = days.filter(d => new Date(d.DataInicio) >= today);
                    }
                }
            }
        }

        selectedDates = filtered;
        holidayMsgInput.value = calendar.holidaysMessage || '';
        updateUIFromSelectedDates();
        log('Repository synced.');
    });

    // ---------------------
    // Init
    // ---------------------
    async function init() {
        loadingOverlay.classList.add('active');
        createSpecialtyCards();
        await window.electronAPI.readyToReceive();
    }

    init();
});
