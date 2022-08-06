import bodyParser from "body-parser";
import express from "express";
import { auth, deleteToken, findUserByUsername, hash } from "./utils.js";

const router = express.Router();

router.post(
  "/login",
  bodyParser.urlencoded({
    extended: false,
  }),
  async (req, res) => {
    const { username, password } = req.body;

    const user = await findUserByUsername(req.db, username);

    if (!user || user.password !== hash(password)) {
      return res.redirect("/?authError=true");
    }

    await req.db.collection("tokens").insertOne({
      userToken: user._id.toString(),
    });

    res.cookie("userToken", user._id.toString(), { httpOnly: true }).redirect("/");
  }
);

router.post(
  "/signup",
  bodyParser.urlencoded({
    extended: false,
  }),
  async (req, res) => {
    const { username, password } = req.body;

    const user = await findUserByUsername(req.db, username);
    if (user) return res.sendStatus(400);

    const db = req.db;

    if (!user) {
      await db.collection("users").insertOne({
        username: username,
        password: hash(password),
      });

      res.send(`The user ${username} is successfully created! You can <a href="/">login</a>`);
    }
  }
);

router.get("/logout", auth(), async (req, res) => {
  if (!req.user) return res.redirect("/");

  try {
    await deleteToken(req.db, req.userToken);
    res.clearCookie("userToken").redirect("/");
  } catch (err) {
    res.status(400).send(err.message);
  }
});

export { router };
