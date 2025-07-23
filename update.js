// update.js - Script to create an EAS update

const { execSync } = require('child_process');

console.log('Creating EAS Update...');

try {
  // Run EAS update command for production channel
  console.log('Running EAS update for production...');
  execSync('eas update --channel production', { stdio: 'inherit' });
  
  console.log('\nEAS Update completed successfully!');
  console.log('\nYour changes have been deployed and will be available to users soon.');
} catch (error) {
  console.error('\nError during EAS update:', error.message);
  process.exit(1);
} 