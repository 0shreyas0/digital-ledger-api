import ratelimit from "../config/upstash.js";

const rateLimiter = async (req, res, next) => {
  // here rate limit is applied to all the users.
  // for real world apps, use user based rate limit, i.e. use based on
  // userId or ipAddress as your key.
  try {
    const { success } = await ratelimit.limit("my-rate-limit");

    if (!success) {
      return res.status(429).json({
        message: "Too many requests, please try again later.",
      });
    }

    next();
  } catch (error) {
    console.log("Rate Limit Error", error);
    next(error);
  }
};

export default rateLimiter;
