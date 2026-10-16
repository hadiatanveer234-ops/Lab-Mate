
from flask import (
    Flask, jsonify, request, send_from_directory, session
)
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import json
import os


# ==================================================
# APP SETUP
# ==================================================

app = Flask(__name__, static_folder="../frontend", static_url_path="")

# Keep your existing secret key for now.
# For a deployed app, use a private environment variable.
app.secret_key = "lab-mate-secret-key-change-later"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

TASKS_FILE = os.path.join(BASE_DIR, "tasks.json")
SUBJECTS_FILE = os.path.join(BASE_DIR, "subjects.json")
NOTES_FILE = os.path.join(BASE_DIR, "notes.json")
USERS_FILE = os.path.join(BASE_DIR, "users.json")


# ==================================================
# LOAD AND SAVE DATA
# ==================================================

def load_data(file_path):
    if not os.path.exists(file_path):
        return []

    with open(file_path, "r", encoding="utf-8") as file:
        return json.load(file)


def save_data(file_path, data):
    with open(file_path, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=4)


# ==================================================
# LOGIN PROTECTION
# ==================================================

def login_required(function):
    @wraps(function)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Please login first"}), 401

        return function(*args, **kwargs)

    return wrapper


def belongs_to_current_user(item):
    return item.get("user_id") == session.get("user_id")


# ==================================================
# SIGNUP
# ==================================================

