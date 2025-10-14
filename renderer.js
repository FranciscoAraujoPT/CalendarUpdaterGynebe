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

    // ---------------------
    // Auto-grow as user types
    // ---------------------

    holidayMsgInput.addEventListener('input', () => {
        holidayMsgInput.style.height = 'auto'; // reset height
        holidayMsgInput.style.height = holidayMsgInput.scrollHeight + 'px'; // grow to fit content
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
        specContainer.innerHTML = ''; // clear container

        specialties.forEach(spec => {
            const card = document.createElement('div');
            card.classList.add('spec-card');
            card.innerHTML = `
                <h3>${spec.name}</h3>
                <input type="text" class="calendar-input" id="calendar-${spec.id}" placeholder="Select dates" readonly>
            `;
            specContainer.appendChild(card);

            flatpickr(`#calendar-${spec.id}`, {
                mode: "multiple",
                dateFormat: "Y-m-d",
                onChange: (datesArr, dateStr, instance) => {
                    // Convert all to YYYY-MM-DD format
                    let formatted = datesArr.map(d => d.toISOString().split('T')[0]);

                    // Remove duplicates explicitly
                    formatted = [...new Set(formatted)];

                    // Save unique dates
                    selectedDates[spec.id] = formatted;

                    // Update field text
                    const input = document.getElementById(`calendar-${spec.id}`);
                    input.value = formatted.join(', ');

                    // Auto-grow height for long lists
                    input.style.height = 'auto';
                    input.style.height = input.scrollHeight + 'px';

                    // If Flatpickr somehow shows duplicates, reapply unique list
                    instance.setDate(formatted, false);

                    log(`Selected dates for ${spec.name}: ${formatted.join(', ')}`);
                }
            });
        });

        log('Specialty cards created.');
    }

    // ---------------------
    // Add all dates to all specialties
    // ---------------------
    addAllBtn.addEventListener('click', () => {
        const allDates = Object.values(selectedDates).flat();
        specialties.forEach(spec => {
            const input = document.getElementById(`calendar-${spec.id}`);
            if (input._flatpickr) {
                input._flatpickr.setDate(allDates);
                selectedDates[spec.id] = allDates;
            }
        });
        log('Added all selected dates to all specialties.');
    });

    // ---------------------
    // Save calendar to repo
    // ---------------------
    saveBtn.addEventListener('click', async () => {
        const holidaysMessage = holidayMsgInput.value || "Estamos de férias!";
        const calendarData = { holidays: selectedDates, holidaysMessage };
        loadingOverlay.classList.add('active');
        log('Saving calendar...');

        try {
            const result = await window.electronAPI.saveCalendar(calendarData, 'Update calendar');
            loadingOverlay.classList.remove('active');
            if (result.success) showNotification('Calendar saved and pushed successfully!');
            else showNotification('Error saving calendar: ' + result.error, true);
        } catch (err) {
            loadingOverlay.classList.remove('active');
            showNotification('Error saving calendar: ' + err.message, true);
            log('Error saving calendar: ' + err.message);
        }
    });

    // ---------------------
    // Initialize after repo is ready
    // ---------------------
    async function init() {
        // Show loading overlay until repo is ready
        loadingOverlay.classList.add('active');

        // Listen for loading messages from main
        window.electronAPI.onRepoLoading((msg) => {
            loadingOverlay.classList.add('active');
            log('Repo loading: ' + msg);
        });

        // When repo finishes syncing, hide the loading overlay
        window.electronAPI.onRepoSynced((calendar) => {
            loadingOverlay.classList.remove('active');
            // (rest of your code continues as before)
        });

        createSpecialtyCards();

        // Listen for repo sync
        window.electronAPI.onRepoSynced((calendar) => {
            log('Repo synced event received.');
            selectedDates = calendar.holidays || {};
            holidayMsgInput.value = calendar.holidaysMessage || '';

            specialties.forEach(spec => {
                const input = document.getElementById(`calendar-${spec.id}`);
                if (input && input._flatpickr) {
                    const dates = selectedDates[spec.id] || [];
                    input._flatpickr.setDate(dates);
                    log(`Dates loaded for ${spec.name}: ${dates.join(', ')}`);
                }
            });

            log('Repository synced. Calendar loaded.');
        });

        // Listen for repo sync errors
        window.electronAPI.onRepoSyncError((msg) => {
            showNotification('Error syncing repo: ' + msg, true);
            log('Error syncing repository: ' + msg);
        });

        // Ask main process to clone/pull and send calendar
        await window.electronAPI.readyToReceive();
    }

    init();
});
