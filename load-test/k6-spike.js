import http from 'k6/http';
import { check } from 'k6';

/**
 * k6 Load Test Scenario for Arlecchino Concurrent Quiz Platform
 * Executes 200 concurrent user submissions in 1 second.
 */

export const options = {
  scenarios: {
    spike: {
      executor: 'constant-arrival-rate',
      rate: 200,
      timeUnit: '1s',
      duration: '1s',
      preAllocatedVUs: 200,
      maxVUs: 250,
    },
  },
  thresholds: {
    http_req_failed: ['rate==0'],
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001';
const QUIZ_ID = 'arlecchino-riddles-1';

// Setup phase creates 200 participant tokens sequentially before the spike begins
export function setup() {
  console.log(`[Setup] Registering 200 participants at ${BASE_URL}...`);
  const sessions = [];

  for (let i = 1; i <= 200; i++) {
    const payload = JSON.stringify({
      quizId: QUIZ_ID,
      displayName: `VU-Participant-${i}`,
    });

    const res = http.post(`${BASE_URL}/api/session/start`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.status === 200) {
      const data = JSON.parse(res.body);
      sessions.push({
        id: data.participantId,
        token: data.sessionToken,
      });
    } else {
      console.error(`[Setup Error] Failed to create session for VU ${i}: status ${res.status}`);
    }
  }

  console.log(`[Setup Complete] Created ${sessions.length} sessions.`);
  return { sessions };
}

export default function (data) {
  // Select session token for this iteration (using __VU - 1)
  const vuIndex = (__VU - 1) % data.sessions.length;
  const session = data.sessions[vuIndex];

  if (!session) {
    return;
  }

  // Realistic payload: 50 answers (~4KB)
  const answers = {};
  for (let q = 1; q <= 50; q++) {
    const keys = ['a', 'b', 'c', 'd'];
    answers[`q-${q}`] = keys[Math.floor(Math.random() * keys.length)];
  }

  const payload = JSON.stringify({
    answers,
    autoSubmitted: true,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.token}`,
    },
  };

  const res = http.post(`${BASE_URL}/api/submit`, payload, params);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has score in body': (r) => {
      if (r.status !== 200) return false;
      const body = JSON.parse(r.body);
      return typeof body.score === 'number';
    },
  });
}
