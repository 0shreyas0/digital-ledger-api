import ratelimit from "../config/upstash.js";

const rateLimiter = async (req, res, next) => {
  // here rate limit is applied to all the users.
  // for real world apps, use user based rate limit, i.e. use based on
  // userId or ipAddress as your key.
  try {
    const { success } = await ratelimit.limit("my-rate-limit"); // all users are counted together

    if (!success) {
      return res.status(429).json({
        message: "Too many requests, please try again later.",
      });
    }

    next();
  } catch (error) {
    console.log("Rate Limit Error", error);
    // next(error);
    next();
    // If you want rate limiting to be non-critical infrastructure, use next(). If you want the whole API to hard-fail whenever Redis is down, keep next(error). For current app, next() is the correct choice.
  }
};

export default rateLimiter;
