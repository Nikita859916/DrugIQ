// ─── utils/medicalDictionary.js ──────────────────────────────────────────────
// Reusable Medical Side Effects Dictionary with 50+ common side effects & synonyms.
// Maps patient-reported casual phrases (e.g. "felt sick", "head spinning") to canonical medical terms.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

/**
 * Structured Medical Side Effects Dictionary
 * 50+ Canonical side effects with synonym variants for NLP matching.
 */
const MEDICAL_SIDE_EFFECTS = [
  {
    canonical: 'headache',
    severity: 'mild',
    synonyms: ['headache', 'head pain', 'migraine', 'pounding head', 'head pressure', 'head ache'],
  },
  {
    canonical: 'nausea',
    severity: 'mild',
    synonyms: ['nausea', 'nauseous', 'felt sick', 'sick to my stomach', 'sick to stomach', 'queasy', 'stomach upset', 'upset stomach'],
  },
  {
    canonical: 'vomiting',
    severity: 'moderate',
    synonyms: ['vomiting', 'vomit', 'threw up', 'throwing up', 'puking', 'puke', 'emesis'],
  },
  {
    canonical: 'dizziness',
    severity: 'mild',
    synonyms: ['dizziness', 'dizzy', 'lightheaded', 'light headed', 'head spinning', 'head spin', 'woozi', 'woozy', 'giddy'],
  },
  {
    canonical: 'fatigue',
    severity: 'mild',
    synonyms: ['fatigue', 'fatigued', 'exhausted', 'exhaustion', 'extreme tiredness', 'feeling drained', 'drained', 'lack of energy', 'no energy', 'lethargy', 'sluggish'],
  },
  {
    canonical: 'anxiety',
    severity: 'moderate',
    synonyms: ['anxiety', 'anxious', 'panic attack', 'panic', 'feeling nervous', 'nervousness', 'jitters', 'jittery', 'restlessness', 'apprehension'],
  },
  {
    canonical: 'depression',
    severity: 'severe',
    synonyms: ['depression', 'depressed', 'feeling down', 'sadness', 'mood swings', 'low mood', 'crying spells', 'hopelessness'],
  },
  {
    canonical: 'insomnia',
    severity: 'moderate',
    synonyms: ['insomnia', 'sleeplessness', "can't sleep", 'cannot sleep', 'trouble sleeping', 'unable to sleep', 'sleep disturbance', 'waking up'],
  },
  {
    canonical: 'dry mouth',
    severity: 'mild',
    synonyms: ['dry mouth', 'cotton mouth', 'mouth dryness', 'parched mouth', 'dry throat'],
  },
  {
    canonical: 'constipation',
    severity: 'mild',
    synonyms: ['constipation', 'constipated', 'hard stool', 'bowel blockage', 'irregular bowel'],
  },
  {
    canonical: 'diarrhea',
    severity: 'moderate',
    synonyms: ['diarrhea', 'diarrhoea', 'loose stools', 'loose stool', 'frequent bowel movements', 'watery stool', 'runny stool', 'the runs'],
  },
  {
    canonical: 'rash',
    severity: 'moderate',
    synonyms: ['rash', 'skin rash', 'skin eruption', 'hives', 'red spots', 'skin breakout'],
  },
  {
    canonical: 'itching',
    severity: 'mild',
    synonyms: ['itching', 'itchy', 'itchy skin', 'pruritus', 'scratchy skin', 'skin itch'],
  },
  {
    canonical: 'blurred vision',
    severity: 'moderate',
    synonyms: ['blurred vision', 'blurry vision', 'cloudy vision', 'vision problems', 'double vision', 'hazy vision'],
  },
  {
    canonical: 'weight gain',
    severity: 'moderate',
    synonyms: ['weight gain', 'gained weight', 'putting on weight', 'increased weight', 'weight increase', 'fat gain'],
  },
  {
    canonical: 'weight loss',
    severity: 'moderate',
    synonyms: ['weight loss', 'lost weight', 'losing weight', 'dropped weight', 'decreased weight'],
  },
  {
    canonical: 'fever',
    severity: 'moderate',
    synonyms: ['fever', 'high temperature', 'chills', 'feverish', 'temperature spike'],
  },
  {
    canonical: 'cough',
    severity: 'mild',
    synonyms: ['cough', 'coughing', 'dry cough', 'persistent cough', 'tickle in throat'],
  },
  {
    canonical: 'muscle pain',
    severity: 'mild',
    synonyms: ['muscle pain', 'muscle aches', 'myalgia', 'sore muscles', 'body aches', 'muscle soreness'],
  },
  {
    canonical: 'joint pain',
    severity: 'moderate',
    synonyms: ['joint pain', 'arthralgia', 'joint stiffness', 'painful joints', 'knee pain', 'aching joints'],
  },
  {
    canonical: 'swelling',
    severity: 'moderate',
    synonyms: ['swelling', 'swollen', 'edema', 'oedema', 'fluid retention', 'puffiness', 'swollen ankles', 'swollen feet'],
  },
  {
    canonical: 'sleepiness',
    severity: 'mild',
    synonyms: ['sleepiness', 'drowsiness', 'drowsy', 'somnolence', 'feeling sleepy', 'knocked me out', 'sedation'],
  },
  {
    canonical: 'loss of appetite',
    severity: 'mild',
    synonyms: ['loss of appetite', 'no appetite', 'decreased appetite', 'anorexia', 'not feeling hungry', 'don\'t want to eat'],
  },
  {
    canonical: 'stomach pain',
    severity: 'mild',
    synonyms: ['stomach pain', 'abdominal pain', 'stomach cramps', 'belly ache', 'stomach ache', 'ab pain', 'abdominal cramps'],
  },
  {
    canonical: 'heartburn',
    severity: 'mild',
    synonyms: ['heartburn', 'acid reflux', 'indigestion', 'gerd', 'burning chest', 'stomach burning'],
  },
  {
    canonical: 'brain fog',
    severity: 'moderate',
    synonyms: ['brain fog', 'mental fog', 'confusion', 'trouble focusing', 'spacey', 'spotted memory', 'zombie feeling', 'groggy'],
  },
  {
    canonical: 'shortness of breath',
    severity: 'severe',
    synonyms: ['shortness of breath', 'breathless', 'difficulty breathing', 'dyspnea', 'hard to breathe', 'winded'],
  },
  {
    canonical: 'tremor',
    severity: 'moderate',
    synonyms: ['tremor', 'shaking', 'shaky hands', 'trembling', 'shakes', 'hand tremor'],
  },
  {
    canonical: 'sweating',
    severity: 'mild',
    synonyms: ['sweating', 'excessive sweating', 'night sweats', 'perspiration', 'profuse sweating', 'sweats'],
  },
  {
    canonical: 'palpitations',
    severity: 'severe',
    synonyms: ['palpitations', 'racing heart', 'rapid heartbeat', 'heart fluttering', 'pounding heart', 'tachycardia', 'heart racing'],
  },
  {
    canonical: 'hair loss',
    severity: 'moderate',
    synonyms: ['hair loss', 'hair thinning', 'alopecia', 'falling hair', 'losing hair'],
  },
  {
    canonical: 'acne',
    severity: 'mild',
    synonyms: ['acne', 'breakouts', 'pimples', 'skin breakouts', 'zits'],
  },
  {
    canonical: 'memory loss',
    severity: 'severe',
    synonyms: ['memory loss', 'forgetfulness', 'poor memory', 'memory problems', 'forgetting things'],
  },
  {
    canonical: 'numbness',
    severity: 'moderate',
    synonyms: ['numbness', 'tingling', 'pins and needles', 'neuropathy', 'numb hands', 'numb feet'],
  },
  {
    canonical: 'gas',
    severity: 'mild',
    synonyms: ['gas', 'bloating', 'flatulence', 'gassy', 'bloated', 'stomach bloating'],
  },
  {
    canonical: 'frequent urination',
    severity: 'mild',
    synonyms: ['frequent urination', 'peeing often', 'increased urination', 'frequent peeing', 'urination'],
  },
  {
    canonical: 'low blood pressure',
    severity: 'severe',
    synonyms: ['low blood pressure', 'hypotension', 'fainting', 'passed out', 'feeling faint'],
  },
  {
    canonical: 'high blood pressure',
    severity: 'severe',
    synonyms: ['high blood pressure', 'hypertension', 'elevated bp', 'high bp'],
  },
  {
    canonical: 'taste changes',
    severity: 'mild',
    synonyms: ['taste changes', 'metallic taste', 'loss of taste', 'strange taste', 'bad taste in mouth'],
  },
  {
    canonical: 'irritability',
    severity: 'mild',
    synonyms: ['irritability', 'irritable', 'agitation', 'short temper', 'easily annoyed', 'moodiness'],
  },
  {
    canonical: 'hallucinations',
    severity: 'severe',
    synonyms: ['hallucinations', 'seeing things', 'hearing things', 'nightmares', 'vivid dreams'],
  },
  {
    canonical: 'muscle cramps',
    severity: 'mild',
    synonyms: ['muscle cramps', 'cramping', 'charley horse', 'leg cramps', 'muscle spasms'],
  },
  {
    canonical: 'sore throat',
    severity: 'mild',
    synonyms: ['sore throat', 'throat pain', 'scratchy throat', 'throat irritation'],
  },
  {
    canonical: 'back pain',
    severity: 'mild',
    synonyms: ['back pain', 'lower back pain', 'backache', 'stiff back'],
  },
  {
    canonical: 'chest pain',
    severity: 'severe',
    synonyms: ['chest pain', 'chest tightness', 'chest pressure', 'tight chest'],
  },
  {
    canonical: 'cold sweats',
    severity: 'moderate',
    synonyms: ['cold sweats', 'clammy skin', 'cold sweating'],
  },
  {
    canonical: 'bleeding',
    severity: 'severe',
    synonyms: ['easy bruising', 'bleeding', 'nosebleeds', 'unusual bleeding', 'spotting'],
  },
  {
    canonical: 'dehydration',
    severity: 'moderate',
    synonyms: ['extreme thirst', 'dehydration', 'parched', 'excessive thirst'],
  },
  {
    canonical: 'restless legs',
    severity: 'mild',
    synonyms: ['restless legs', 'leg jitteriness', 'rls'],
  },
  {
    canonical: 'flushing',
    severity: 'mild',
    synonyms: ['facial flushing', 'red face', 'hot flashes', 'flushing', 'feeling hot'],
  },
  {
    canonical: 'tinnitus',
    severity: 'moderate',
    synonyms: ['ringing in ears', 'tinnitus', 'ear buzzing', 'ringing ears'],
  },
];

