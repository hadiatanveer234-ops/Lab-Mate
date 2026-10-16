
/* ==========================================
   LAB MATE — COMPLETE SCRIPT.JS
   Tasks, Subjects, Notes, Progress, Theme,
   My Account, Navigation and Logout
========================================== */

/* ---------- GLOBAL DATA ---------- */
let tasks = [];
let subjects = [];
let notes = [];

/* ---------- HELPERS ---------- */
const $ = (id) => document.getElementById(id);

async function apiRequest(url, options = {}) {
    const response = await fetch(url, options);

    if (response.status === 401) {
        window.location.replace("/login");
        throw new Error("Please log in again.");
    }

    if (!response.ok) {
        let message = "Request failed.";
        try {
            const data = await response.json();
            message = data.message || data.error || message;
        } catch (_) {}
        throw new Error(message);
    }

    if (response.status === 204) return null;

    const contentType = response.headers.get("content-type") || "";
    return contentType.includes("application/json")
        ? await response.json()
        : null;
}

function escapeHTML(value) {
    const element = document.createElement("div");
    element.textContent = value ?? "";
    return element.innerHTML;
}

function formatDate(value) {
    if (!value) return "No deadline";

    const date = new Date(value + "T00:00:00");

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

function showError(message, error) {
    console.error(message, error);
    alert(message);
}

/* ---------- NAVIGATION ---------- */
const navButtons = document.querySelectorAll(".nav-btn");
const sections = document.querySelectorAll(".page-section");
const pageTitle = $("pageTitle");

function showSection(sectionName) {
    sections.forEach(section => {
        section.classList.toggle(
            "active-section",
            section.id === sectionName
        );
    });

    navButtons.forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.section === sectionName
        );
    });

    const titles = {
        dashboard: "Dashboard",
        tasks: "Lab Tasks",
        subjects: "My Subjects",
        notes: "Lab Notes",
        progress: "My Progress",
        account: "My Account"
    };

    if (pageTitle) {
        pageTitle.textContent = titles[sectionName] || "Lab Mate";
    }

    if (sectionName === "tasks") loadTasks();
    if (sectionName === "subjects") loadSubjects();
    if (sectionName === "notes") loadNotes();
    if (sectionName === "account") loadMyAccount();
    if (["dashboard", "progress"].includes(sectionName)) {
        updateStatistics();
        renderTasks();
    }
}

navButtons.forEach(button => {
    button.addEventListener("click", () => {
        if (button.dataset.section) {
            showSection(button.dataset.section);
        }
    });
});

document.querySelectorAll("[data-section-link]").forEach(button => {
    button.addEventListener("click", () => {
        showSection(button.dataset.sectionLink);
    });
});

/* ---------- DATE ---------- */
if ($("currentDate")) {
    $("currentDate").textContent = new Date().toLocaleDateString(
        "en-US",
        {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric"
        }
    );
}

/* ---------- TASK MODAL ---------- */
const modal = $("taskModal");

function openModal() {
    if (modal) modal.classList.add("show");
}

function closeTaskModal() {
    if (modal) modal.classList.remove("show");
}

$("openTaskModal")?.addEventListener("click", openModal);
$("heroAddTask")?.addEventListener("click", openModal);
$("closeModal")?.addEventListener("click", closeTaskModal);

modal?.addEventListener("click", event => {
    if (event.target === modal) closeTaskModal();
});

/* ==========================================
   TASKS
========================================== */

const allTasks = $("allTasks");
const recentTasks = $("recentTasks");
const searchTask = $("searchTask");
const taskFilter = $("taskFilter");

async function loadTasks() {
    try {
        const data = await apiRequest("/api/tasks");
        tasks = Array.isArray(data)
            ? data
            : Array.isArray(data?.tasks) ? data.tasks : [];

        renderTasks();
        updateStatistics();
    } catch (error) {
        console.error("Error loading tasks:", error);
    }
}

/* Add task */
$("taskForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    const name = $("taskName")?.value.trim();
    const subject = $("taskSubject")?.value;
    const deadline = $("taskDeadline")?.value;

    if (!name || !subject || !deadline) {
        alert("Please fill all task fields.");
        return;
    }

    try {
        const savedTask = await apiRequest("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name,
                subject,
                deadline,
                completed: false
            })
        });

        if (savedTask) {
            const task = savedTask.task || savedTask;
            if (task.id !== undefined) tasks.unshift(task);
            else await loadTasks();
        } else {
            await loadTasks();
        }

        renderTasks();
        updateStatistics();
        $("taskForm").reset();
        closeTaskModal();
    } catch (error) {
        showError("Could not add task. Please try again.", error);
    }
});

