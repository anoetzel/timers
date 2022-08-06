import cookie from "cookie";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import express from "express";
import { createServer } from "http";
import { MongoClient } from "mongodb";
import nunjucks from "nunjucks";
import { WebSocketServer } from "ws";

import { router as timersRouter } from "./js/timers.js";
import { router as usersRouter } from "./js/users.js";
import { auth, findUserByToken, getActiveTimers, getAllTimers } from "./js/utils.js";

dotenv.config();

const app = express();

const clientPromise = new MongoClient(process.env.DB_URI, {
  maxPoolSize: 10,
}).connect();

app.use(async (req, res, next) => {
  try {
    const client = await clientPromise;
    req.db = client.db("users");
    next();
  } catch (err) {
    next(err);
  }
});

nunjucks.configure("views", {
  autoescape: true,
  express: app,
  tags: {
    blockStart: "[%",
    blockEnd: "%]",
    variableStart: "[[",
    variableEnd: "]]",
    commentStart: "[#",
    commentEnd: "#]",
  },
});

app.set("view engine", "njk");

app.use(express.json());
app.use(express.static("public"));
app.use(cookieParser());
app.use("/", usersRouter);
app.use("/api/timers", timersRouter);

app.get("/", auth(), (req, res) => {
  res.render("index", {
    user: req.user,
    token: req.userToken,
    authError: req.query.authError === "true" ? "Wrong username or password" : req.query.authError,
  });
});

const server = createServer(app);
const wss = new WebSocketServer({ clientTracking: false, noServer: true });

server.on("upgrade", async (req, socket, head) => {
  const cookies = cookie.parse(req.headers["cookie"]);
  const userToken = cookies && cookies["userToken"];
  const client = await clientPromise;
  const db = client.db("users");
  const user = await findUserByToken(db, userToken);

  if (!user) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  req.db = db;
  req.user = user;

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", async (ws, req) => {
  const userId = req.user._id.toString();

  const sentAllTimers = async (db, userId, ws) => {
    const allTimers = await getAllTimers(db, userId);

    ws.send(
      JSON.stringify({
        type: "all_timers",
        timers: allTimers,
      })
    );
  };

  await sentAllTimers(req.db, userId, ws);

  setInterval(async () => {
    const activeTimers = await getActiveTimers(req.db, userId);

    ws.send(
      JSON.stringify({
        type: "active_timers",
        timers: activeTimers,
      })
    );
  }, 1000);

  ws.on("message", async (message) => {
    let data;

    try {
      data = JSON.parse(message);
    } catch (err) {
      return;
    }

    if (data.message === "all_timers") {
      await sentAllTimers(req.db, userId, ws);
    }
  });
});

const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log(`  Listening on http://localhost:${port}`);
});
