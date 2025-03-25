import { OrderPlacedConsumer } from "./order_placed"
import { InventoryService } from "../modules/inventory/service"
import kafka from "../config/kafka"
import redis from "../config/redis"

jest.mock("../config/kafka")
jest.mock("../config/redis", () => ({
  __esModule: true,
  default: {
    connect: jest.fn(),
    set: jest.fn().mockImplementation((key, value, options) => {
      return options?.NX ? Promise.resolve(true) : Promise.resolve("OK")
    }),
    del: jest.fn().mockResolvedValue(1),
  },
}))
jest.mock("../modules/inventory/service")

describe("OrderPlacedConsumer", () => {
  let mockConsumer: any
  let savedEachMessage: (params: {
    message: any
    topic: string
    partition: number
  }) => Promise<void>

  beforeEach(() => {
    jest.clearAllMocks()

    mockConsumer = {
      connect: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockResolvedValue(undefined),
      run: jest.fn().mockImplementation(({ eachMessage }) => {
        savedEachMessage = eachMessage
      }),
      commitOffsets: jest.fn().mockResolvedValue(undefined),
    }
    ;(kafka.consumer as jest.Mock).mockReturnValue(mockConsumer)
    ;(redis.set as jest.Mock).mockImplementation(
      (key: string, value: string, options?: { NX: boolean }) => {
        if (options?.NX) {
          return Promise.resolve(true) // Simulate new order by default
        }
        return Promise.resolve("OK")
      }
    )
    ;(InventoryService.onOrderPlaced as jest.Mock).mockResolvedValue(undefined)
  })

  describe("consume", () => {
    it("should process a single order successfully", async () => {
      await OrderPlacedConsumer.consume()

      const order = { id: "1", items: [] }
      const message = {
        topic: "OrderPlaced",
        partition: 0,
        message: {
          offset: "0",
          value: Buffer.from(JSON.stringify(order)),
        },
      }

      await savedEachMessage({
        message: message.message,
        topic: message.topic,
        partition: message.partition,
      })

      // Verify Redis interactions
      expect(redis.set).toHaveBeenCalledWith(
        `order:${order.id}`,
        "processing",
        { NX: true }
      )
      expect(redis.set).toHaveBeenCalledWith(`order:${order.id}`, "processed")

      // Verify inventory update
      expect(InventoryService.onOrderPlaced).toHaveBeenCalledWith(order)

      // Verify offset commit
      expect(mockConsumer.commitOffsets).toHaveBeenCalledWith([
        { topic: "OrderPlaced", partition: 0, offset: "0" },
      ])
    })

    it("should process three concurrent orders", async () => {
      await OrderPlacedConsumer.consume()

      const orders = [
        { id: "1", items: [] },
        { id: "2", items: [] },
        { id: "3", items: [] },
      ]

      const messages = orders.map((order, index) => ({
        topic: "OrderPlaced",
        partition: 0,
        message: {
          offset: String(index),
          value: Buffer.from(JSON.stringify(order)),
        },
      }))

      // Process all messages concurrently
      await Promise.all(
        messages.map((msg) =>
          savedEachMessage({
            message: msg.message,
            topic: msg.topic,
            partition: msg.partition,
          })
        )
      )

      // Verify each order was processed
      orders.forEach((order) => {
        expect(redis.set).toHaveBeenCalledWith(
          `order:${order.id}`,
          "processing",
          { NX: true }
        )
        expect(redis.set).toHaveBeenCalledWith(`order:${order.id}`, "processed")
        expect(InventoryService.onOrderPlaced).toHaveBeenCalledWith(order)
      })

      // Verify all offsets were committed
      const expectedOffsets = messages.map((msg) => msg.message.offset)
      const commitCalls = (mockConsumer.commitOffsets as jest.Mock).mock.calls
      const committedOffsets = commitCalls.flatMap(([offsets]) =>
        offsets.map((o: any) => o.offset)
      )
      expect(committedOffsets.sort()).toEqual(expectedOffsets.sort())
      expect(commitCalls).toHaveLength(3)
    })
  })
})