/* Create task card */
function createTaskHTML(task) {
    return `
        <div class="task-item ${task.completed ? "completed-task" : ""}">
            <div class="task-info">
                <div class="task-title">${escapeHTML(task.name)}</div>
                <div class="task-meta">
                    ${escapeHTML(task.subject)}
                    • Deadline: ${escapeHTML(formatDate(task.deadline))}
                </div>
            </div>

            <div class="task-actions">
                <button class="complete-btn"
                    onclick="toggleTask(${Number(task.id)})"
                    title="Complete task">
                    ${task.completed ? "↩️" : "✓"}
                </button>

                <button class="edit-btn"
                    onclick="editTask(${Number(task.id)})"
                    title="Edit task">✏️</button>

                <button class="delete-btn"
                    onclick="deleteTask(${Number(task.id)})"
                    title="Delete task">🗑️</button>
            </div>
        </div>
    `;
}

/* Render tasks */
function renderTasks() {
    const search = searchTask?.value.toLowerCase().trim() || "";
    const filter = taskFilter?.value || "all";

    const filtered = tasks.filter(task => {
        if (!task) return false;

        const name = String(task.name || "").toLowerCase();
        const subject = String(task.subject || "").toLowerCase();

        const matchesSearch =
            name.includes(search) || subject.includes(search);

        const matchesFilter =
            filter === "all" ||
            (filter === "completed" && task.completed) ||
            (filter === "pending" && !task.completed);

        return matchesSearch && matchesFilter;
    });

    if (allTasks) {
        allTasks.innerHTML = filtered.length
            ? filtered.map(createTaskHTML).join("")
            : `<p class="empty-state">No tasks found. Add a task to get started!</p>`;
    }

    if (recentTasks) {
        const recent = [...tasks].slice(0, 3);
        recentTasks.innerHTML = recent.length
            ? recent.map(createTaskHTML).join("")
            : `<p class="empty-state">No tasks yet. Add your first task!</p>`;
    }

    updateStatistics();
}

/* Complete / undo task */
async function toggleTask(id) {
    const task = tasks.find(item => Number(item.id) === Number(id));
    if (!task) return;

    try {
        const updated = await apiRequest(`/api/tasks/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ completed: !task.completed })
        });

        if (updated) {
            const result = updated.task || updated;
            tasks = tasks.map(item =>
                Number(item.id) === Number(id) ? result : item
            );
        } else {
            await loadTasks();
        }

        renderTasks();
    } catch (error) {
        showError("Could not update task.", error);
    }
}

/* Edit task */
async function editTask(id) {
    const task = tasks.find(item => Number(item.id) === Number(id));
    if (!task) return;

    const name = prompt("Enter task name:", task.name);
    if (name === null) return;

    const subject = prompt("Enter subject:", task.subject);
    if (subject === null) return;

    const deadline = prompt(
        "Enter deadline (YYYY-MM-DD):",
        task.deadline
    );
    if (deadline === null) return;

    if (!name.trim() || !subject.trim() || !deadline.trim()) {
        alert("All fields are required.");
        return;
    }

    try {
        const updated = await apiRequest(`/api/tasks/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: name.trim(),
                subject: subject.trim(),
                deadline: deadline.trim()
            })
        });

        if (updated) {
            const result = updated.task || updated;
            tasks = tasks.map(item =>
                Number(item.id) === Number(id) ? result : item
            );
        } else {
            await loadTasks();
        }

        renderTasks();
    } catch (error) {
        showError("Could not edit task.", error);
    }
}

/* Delete task */
async function deleteTask(id) {
    if (!confirm("Delete this task?")) return;

    try {
        await apiRequest(`/api/tasks/${id}`, {
            method: "DELETE"
        });

        tasks = tasks.filter(item => Number(item.id) !== Number(id));
        renderTasks();
    } catch (error) {
        showError("Could not delete task.", error);
    }
}

/* Search and filter */
searchTask?.addEventListener("input", renderTasks);
taskFilter?.addEventListener("change", renderTasks);

/* ==========================================
   SUBJECTS
========================================== */

async function loadSubjects() {
    try {
        const data = await apiRequest("/api/subjects");
        subjects = Array.isArray(data)
            ? data
            : Array.isArray(data?.subjects) ? data.subjects : [];

        renderSubjects();
        updateSubjectDropdown();
    } catch (error) {
        console.error("Error loading subjects:", error);
    }
}