// Pre-compiled map for O(1) synonym lookup
const SYNONYM_MAP = new Map();
MEDICAL_SIDE_EFFECTS.forEach((entry) => {
  entry.synonyms.forEach((synonym) => {
    SYNONYM_MAP.set(synonym.toLowerCase(), entry);
  });
});

/**
 * Extract unique canonical side effects detected in a text string
 * @param {string} text - Review or clinical text
 * @returns {Array<{ effect: string, severity: string, match: string }>}
 */
const extractSideEffectsFromText = (text) => {
  if (!text || typeof text !== 'string') return [];

  const lowerText = text.toLowerCase();
  const detectedMap = new Map(); // canonical -> { effect, severity, match }

  // Check each synonym in dictionary against text
  for (const [synonym, entry] of SYNONYM_MAP.entries()) {
    // Regex for word boundary matching
    const regex = new RegExp(`\\b${synonym.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
    if (regex.test(lowerText)) {
      if (!detectedMap.has(entry.canonical)) {
        detectedMap.set(entry.canonical, {
          effect: entry.canonical,
          severity: entry.severity,
          match: synonym,
        });
      }
    }
  }

  return Array.from(detectedMap.values());
};

/**
 * Get severity classification for a canonical side effect
 * @param {string} canonicalEffect
 * @returns {'mild'|'moderate'|'severe'}
 */
const getSideEffectSeverity = (canonicalEffect) => {
  const entry = MEDICAL_SIDE_EFFECTS.find(
    (e) => e.canonical.toLowerCase() === canonicalEffect.toLowerCase()
  );
  return entry ? entry.severity : 'mild';
};

module.exports = {
  MEDICAL_SIDE_EFFECTS,
  extractSideEffectsFromText,
  getSideEffectSeverity,
};
