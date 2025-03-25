// src/config/redis.ts
import { createClient } from "redis"

const redis = createClient({ url: process.env.REDIS_URL })

// Only connect if not in test environment
if (process.env.NODE_ENV !== "test") {
  async function initializeRedis() {
    await redis.connect()
  }
  initializeRedis().catch(console.error)
}

export default redis
