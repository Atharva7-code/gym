const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// FIND THE FRONTEND CORRECTLY
// =====================================================

function findProjectRoot() {
    const possibleRoots = [
        process.cwd(),
        __dirname,
        path.join(process.cwd(), "gym-progress-app"),
        path.join(__dirname, "gym-progress-app")
    ];

    for (const root of possibleRoots) {
        const indexFile = path.join(root, "public", "index.html");

        if (fs.existsSync(indexFile)) {
            return root;
        }
    }

    return null;
}

const PROJECT_ROOT = findProjectRoot();

if (!PROJECT_ROOT) {
    console.error("❌ Could not find public/index.html");
    process.exit(1);
}

const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "workouts.json");


// =====================================================
// MIDDLEWARE
// =====================================================

app.use(express.json({ limit: "2mb" }));

app.use(express.static(PUBLIC_DIR));


// =====================================================
// DATABASE / FILE STORAGE
// =====================================================

function ensureDataFile() {

    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, {
            recursive: true
        });
    }

    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(
            DATA_FILE,
            "[]",
            "utf8"
        );
    }
}


function readWorkouts() {

    ensureDataFile();

    try {

        const raw = fs.readFileSync(
            DATA_FILE,
            "utf8"
        );

        if (!raw.trim()) {
            return [];
        }

        const data = JSON.parse(raw);

        return Array.isArray(data)
            ? data
            : [];

    } catch (error) {

        console.error(
            "Could not read workouts:",
            error
        );

        return [];
    }
}


function writeWorkouts(workouts) {

    ensureDataFile();

    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(workouts, null, 2),
        "utf8"
    );
}


// =====================================================
// DATA CLEANING
// =====================================================

function sanitizeSet(set = {}) {

    return {

        reps: Number(set.reps) || 0,

        weight: Number(set.weight) || 0,

        rpe: Number(set.rpe) || 0,

        seconds: Number(set.seconds) || 0,

        completed: Boolean(set.completed)
    };
}


function sanitizeExercise(exercise = {}) {

    return {

        id:
            typeof exercise.id === "string" &&
            exercise.id.length > 0
                ? exercise.id
                : crypto.randomUUID(),

        name:
            String(
                exercise.name || "Exercise"
            ).trim(),

        type:
            exercise.type === "hold"
                ? "hold"
                : "weight_reps",

        sets:
            Array.isArray(exercise.sets) &&
            exercise.sets.length > 0
                ? exercise.sets.map(sanitizeSet)
                : [sanitizeSet()]
    };
}


// =====================================================
// API
// =====================================================

// Get all workouts

app.get("/api/workouts", (req, res) => {

    try {

        const workouts = readWorkouts();

        res.json(workouts);

    } catch (error) {

        res.status(500).json({
            error: "Could not load workouts."
        });
    }
});


// Get one workout

app.get("/api/workouts/:id", (req, res) => {

    const workouts = readWorkouts();

    const workout = workouts.find(
        workout =>
            workout.id === req.params.id
    );

    if (!workout) {

        return res.status(404).json({
            error: "Workout not found."
        });
    }

    res.json(workout);
});


// Create workout

app.post("/api/workouts", (req, res) => {

    try {

        const body = req.body || {};


        if (
            !body.name ||
            typeof body.name !== "string" ||
            !body.name.trim()
        ) {

            return res.status(400).json({
                error: "A workout needs a name."
            });
        }


        if (!body.date) {

            return res.status(400).json({
                error: "A workout needs a date."
            });
        }


        if (
            !Array.isArray(body.exercises) ||
            body.exercises.length === 0
        ) {

            return res.status(400).json({
                error:
                    "Add at least one exercise before saving."
            });
        }


        const workout = {

            id: crypto.randomUUID(),

            name: body.name.trim(),

            category:
                body.category ||
                "Normal Lifting",

            date: body.date,

            duration:
                Number(body.duration) || 0,

            bodyweight:
                Number(body.bodyweight) || 0,

            notes:
                String(body.notes || ""),

            exercises:
                body.exercises.map(
                    sanitizeExercise
                ),

            createdAt:
                new Date().toISOString()
        };


        const workouts = readWorkouts();

        workouts.push(workout);

        writeWorkouts(workouts);

        res.status(201).json(workout);

    } catch (error) {

        console.error(
            "Could not save workout:",
            error
        );

        res.status(500).json({
            error: "Could not save workout."
        });
    }
});


// Delete workout

app.delete("/api/workouts/:id", (req, res) => {

    try {

        const workouts = readWorkouts();

        const filtered = workouts.filter(
            workout =>
                workout.id !== req.params.id
        );


        if (filtered.length === workouts.length) {

            return res.status(404).json({
                error:
                    "That workout does not exist."
            });
        }


        writeWorkouts(filtered);

        res.json({
            ok: true
        });

    } catch (error) {

        console.error(
            "Could not delete workout:",
            error
        );

        res.status(500).json({
            error:
                "Could not delete workout."
        });
    }
});


// =====================================================
// FRONTEND
// =====================================================

app.get("*", (req, res) => {

    const indexFile =
        path.join(
            PUBLIC_DIR,
            "index.html"
        );


    if (!fs.existsSync(indexFile)) {

        return res.status(500).send(`
            <h1>Frontend not found</h1>

            <p>
                The server could not find:
            </p>

            <code>
                ${indexFile}
            </code>
        `);
    }


    res.sendFile(indexFile);
});


// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {

    console.log("");
    console.log("======================================");
    console.log("        GYM PROGRESS SERVER");
    console.log("======================================");

    console.log("");
    console.log(
        "Server:",
        `http://localhost:${PORT}`
    );

    console.log(
        "Project:",
        PROJECT_ROOT
    );

    console.log(
        "Frontend:",
        PUBLIC_DIR
    );

    console.log(
        "Workout data:",
        DATA_FILE
    );

    console.log("");
    console.log("✅ SERVER IS READY");
    console.log("======================================");
    console.log("");
});