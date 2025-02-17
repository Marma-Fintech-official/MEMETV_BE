const express = require("express");
const passport = require("passport");
const router = express.Router();
require("../passport/googlePassport");
const { createToken } = require("../helper/token");
const { COOKIE_OPTIONS } = require("../utils/cookie");
const { addToBlacklist, isTokenBlacklisted } = require("../helper/tokenHandler");

router.get("/auth", (req, res) => {
  console.log(req,">>>>>>>>>>>>>>>>>>");
  
  const provider = req.query.provider;
  if (provider === "google") {
    passport.authenticate("google", {
      scope: ["profile", "email"],
      successRedirect: "/auth/google/callback", // Specify the Google callback URL
    })(req, res);
  } else {
    res.status(400).json({ message: "Invalid provider specified" });
  }
});

router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    successRedirect: "/googlesuccess",
    failureRedirect: "/failure",
  })
);

async function handleSuccess(req, res, provider) {
  if (req.user && req.user._id && req.user.email) {
    // Use the spread operator to include all properties from req.user
    const payLoad = {
      id: req.user._id.toString(),
      email: req.user.email,
      provider: req.user.provider,
      createdAt: req.user.createdAt,
      updatedAt: req.user.updatedAt,
    };
    console.log(payLoad,"========================");
    
  
    // Create a session to store user data
    // req.session.user = payLoad;

    // Create a token
    const token = await createToken({ id: payLoad.id });
    // console.log("token", token);

    // Set the id as a cookie
    res.cookie("id", payLoad.id.toString(), COOKIE_OPTIONS);

    // Set the token as a cookie
    res.cookie("token", token.toString(), COOKIE_OPTIONS);

     res.send(`${provider} Success`);

    // res.redirect(`http://localhost:3001/home?token=${token}`);


  } else {
    res.status(400).send({ message: "Failed sign-in" });
  }
}

router.get("/googlesuccess", (req, res) => {
  handleSuccess(req, res, "Google");
});

router.get("/failure", (req, res) => {
  res.send("Something-Went-To-Wrong");
});

router.get("/signout", async (req, res, next) => {
  try {
    const token = req.cookies.token;

    // Check if the token is already blacklisted
    if (await isTokenBlacklisted(token)) {
      res.status(401).send({ message: "Token is already blacklisted" });
      return;
    }

    // Add the token to the blacklist
    await addToBlacklist(token);

    // Clear the session
    req.session.destroy((err) => {
      if (err) {
        next(err);
        return;
      }

      // Clear the cookies in the response
      res.clearCookie("id");
      res.clearCookie("token");
      res.clearCookie("connect.sid");

      res.status(200).send({ message: "User logged out successfully" });
    });
  } catch (err) {
    next(err);
  }
});


module.exports = router;

