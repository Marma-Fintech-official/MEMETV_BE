const jwt= require("jsonwebtoken");
require('dotenv').config();

let JWT_SECRET_KEY = process.env.JWT_SECRET_KEY; 

async function createToken(payload){

   return jwt.sign(payload, JWT_SECRET_KEY,{
        expiresIn:'1d'
    });
}
async function verifyToken(token){
    return jwt.verify(token,JWT_SECRET_KEY);
}

module.exports={createToken,verifyToken};
