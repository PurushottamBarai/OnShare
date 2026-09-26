/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_PATH = path.join(__dirname, '..', 'src', 'locales', 'en.json');
const LOCALES_DIR = path.join(__dirname, '..', 'src', 'locales');

const TARGET_LANGUAGES = [
  'hi', 'mr', 'gu', 'bn', 'ar', 'ja', 'zh', 'fr', 'de', 'ml', 'pa'
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const decodeHtmlEntities = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
};

const translateText = async (text, targetLang, retries = 2) => {
  if (!text || text.trim() === '' || text.startsWith('http') || /^[^a-zA-Z0-9]+$/.test(text)) {
    return text;
  }

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SharePort-Locale-Translator/1.0',
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data && data.responseData && typeof data.responseData.translatedText === 'string') {
        const translated = decodeHtmlEntities(data.responseData.translatedText.trim());
        if (translated.toUpperCase().includes('MYMEMORY WARNING:')) {
          console.warn(`[warning] MyMemory quota warning for ${targetLang}: "${text}"`);
          return text;
        }
        return translated;
      }
      throw new Error('Invalid response structure');
    } catch (err) {
      if (attempt < retries) {
        await sleep(500 * (attempt + 1));
      } else {
        console.warn(`[fallback] Failed to translate "${text}" to ${targetLang} (${err.message}). Using English.`);
        return text;
      }
    }
  }
  return text;
};

async function translateObject(sourceObj, targetObj, targetLang) {
  let hasChanges = false;
  
  for (const key in sourceObj) {
    if (typeof sourceObj[key] === 'object' && sourceObj[key] !== null) {
      if (!targetObj[key] || typeof targetObj[key] !== 'object') {
        targetObj[key] = {};
        hasChanges = true;
      }
      const changed = await translateObject(sourceObj[key], targetObj[key], targetLang);
      if (changed) hasChanges = true;
    } else {
      // If the key doesn't exist in target, or it's empty, or it still has the old mock "[lang]" prefix, translate it
      if (!targetObj[key] || (typeof targetObj[key] === 'string' && targetObj[key].startsWith(`[${targetLang}]`))) {
        targetObj[key] = await translateText(sourceObj[key], targetLang);
        hasChanges = true;
        console.log(`Translated [${targetLang}] ${key}: ${targetObj[key]}`);
        await sleep(150); // Ratelimit protection
      }
    }
  }
  return hasChanges;
}

async function main() {
  if (!fs.existsSync(SOURCE_PATH)) {
    console.error(`Source file not found at ${SOURCE_PATH}`);
    process.exit(1);
  }

  const sourceData = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf-8'));

  console.log(`Loaded source en.json.`);
  console.log(`Translating into ${TARGET_LANGUAGES.length} languages...`);

  if (!fs.existsSync(LOCALES_DIR)) {
    fs.mkdirSync(LOCALES_DIR, { recursive: true });
  }

  for (const lang of TARGET_LANGUAGES) {
    console.log(`\nProcessing [${lang}]...`);
    const targetFile = path.join(LOCALES_DIR, `${lang}.json`);
    
    let targetData = {};
    if (fs.existsSync(targetFile)) {
      targetData = JSON.parse(fs.readFileSync(targetFile, 'utf-8'));
    }

    const hasChanges = await translateObject(sourceData, targetData, lang);

    if (hasChanges) {
      fs.writeFileSync(targetFile, JSON.stringify(targetData, null, 2) + '\n', 'utf-8');
      console.log(`Saved updates for ${lang}.json`);
    } else {
      console.log(`[${lang}] is up to date.`);
    }
  }

  console.log('\nAll locale files translated successfully!');
}

main().catch((err) => {
  console.error('Fatal translation error:', err);
  process.exit(1);
});
