import kafka from "../config/kafka"
import { InventoryService } from "../modules/inventory/service"
import { DtoOrder } from "../modules/order/types"
import redis from "../config/redis"

export class OrderPlacedConsumer {
  static async consume() {
    const consumer = kafka.consumer({ groupId: "order-placed-consumer" })

    await consumer.connect()
    await consumer.subscribe({ topic: "OrderPlaced", fromBeginning: false })

    await consumer.run({
      autoCommit: false, // Manual offset commits for better control
      eachMessage: async ({ message, topic, partition }) => {
        if (!message.value) {
          console.error("Message value is null")
          return
        }

        const order: DtoOrder = JSON.parse(message.value.toString())
        const orderKey = `order:${order.id}`

        try {
          const isNewOrder = await redis.set(orderKey, "processing", {
            NX: true,
          })

          if (!isNewOrder) {
            console.log(`Order ${order.id} already being processed`)
            return
          }

          await InventoryService.onOrderPlaced(order)

          await redis.set(orderKey, "processed")

          await consumer.commitOffsets([
            {
              topic,
              partition,
              offset: message.offset,
            },
          ])
        } catch (error) {
          console.error(`Error processing order ${order.id}:`, error)
          await redis.del(orderKey)
        }
      },
    })
  }
}