function renderSubjects() {
    const container = $("subjectsList");
    if (!container) return;

    if (!subjects.length) {
        container.innerHTML = `<p class="empty-state">No subjects yet. Add your first subject!</p>`;
        return;
    }

    container.innerHTML = subjects.map(subject => `
        <div class="subject-card">
            <div class="subject-info">
                <h3>${escapeHTML(subject.name)}</h3>
                <p>${escapeHTML(subject.code || "")}</p>
            </div>
            <div class="subject-actions">
                <button onclick="editSubject(${Number(subject.id)})"
                    title="Edit subject">✏️</button>
                <button onclick="deleteSubject(${Number(subject.id)})"
                    title="Delete subject">🗑️</button>
            </div>
        </div>
    `).join("");
}

function updateSubjectDropdown() {
    const dropdown = $("taskSubject");
    if (!dropdown) return;

    const selected = dropdown.value;

    dropdown.innerHTML = `<option value="">Select subject</option>` +
        subjects.map(subject => `
            <option value="${escapeHTML(subject.name)}">
                ${escapeHTML(subject.name)}
            </option>
        `).join("");

    if (subjects.some(subject => subject.name === selected)) {
        dropdown.value = selected;
    }
}

/* Add subject */
async function addSubject() {
    const name = prompt("Enter subject name:");
    if (name === null || !name.trim()) return;

    const code = prompt("Enter subject code (optional):") ?? "";

    try {
        const result = await apiRequest("/api/subjects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: name.trim(),
                code: code.trim()
            })
        });

        const subject = result?.subject || result;

        if (subject?.id !== undefined) subjects.push(subject);
        else await loadSubjects();

        renderSubjects();
        updateSubjectDropdown();
    } catch (error) {
        showError("Could not add subject.", error);
    }
}

/* Edit subject */
async function editSubject(id) {
    const subject = subjects.find(item => Number(item.id) === Number(id));
    if (!subject) return;

    const name = prompt("Enter subject name:", subject.name);
    if (name === null || !name.trim()) return;

    const code = prompt("Enter subject code:", subject.code || "");
    if (code === null) return;

    try {
        const result = await apiRequest(`/api/subjects/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: name.trim(),
                code: code.trim()
            })
        });

        if (result) {
            const updated = result.subject || result;
            subjects = subjects.map(item =>
                Number(item.id) === Number(id) ? updated : item
            );
        } else {
            await loadSubjects();
        }

        renderSubjects();
        updateSubjectDropdown();
    } catch (error) {
        showError("Could not edit subject.", error);
    }
}

/* Delete subject */
async function deleteSubject(id) {
    if (!confirm("Delete this subject?")) return;

    try {
        await apiRequest(`/api/subjects/${id}`, {
            method: "DELETE"
        });

        subjects = subjects.filter(item => Number(item.id) !== Number(id));
        renderSubjects();
        updateSubjectDropdown();
    } catch (error) {
        showError("Could not delete subject.", error);
    }
}

/* Connect subject buttons if present */
$("addSubjectBtn")?.addEventListener("click", addSubject);
$("addSubject")?.addEventListener("click", addSubject);

/* ==========================================
   NOTES
========================================== */

async function loadNotes() {
    try {
        const data = await apiRequest("/api/notes");
        notes = Array.isArray(data)
            ? data
            : Array.isArray(data?.notes) ? data.notes : [];

        renderNotes();
    } catch (error) {
        console.error("Error loading notes:", error);
    }
}

function renderNotes() {
    const container = $("notesList");
    if (!container) return;

    if (!notes.length) {
        container.innerHTML = `<p class="empty-state">No notes yet. Add your first note!</p>`;
        return;
    }

    container.innerHTML = notes.map(note => `
        <div class="note-card">
            <div class="note-content">
                <h3>${escapeHTML(note.title)}</h3>
                <p>${escapeHTML(note.content)}</p>
            </div>
            <div class="note-actions">
                <button onclick="editNote(${Number(note.id)})"
                    title="Edit note">✏️</button>
                <button onclick="deleteNote(${Number(note.id)})"
                    title="Delete note">🗑️</button>
            </div>
        </div>
    `).join("");
}

/* Add note */
async function addNote() {
    const title = prompt("Enter note title:");
    if (title === null || !title.trim()) return;

    const content = prompt("Enter note content:");
    if (content === null || !content.trim()) return;

    try {
        const result = await apiRequest("/api/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: title.trim(),
                content: content.trim()
            })
        });

        const note = result?.note || result;

        if (note?.id !== undefined) notes.unshift(note);
        else await loadNotes();

        renderNotes();
    } catch (error) {
        showError("Could not add note.", error);
    }
}

/* Edit note */
async function editNote(id) {
    const note = notes.find(item => Number(item.id) === Number(id));
    if (!note) return;

    const title = prompt("Enter note title:", note.title);
    if (title === null || !title.trim()) return;

    const content = prompt("Enter note content:", note.content);
    if (content === null || !content.trim()) return;

    try {
        const result = await apiRequest(`/api/notes/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: title.trim(),
                content: content.trim()
            })
        });

        if (result) {
            const updated = result.note || result;
            notes = notes.map(item =>
                Number(item.id) === Number(id) ? updated : item
            );
        } else {
            await loadNotes();
        }

        renderNotes();
    } catch (error) {
        showError("Could not edit note.", error);
    }
}

