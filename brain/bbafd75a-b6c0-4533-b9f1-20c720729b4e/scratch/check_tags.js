const fs = require('fs');

const content = fs.readFileSync('d:/systems/bantudefdig/frontend/src/features/developer_admin/TenantsPage.tsx', 'utf8');

const openingTags = content.match(/<([a-zA-Z0-9]+)(?:\s+[^>]*[^/])?>/g) || [];
const closingTags = content.match(/<\/([a-zA-Z0-9]+)>/g) || [];

const counts = {};

openingTags.forEach(tag => {
    const tagName = tag.match(/<([a-zA-Z0-9]+)/)[1];
    counts[tagName] = (counts[tagName] || 0) + 1;
});

closingTags.forEach(tag => {
    const tagName = tag.match(/<\/([a-zA-Z0-9]+)/)[1];
    counts[tagName] = (counts[tagName] || 0) - 1;
});

for (const [tag, count] of Object.entries(counts)) {
    if (count !== 0) {
        console.log(`Tag <${tag}> mismatch: ${count}`);
    }
}