@app.route("/api/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True) or {}

    name = data.get("name", "").strip()
    username = data.get("username", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "")

    if not all([name, username, email, password]):
        return jsonify({"error": "All fields are required"}), 400

    users = load_data(USERS_FILE)

    for user in users:
        if user["username"].lower() == username.lower():
            return jsonify({"error": "Username already exists"}), 409

        if user["email"].lower() == email.lower():
            return jsonify({"error": "Email already exists"}), 409

    new_id = max(
        [user["id"] for user in users],
        default=0
    ) + 1

    new_user = {
        "id": new_id,
        "name": name,
        "username": username,
        "email": email,
        "password": generate_password_hash(password)
    }

    users.append(new_user)
    save_data(USERS_FILE, users)

    return jsonify({
        "message": "Account created successfully"
    }), 201


# ==================================================
# LOGIN
# ==================================================

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    username_or_email = data.get("username", "").strip()
    password = data.get("password", "")

    users = load_data(USERS_FILE)

    for user in users:
        if (
            user["username"].lower() == username_or_email.lower()
            or user["email"].lower() == username_or_email.lower()
        ):
            if check_password_hash(user["password"], password):
                session.clear()
                session["user_id"] = user["id"]
                session["username"] = user["username"]

                return jsonify({
                    "message": "Login successful",
                    "user": {
                        "id": user["id"],
                        "name": user["name"],
                        "username": user["username"],
                        "email": user["email"]
                    }
                })

            return jsonify({"error": "Incorrect password"}), 401

    return jsonify({"error": "Username or email not found"}), 404


# ==================================================
# LOGOUT
# ==================================================

@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()

    return jsonify({
        "message": "Logged out successfully"
    })


# ==================================================
# CURRENT USER
# ==================================================

@app.route("/api/me", methods=["GET"])
def current_user():
    if "user_id" not in session:
        return jsonify({"logged_in": False})

    users = load_data(USERS_FILE)

    for user in users:
        if user["id"] == session["user_id"]:
            return jsonify({
                "logged_in": True,
                "user": {
                    "id": user["id"],
                    "name": user["name"],
                    "username": user["username"],
                    "email": user["email"]
                }
            })

    session.clear()
    return jsonify({"logged_in": False})


# ==================================================
# PAGES
# ==================================================

@app.route("/")
def home():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/login")
def login_page():
    return send_from_directory(app.static_folder, "login.html")


@app.route("/signup")
def signup_page():
    return send_from_directory(app.static_folder, "signup.html")


# ==================================================
# TASKS
# ==================================================

@app.route("/api/tasks", methods=["GET"])
@login_required
def get_tasks():
    tasks = load_data(TASKS_FILE)

    my_tasks = [
        task for task in tasks
        if belongs_to_current_user(task)
    ]

    return jsonify(my_tasks)


@app.route("/api/tasks", methods=["POST"])
@login_required
def add_task():
    data = request.get_json(silent=True) or {}
    tasks = load_data(TASKS_FILE)

    new_id = max(
        [task.get("id", 0) for task in tasks],
        default=0
    ) + 1

    new_task = {
        "id": new_id,
        "user_id": session["user_id"],
        "name": data.get("name", ""),
        "subject": data.get("subject", ""),
        "deadline": data.get("deadline", ""),
        "completed": data.get("completed", False)
    }

    tasks.append(new_task)
    save_data(TASKS_FILE, tasks)

    return jsonify(new_task), 201


@app.route("/api/tasks/<int:task_id>", methods=["PATCH"])
@login_required
def update_task(task_id):
    tasks = load_data(TASKS_FILE)
    data = request.get_json(silent=True) or {}

    for task in tasks:
        if (
            task.get("id") == task_id
            and belongs_to_current_user(task)
        ):
            for field in ("name", "subject", "deadline", "completed"):
                if field in data:
                    task[field] = data[field]

            save_data(TASKS_FILE, tasks)
            return jsonify(task)

    return jsonify({"error": "Task not found"}), 404


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
@login_required
def delete_task(task_id):
    tasks = load_data(TASKS_FILE)

    updated_tasks = [
        task for task in tasks
        if not (
            task.get("id") == task_id
            and belongs_to_current_user(task)
        )
    ]

    if len(updated_tasks) == len(tasks):
        return jsonify({"error": "Task not found"}), 404

    save_data(TASKS_FILE, updated_tasks)

    return jsonify({"message": "Task deleted successfully"})


# ==================================================
# SUBJECTS
# ==================================================

@app.route("/api/subjects", methods=["GET"])
@login_required
def get_subjects():
    subjects = load_data(SUBJECTS_FILE)

    my_subjects = [
        subject for subject in subjects
        if belongs_to_current_user(subject)
    ]

    return jsonify(my_subjects)


@app.route("/api/subjects", methods=["POST"])
@login_required
def add_subject():
    data = request.get_json(silent=True) or {}
    subjects = load_data(SUBJECTS_FILE)

    new_id = max(
        [subject.get("id", 0) for subject in subjects],
        default=0
    ) + 1

    new_subject = {
        "id": new_id,
        "user_id": session["user_id"],
        "name": data.get("name", ""),
        "code": data.get("code", "")
    }

    subjects.append(new_subject)
    save_data(SUBJECTS_FILE, subjects)

    return jsonify(new_subject), 201


@app.route("/api/subjects/<int:subject_id>", methods=["PATCH"])
@login_required
def update_subject(subject_id):
    subjects = load_data(SUBJECTS_FILE)
    data = request.get_json(silent=True) or {}

    for subject in subjects:
        if (
            subject.get("id") == subject_id
            and belongs_to_current_user(subject)
        ):
            for field in ("name", "code"):
                if field in data:
                    subject[field] = data[field]

            save_data(SUBJECTS_FILE, subjects)
            return jsonify(subject)

    return jsonify({"error": "Subject not found"}), 404


@app.route("/api/subjects/<int:subject_id>", methods=["DELETE"])
@login_required
def delete_subject(subject_id):
    subjects = load_data(SUBJECTS_FILE)

    updated_subjects = [
        subject for subject in subjects
        if not (
            subject.get("id") == subject_id
            and belongs_to_current_user(subject)
        )
    ]

    if len(updated_subjects) == len(subjects):
        return jsonify({"error": "Subject not found"}), 404

    save_data(SUBJECTS_FILE, updated_subjects)

    return jsonify({"message": "Subject deleted successfully"})


# ==================================================
# NOTES
# ==================================================

@app.route("/api/notes", methods=["GET"])
@login_required
def get_notes():
    notes = load_data(NOTES_FILE)

    my_notes = [
        note for note in notes
        if belongs_to_current_user(note)
    ]

    return jsonify(my_notes)


@app.route("/api/notes", methods=["POST"])
@login_required
def add_note():
    data = request.get_json(silent=True) or {}
    notes = load_data(NOTES_FILE)

    new_id = max(
        [note.get("id", 0) for note in notes],
        default=0
    ) + 1

    new_note = {
        "id": new_id,
        "user_id": session["user_id"],
        "title": data.get("title", ""),
        "subject": data.get("subject", ""),
        "content": data.get("content", "")
    }

    notes.append(new_note)
    save_data(NOTES_FILE, notes)

    return jsonify(new_note), 201


@app.route("/api/notes/<int:note_id>", methods=["PATCH"])
@login_required
def update_note(note_id):
    notes = load_data(NOTES_FILE)
    data = request.get_json(silent=True) or {}

    for note in notes:
        if (
            note.get("id") == note_id
            and belongs_to_current_user(note)
        ):
            for field in ("title", "subject", "content"):
                if field in data:
                    note[field] = data[field]

            save_data(NOTES_FILE, notes)
            return jsonify(note)

    return jsonify({"error": "Note not found"}), 404


@app.route("/api/notes/<int:note_id>", methods=["DELETE"])
@login_required
def delete_note(note_id):
    notes = load_data(NOTES_FILE)

    updated_notes = [
        note for note in notes
        if not (
            note.get("id") == note_id
            and belongs_to_current_user(note)
        )
    ]

    if len(updated_notes) == len(notes):
        return jsonify({"error": "Note not found"}), 404

    save_data(NOTES_FILE, updated_notes)

    return jsonify({"message": "Note deleted successfully"})


# ==================================================
# RUN SERVER
# ==================================================

if __name__ == "__main__":
    app.run(debug=True)