/* Delete note */
async function deleteNote(id) {
    if (!confirm("Delete this note?")) return;

    try {
        await apiRequest(`/api/notes/${id}`, {
            method: "DELETE"
        });

        notes = notes.filter(item => Number(item.id) !== Number(id));
        renderNotes();
    } catch (error) {
        showError("Could not delete note.", error);
    }
}

/* Connect note buttons if present */
$("addNoteBtn")?.addEventListener("click", addNote);
$("addNote")?.addEventListener("click", addNote);

/* ==========================================
   STATISTICS / PROGRESS
========================================== */

function updateStatistics() {
    const total = tasks.length;
    const completed = tasks.filter(task => task?.completed).length;
    const pending = total - completed;
    const percentage = total === 0
        ? 0
        : Math.round((completed / total) * 100);

    const values = {
        totalTasks: total,
        pendingTasks: pending,
        completedTasks: completed,
        progressPercent: percentage + "%",
        circlePercent: percentage + "%",
        bigProgress: percentage + "%",
        progressTotal: total,
        progressDone: completed,
        progressPending: pending
    };

    Object.entries(values).forEach(([id, value]) => {
        const element = $(id);
        if (element) element.textContent = value;
    });

    const degrees = percentage * 3.6;

    document.querySelectorAll(".progress-circle, .big-circle")
        .forEach(circle => {
            circle.style.background = `conic-gradient(
                var(--primary) ${degrees}deg,
                #e5e7eb ${degrees}deg
            )`;
        });

    const message = $("progressMessage");
    if (message) {
        if (percentage === 0) {
            message.textContent = "Start adding your lab tasks!";
        } else if (percentage < 50) {
            message.textContent = "Good start! Keep going 💪";
        } else if (percentage < 100) {
            message.textContent = "You're making great progress! 🚀";
        } else {
            message.textContent = "All tasks completed! 🎉";
        }
    }

    const bigProgressText = $("bigProgressText");
    if (bigProgressText) {
        bigProgressText.textContent = percentage === 100
            ? "Amazing! All your tasks are completed."
            : "Keep completing your lab tasks to increase your progress.";
    }
}

/* ==========================================
   DARK MODE
========================================== */

const themeBtn = $("themeBtn");

function applyTheme(isDark) {
    document.body.classList.toggle("dark", isDark);

    if (themeBtn) {
        themeBtn.textContent = isDark
            ? "☀️ Light Mode"
            : "🌙 Dark Mode";
    }

    localStorage.setItem("labMateDarkMode", String(isDark));
}

themeBtn?.addEventListener("click", () => {
    applyTheme(!document.body.classList.contains("dark"));
});

applyTheme(localStorage.getItem("labMateDarkMode") === "true");

/* ==========================================
   MY ACCOUNT
========================================== */

async function loadMyAccount() {
    const nameElement = $("accountName");
    const usernameElement = $("accountUsername");
    const emailElement = $("accountEmail");
    const messageElement = $("accountMessage");

    try {
        const data = await apiRequest("/api/me");

        if (!data?.logged_in) {
            window.location.replace("/login");
            return;
        }

        const user = data.user || {};

        if (nameElement) {
            nameElement.textContent = user.name || "Not provided";
        }

        if ($("accountNameDetail")) {
            $("accountNameDetail").textContent = user.name || "Not provided";
        }

        if (usernameElement) {
            usernameElement.textContent = user.username || "Not provided";
        }

        if (emailElement) {
            emailElement.textContent = user.email || "Not provided";
        }

        if (messageElement) messageElement.textContent = "";
    } catch (error) {
        console.error("Account loading error:", error);
        if (messageElement) {
            messageElement.textContent =
                "Could not load account details. Please try again.";
        }
    }
}

/* ==========================================
   LOGOUT
========================================== */

$("logoutBtn")?.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to logout?")) return;

    const button = $("logoutBtn");
    button.disabled = true;

    try {
        await fetch("/api/logout", { method: "POST" });
        window.location.replace("/login");
    } catch (error) {
        console.error("Logout error:", error);
        button.disabled = false;
        alert("Could not connect to the server.");
    }
});

/* ==========================================
   START LAB MATE
========================================== */

loadTasks();
loadSubjects();
loadNotes();
