import { ObjectId } from "mongodb";
import { auth, getTimerById } from "./utils.js";
import express from "express";

const router = express.Router();

router.post("/", auth(), async (req, res) => {
  if (!req.user) return res.redirect("/");
  if (!req.body.description) return res.sendStatus(400);

  const { description } = req.body;

  const date = new Date();
  const db = req.db;

  try {
    const newTimer = await db.collection("timers").insertOne(
      {
        description,
        userId: req.user._id,
        isActive: true,
        start: date.toISOString(),
      },
      {
        projection: { _id: 1 },
      }
    );

    res.status(201).json({
      id: newTimer._id,
      description,
    });
  } catch (err) {
    res.status(400).send(err.message);
  }
});

router.post("/:id/stop", auth(), async (req, res) => {
  const timer = await getTimerById(req.db, req.params.id, req.user._id);
  const timerEnd = new Date().toISOString();
  const timerStart = new Date(timer[0].start);
  const db = req.db;

  await db.collection("timers").findOneAndUpdate(
    {
      _id: ObjectId(req.params.id),
      userId: req.user._id,
    },
    {
      $set: {
        isActive: false,
        end: timerEnd,
        duration: Date.now() - timerStart.getTime(),
      },
    },
    {
      returnOriginal: false,
    }
  );

  res.status(201).json(timer[0]._id);
});

router.delete("/:id", auth(), async (req, res) => {
  const timer = await getTimerById(req.db, req.params.id, req.user._id);
  const db = req.db;

  await db.collection("timers").deleteOne(
    {
      _id: ObjectId(req.params.id),
      userId: req.user._id,
    },
    {
      returnOriginal: false,
    }
  );

  res.status(201).json(timer[0]._id);
});

export { router };
