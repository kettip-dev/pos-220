const fs = require('fs');
const transcriptPath = 'C:/Users/MSI-PC/.gemini/antigravity/brain/0341a550-1c7c-439d-a11f-a1a1a7b9fb88/.system_generated/logs/transcript_full.jsonl';
const line = fs.readFileSync(transcriptPath, 'utf8').split('\n')[0];
const text = JSON.parse(line).content;

// Find "items": [
const startIndex = text.indexOf('"items": [');
if (startIndex === -1) {
    console.error('Could not find items array in transcript');
    process.exit(1);
}

const itemsText = text.substring(startIndex + 9); // starts right after "items": 

// Parse as many objects as possible
let validItems = [];
let depth = 0;
let inString = false;
let escape = false;
let currentObjStart = -1;

for (let i = 0; i < itemsText.length; i++) {
    const char = itemsText[i];

    if (escape) {
        escape = false;
        continue;
    }

    if (char === '\\') {
        escape = true;
        continue;
    }

    if (char === '"') {
        inString = !inString;
        continue;
    }

    if (!inString) {
        if (char === '{') {
            if (depth === 0) {
                currentObjStart = i;
            }
            depth++;
        } else if (char === '}') {
            depth--;
            if (depth === 0 && currentObjStart !== -1) {
                const itemStr = itemsText.substring(currentObjStart, i + 1);
                try {
                    const parsed = JSON.parse(itemStr);
                    if (parsed.name && parsed.price !== undefined) {
                        validItems.push(parsed);
                    }
                } catch (e) {
                    // Incomplete JSON object at truncation boundary
                }
                currentObjStart = -1;
            }
        }
    }
}

console.log(`Successfully extracted ${validItems.length} complete items from chat snippet!`);
fs.writeFileSync('catalog_partial.json', JSON.stringify({ items: validItems }, null, 2));
console.log('Saved to catalog_partial.json');
