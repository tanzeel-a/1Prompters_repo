const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, '../data/questions-1000.json');

function validate() {
    if (!fs.existsSync(FILE_PATH)) {
        console.error('❌ Data file not found!');
        process.exit(1);
    }

    try {
        const raw = fs.readFileSync(FILE_PATH);
        const data = JSON.parse(raw);

        // Check Manifest
        if (!data.manifest || data.manifest.totalQuestions !== 1000) {
            console.error(`❌ Invalid manifest. Expected 1000 questions, found ${data.manifest?.totalQuestions}`);
        } else {
            console.log('✅ Manifest check passed');
        }

        // Check Questions array
        if (!Array.isArray(data.questions) || data.questions.length !== 1000) {
            console.error(`❌ Invalid questions array. Found ${data.questions?.length} items`);
            process.exit(1);
        }

        // Check IDs
        const ids = new Set();
        let errors = 0;

        data.questions.forEach((q, i) => {
            if (!q.id) {
                console.error(`❌ Question at index ${i} missing ID`);
                errors++;
            } else if (ids.has(q.id)) {
                console.error(`❌ Duplicate ID found: ${q.id}`);
                errors++;
            }
            ids.add(q.id);

            // Check required fields
            if (!q.unit || !q.type || !q.body || !q.difficulty) {
                console.error(`❌ Question ${q.id} missing required fields`);
                errors++;
            }
        });

        if (errors === 0) {
            console.log('✅ All 1000 questions validated successfully!');
            console.log('✅ ID Uniqueness check passed');
            console.log('✅ Schema check passed');
        } else {
            console.error(`❌ Validation failed with ${errors} errors`);
            process.exit(1);
        }

    } catch (err) {
        console.error('❌ JSON Parse Error:', err.message);
        process.exit(1);
    }
}

validate();
