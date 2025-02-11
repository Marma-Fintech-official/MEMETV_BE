const blacklistedTokens = new Set();

const addToBlacklist = async (token) => {
    blacklistedTokens.add(token);
};

const isTokenBlacklisted = async (token) => {
    return blacklistedTokens.has(token);
};

module.exports = { addToBlacklist, isTokenBlacklisted };