const fs = require('fs');
const crypto = require('crypto');

// Generate unique promo codes
const generatePromoCodes = (count) => {
  const promoCodes = new Set();
  while (promoCodes.size < count) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 5);
    promoCodes.add(code);
  }
  return Array.from(promoCodes);
};

// Convert promo codes to objects with rewards and status
const formatPromoCodes = (promoCodes, rewards) => {
  return promoCodes.map((code, index) => ({
    promoCode: code,
    reward: rewards[index % rewards.length], // Assign rewards in a cycle if promoCodes > rewards
    status: false, // Add the status field with default value false
  }));
};

// Save promo codes to a file
const savePromoCodesToFile = (filename, promoCodes) => {
  fs.writeFileSync(filename, JSON.stringify(promoCodes, null, 2));
  console.log(`${promoCodes.length} promo codes saved to ${filename}`);
};

// Parameters
const numberOfPromoCodes = 10000;
const rewards = [50, 100, 150, 200, 250, 300]; // Define your rewards here

// Generate, format, and save promo codes
const promoCodes = generatePromoCodes(numberOfPromoCodes);
const formattedPromoCodes = formatPromoCodes(promoCodes, rewards);
savePromoCodesToFile('./src/PromoCodes/promoCodes.json', formattedPromoCodes);
