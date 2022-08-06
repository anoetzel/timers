import crypto from "crypto";
import { ObjectId } from "mongodb";

const hash = (pass) => crypto.createHash("sha256").update(pass).digest("hex");

const auth = () => async (req, res, next) => {
  if (!req.cookies["userToken"]) {
    return next();
  }

  const user = await findUserByToken(req.db, req.cookies["userToken"]);

  req.user = user;
  req.userToken = req.cookies["userToken"];
  next();
};

const findUserByUsername = async (db, username) => db.collection("users").findOne({ username });

const findUserByToken = async (db, userToken) => {
  const token = await db.collection("tokens").findOne({ userToken: userToken });

  if (!token) {
    return;
  }

  return db.collection("users").findOne({
    _id: ObjectId(token.userToken),
  });
};

const deleteToken = async (db, userToken) => {
  await db.collection("tokens").deleteOne({
    userToken,
  });
};

const getAllTimers = async (db, userId) => {
  const timers = await db
    .collection("timers")
    .find({
      userId: ObjectId(userId),
    })
    .toArray();

  const timerEnd = new Date().toISOString();

  return timers.map((timer) => {
    if (timer.isActive) {
      return {
        ...timer,
        progress: Date.now() - new Date(timer.start).getTime(),
      };
    }

    return {
      ...timer,
      end: timerEnd,
      duration: Date.now() - new Date(timer.start).getTime(),
    };
  });
};

const getActiveTimers = async (db, userId) => {
  const timers = await db
    .collection("timers")
    .find({
      userId: ObjectId(userId),
      isActive: true,
    })
    .toArray();

  const mappedTimers = timers.map((timer) => ({
    ...timer,
    progress: Date.now() - new Date(timer.start).getTime(),
  }));

  if (!timers) return [];

  return mappedTimers;
};

async function getTimerById(db, timerId, user_id) {
  return db
    .collection("timers")
    .find({
      _id: ObjectId(timerId),
      userId: user_id,
    })
    .toArray();
}

export {
  auth,
  deleteToken,
  findUserByToken,
  findUserByUsername,
  hash,
  getAllTimers,
  // sentAllTimers,
  getActiveTimers,
  getTimerById,
};
