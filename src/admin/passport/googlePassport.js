const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/adminModel");
require("dotenv").config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
      scope: ["profile", "email"],
    },
    async (request, accessToken, refreshToken, profile, done) => {
      console.log(profile);
      
      try {
        const existingUser = await User.findOne({
          email: profile.emails[0].value,
        });
        if (existingUser) {
          return done(null, existingUser);
        }

        // Create a new user without the password field
        const newUser = await User.create({
          email: profile.emails[0].value,
          yourName: profile.displayName,
          provider: profile.provider,
          isVerified: profile.emails[0].verified,
          // You may need to adjust this based on your user model structure.
        });
        return done(null, newUser);
      } catch (err) {
        return done(err, false);
      }
    }
  )
);

passport.serializeUser(async (user, done) => {
  return done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    return done(null, user);
  } catch (err) {
    return done(err);
  }
});
