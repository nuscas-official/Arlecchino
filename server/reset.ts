import { dbService } from './db.js';

console.log('[Reset] Resetting quiz submissions and participant records for arlecchino-riddles-1...');
dbService.resetQuizData('arlecchino-riddles-1');
console.log('✅ Local database reset cleanly! Participant count and submissions are reset to 0.');
